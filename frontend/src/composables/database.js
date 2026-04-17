/**
 * Offline-First Datenzugriffsschicht.
 *
 * Architektur:
 * - Lokal: IndexedDB (`documents` Store) als primäre Quelle für die UI.
 * - Remote: CouchDB als Synchronisationsziel.
 *
 * Kernidee:
 * - Schreibvorgänge landen zuerst lokal und markieren Dokumente als `_dirty`.
 * - Ein Hintergrund-Sync pusht `_dirty`-Dokumente und pullt Remote-Änderungen.
 * - Konflikte werden je nach Typ automatisch gemerged oder als User-Entscheidung markiert.
 */

const DB_NAME = 'einkaufsliste_db';
const DB_VERSION = 6; // Bump: _changes feed, hardDelete
const STORE_NAME = 'documents';
const COUCHDB_URL = import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/einkaufsliste';
const COUCHDB_USER = import.meta.env.VITE_COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = import.meta.env.VITE_COUCHDB_PASSWORD || 'password';

let db = null;

/**
 * Öffnet die lokale IndexedDB-Verbindung (Singleton).
 *
 * Bei einem Versions-Upgrade wird der `documents`-Store inklusive Indizes
 * für `type` und `deleted` angelegt.
 *
 * @returns {Promise<IDBDatabase>} Geöffnete DB-Instanz.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: '_id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('deleted', 'deleted', { unique: false });
      }
    };
  });
}

/**
 * Initialisiert die lokale Datenbank und liefert das historische Rückgabeformat.
 *
 * Hinweis: `remoteDB` bleibt `null`, da die Remote-Anbindung in diesem Modul
 * explizit über `fetch`-basierte Sync-Funktionen erfolgt.
 *
 * @returns {Promise<{ localDB: IDBDatabase, remoteDB: null }>}
 */
export async function initPouchDB() {
  await openDB();
  return { localDB: db, remoteDB: null };
}

/**
 * Interner Zustand des laufenden Background-Syncs.
 * `syncInterval` steuert den Polling-Zyklus, die Callbacks informieren die UI.
 */
let syncInterval = null;
let syncStatusCallback = null;
let dataChangeCallback = null;

/**
 * Startet den periodischen Synchronisationsprozess.
 *
 * Ablauf:
 * 1. Optionaler Initial-Pull, falls die lokale DB leer ist.
 * 2. Sofortiger Sync-Durchlauf.
 * 3. Wiederholung alle 5 Sekunden.
 *
 * @param {(status: {online: boolean, syncing: boolean}) => void} onStatusChange
 * @param {Function} _onConflict - Legacy-Parameter, aktuell ungenutzt.
 * @param {(changedDocIds?: string[]) => void} onDataChange
 * @returns {{ cancel: () => void }} Handle zum manuellen Stoppen.
 */
export function startSync(onStatusChange, _onConflict, onDataChange) {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncStatusCallback = onStatusChange;
  dataChangeCallback = onDataChange;

  // Initiale Sync nur wenn DB leer ist
  checkAndInitialSync();

  // Sofortiger erster Status-Check
  syncInBackground();

  // Periodischer Sync alle 5 Sekunden (im Hintergrund)
  syncInterval = setInterval(() => {
    syncInBackground();
  }, 5000);

  return {
    cancel: () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    },
  };
}

/**
 * Führt einen ersten Pull durch, wenn lokal noch keine Dokumente vorhanden sind.
 * Verhindert, dass Nutzer mit einer leeren Ansicht starten, obwohl Remote-Daten existieren.
 */
async function checkAndInitialSync() {
  try {
    const docs = await getAllDocs();
    if (docs.length === 0) {
      console.log('Local DB empty, doing initial sync from remote');
      await syncFromRemote();
    }
  } catch (err) {
    console.log('Initial sync check failed:', err.message);
  }
}

/**
 * Ein vollständiger Background-Sync-Zyklus.
 *
 * Reihenfolge ist bewusst "push dann pull":
 * - Push sichert lokale ungesyncte Änderungen.
 * - Pull holt danach den aktuellen Remote-Stand.
 */
async function syncInBackground() {
  try {
    // 1. Push: Alle dirty docs hochladen
    const db = await openDB();
    await pushDirtyDocs(db);

    // 2. Pull: Neue/geänderte Docs von Remote holen
    const syncResult = await syncFromRemote();

    // Benachrichtige UI über Änderungen
    if (syncResult.updated && dataChangeCallback) {
      dataChangeCallback(syncResult.changedDocIds);
    }

    // Server ist erreichbar
    if (syncStatusCallback) {
      syncStatusCallback({ online: true, syncing: true });
    }
  } catch (err) {
    // Server nicht erreichbar
    if (syncStatusCallback) {
      syncStatusCallback({ online: false, syncing: false });
    }
  }
}

/**
 * Stoppt den periodischen Sync vollständig.
 * Wird beim Unmount der Composables oder beim Re-Init verwendet.
 */
export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Holt Änderungen über CouchDB `_changes` und spiegelt sie lokal.
 *
 * Behandlung je Dokument:
 * - Remote gelöscht: lokal ebenfalls entfernen.
 * - Lokal nicht vorhanden: als neu übernehmen (`_changeType: 'added'`).
 * - Lokal `_dirty`: nicht überschreiben (lokale Änderungen behalten).
 * - Revision unterschiedlich: Remote-Version übernehmen bzw. `_pendingDelete` setzen.
 *
 * @returns {Promise<{updated: boolean, changedDocIds: string[]}>}
 */
async function syncFromRemote() {
  const response = await fetch(`${COUCHDB_URL}/_changes?include_docs=true&since=0`, {
    headers: { Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` },
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Remote not reachable');

  const data = await response.json();
  const db = await openDB();
  let updatedCount = 0;
  const changedDocIds = [];

  for (const row of data.results) {
    const remoteDoc = row.doc;
    if (!remoteDoc) continue;

    // Tombstone: Dokument wurde auf Remote gelöscht → lokal auch löschen
    if (row.deleted || remoteDoc._deleted) {
      const localDoc = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(remoteDoc._id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (localDoc) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(remoteDoc._id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
        updatedCount++;
        changedDocIds.push(remoteDoc._id);
      }
      continue;
    }

    // Lokales Dokument holen
    const localDoc = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(remoteDoc._id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (!localDoc) {
      // Neues Dokument von Remote → als "hinzugefügt" markieren
      await idbPut(db, {
        ...remoteDoc,
        _remoteChanged: true,
        _changeType: 'added',
        _changeTimestamp: Date.now(),
      });
      updatedCount++;
    } else if (localDoc._dirty) {
      // Lokale ungesyncte Änderungen - NICHT überschreiben
    } else if (localDoc._pendingDelete) {
      // User muss noch entscheiden - nicht überschreiben
    } else if (localDoc._rev !== remoteDoc._rev) {
      if (remoteDoc.markedDeleted === true && !localDoc.markedDeleted) {
        await idbPut(db, {
          ...localDoc,
          _rev: remoteDoc._rev,
          _pendingDelete: remoteDoc.lastModifiedBy || 'Unbekannt',
        });
      } else {
        await idbPut(db, {
          ...remoteDoc,
          _remoteChanged: true,
          _changeType: remoteDoc.markedDeleted ? 'deleted' : 'modified',
          _changeTimestamp: Date.now(),
        });
      }
      updatedCount++;
      changedDocIds.push(remoteDoc._id);
    }
  }

  if (updatedCount > 0) console.log('Pulled', updatedCount, 'docs from remote');
  return { updated: updatedCount > 0, changedDocIds };
}

/**
 * Sucht alle lokal geänderten (`_dirty`) Dokumente und lädt sie zu CouchDB hoch.
 *
 * Fehler beim Push einzelner Dokumente stoppen den gesamten Zyklus nicht,
 * damit andere Änderungen weiterhin synchronisiert werden können.
 *
 * @param {IDBDatabase} db
 */
async function pushDirtyDocs(db) {
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    const allDocs = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const dirtyDocs = allDocs.filter((doc) => doc._dirty);

    if (dirtyDocs.length > 0) {
      console.log('Pushing', dirtyDocs.length, 'local changes to remote');
      for (const doc of dirtyDocs) {
        const success = await syncToRemote(doc);
        if (success) {
          console.log('✓ Pushed', doc._id);
        }
      }
    }
  } catch (err) {
    // Silent fail
  }
}

/**
 * Liest alle Dokumente aus dem lokalen Store.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getAllDocs() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting all docs:', err);
    throw err;
  }
}

/**
 * Liest ein einzelnes Dokument per `_id` aus der lokalen DB.
 *
 * @param {string} id
 * @returns {Promise<Record<string, any> | undefined>}
 */
export async function getDoc(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting doc:', err);
    throw err;
  }
}

/**
 * Speichert/aktualisiert ein Dokument lokal und markiert es für den Remote-Push.
 *
 * Wichtig:
 * - Übernimmt vorhandene `_rev`, damit der nächste Remote-Push korrekt versioniert ist.
 * - Pflegt `fieldTimestamps` für feldbasiertes Merging bei Konflikten.
 * - Setzt `_dirty` und `_lastModified` als Sync-Metadaten.
 *
 * @param {Record<string, any>} doc
 * @returns {Promise<{ok: boolean, id: string, rev: string}>}
 */
export async function putDoc(doc) {
  try {
    const db = await openDB();

    // Erst das bestehende Dokument holen (für lokale _rev)
    let existing = null;
    try {
      existing = await getDoc(doc._id);
      // Behalte die _rev vom bestehenden Dokument (vom letzten Sync)
      if (existing && existing._rev) {
        doc._rev = existing._rev;
      }
    } catch (err) {
      // Dokument existiert nicht, neue _rev wird beim Sync gesetzt
      doc._rev = `1-local-${Date.now()}`;
    }

    // Per-Feld Timestamps tracken für konfliktfreies Mergen
    const now = new Date().toISOString();
    const existingTimestamps = existing?.fieldTimestamps || {};
    const newTimestamps = { ...existingTimestamps };
    for (const key of Object.keys(doc)) {
      if (key.startsWith('_') || key === 'updatedAt' || key === 'createdAt' || key === 'type')
        continue;
      if (!existing || JSON.stringify(existing[key]) !== JSON.stringify(doc[key])) {
        newTimestamps[key] = now;
      }
    }
    doc.fieldTimestamps = newTimestamps;

    // Markiere Dokument als lokal geändert (noch nicht gesynct)
    doc._dirty = true;
    doc._lastModified = Date.now();

    // Jetzt in neuer Transaktion speichern
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(doc);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // Sync to remote (fire and forget)
        syncToRemote(doc).catch((err) => console.log('Remote sync failed:', err.message));
        resolve({ ok: true, id: doc._id, rev: doc._rev });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error putting doc:', err);
    throw err;
  }
}

/**
 * Entfernt lokale Metadatenfelder vor dem Upload zu CouchDB.
 *
 * Erhalten bleiben nur `_id` und `_rev`, da diese für CouchDB notwendig sind.
 *
 * @param {Record<string, any>} doc
 * @returns {Record<string, any>}
 */
function prepareForUpload(doc) {
  const KEEP = new Set(['_id', '_rev']);
  const clean = {};
  for (const [key, val] of Object.entries(doc)) {
    if (key.startsWith('_') && !KEEP.has(key)) continue;
    clean[key] = val;
  }
  return clean;
}

/**
 * Synchronisiert ein einzelnes lokales Dokument nach CouchDB.
 *
 * Ablauf:
 * 1. Aktuelle Remote-Revision laden.
 * 2. Bereinigtes Dokument hochladen.
 * 3. Bei Erfolg lokale `_rev` aktualisieren und `_dirty` entfernen.
 * 4. Bei 409 Konfliktauflösung starten.
 *
 * @param {Record<string, any>} doc
 * @returns {Promise<boolean>} `true`, wenn Upload/Resolution erfolgreich war.
 */
async function syncToRemote(doc) {
  try {
    // Erst die aktuelle _rev vom Server holen
    const getResponse = await fetch(`${COUCHDB_URL}/${doc._id}`, {
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
      },
      credentials: 'omit',
    });

    let remoteDoc = null;
    if (getResponse.ok) {
      remoteDoc = await getResponse.json();
      doc._rev = remoteDoc._rev; // Server-_rev verwenden
    }

    const docToUpload = prepareForUpload(doc);

    const response = await fetch(`${COUCHDB_URL}/${doc._id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(docToUpload),
      credentials: 'omit',
    });

    if (response.ok) {
      const result = await response.json();
      doc._rev = result.rev;
      doc._dirty = false;

      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(doc);

      console.log('Synced to remote:', doc._id);
      return true;
    } else if (response.status === 409) {
      console.warn('⚠️ Conflict detected for', doc._id, '- attempting field-level merge');
      const resolved = await resolveConflict(doc, remoteDoc);
      return resolved;
    } else {
      const body = await response.text();
      console.error('Remote rejected doc', doc._id, response.status, body);
    }
  } catch (err) {
    console.log('Could not sync to remote (offline):', err.message);
    return false;
  }
}

/**
 * Promise-Wrapper für einen einzelnen IndexedDB-`put`.
 *
 * @param {IDBDatabase} db
 * @param {Record<string, any>} doc
 * @returns {Promise<void>}
 */
function idbPut(db, doc) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Konfliktbehandlung zwischen lokaler und Remote-Version.
 *
 * Strategien:
 * 1. Remote markiert gelöscht, lokal nicht: setze `_pendingDelete` (User muss entscheiden).
 * 2. Lokal markiert gelöscht, remote nicht: lokale Löschung gewinnt und wird gepusht.
 * 3. Sonstige Inhalte: feldbasiertes Auto-Merge via `fieldTimestamps`.
 *
 * @param {Record<string, any>} localDoc
 * @param {Record<string, any>} _remoteDoc - Legacy/Debug, aktuell nicht direkt genutzt.
 * @returns {Promise<boolean>}
 */
async function resolveConflict(localDoc, _remoteDoc) {
  try {
    const getResponse = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
      headers: { Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` },
      credentials: 'omit',
    });
    if (!getResponse.ok) return false;
    const currentRemote = await getResponse.json();

    // Fall 1: Remote hat als gelöscht markiert, lokal nicht → Banner zeigen, NICHT anwenden
    if (currentRemote.markedDeleted === true && !localDoc.markedDeleted) {
      const pendingDoc = {
        ...localDoc,
        _rev: currentRemote._rev,
        _pendingDelete: currentRemote.lastModifiedBy || 'Unbekannt',
      };
      const db = await openDB();
      await idbPut(db, pendingDoc);
      console.log('⚠️ Pending delete banner set for:', localDoc._id);
      if (dataChangeCallback) dataChangeCallback();
      return true;
    }

    // Fall 2: Lokal als gelöscht markiert, remote nicht → lokal gewinnt, hochladen
    if (localDoc.markedDeleted === true && !currentRemote.markedDeleted) {
      const docToUpload = { ...prepareForUpload(localDoc), _rev: currentRemote._rev };
      const resp = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(docToUpload),
        credentials: 'omit',
      });
      if (resp.ok) {
        const result = await resp.json();
        const db = await openDB();
        await idbPut(db, { ...localDoc, _rev: result.rev, _dirty: false });
        if (dataChangeCallback) dataChangeCallback();
      }
      return true;
    }

    // Fall 3: Sonstige Konflikte → auto-merge (letzter Schreiber per Feld gewinnt)
    const localTimestamps = localDoc.fieldTimestamps || {};
    const remoteTimestamps = currentRemote.fieldTimestamps || {};
    const mergedDoc = { ...currentRemote };
    const mergedTimestamps = { ...remoteTimestamps };
    const skip = new Set([
      'updatedAt',
      'createdAt',
      'type',
      'list_id',
      'deleted',
      'fieldTimestamps',
    ]);

    for (const key of Object.keys(localDoc)) {
      if (key.startsWith('_') || skip.has(key)) continue;
      if (localTimestamps[key] && !remoteTimestamps[key]) {
        mergedDoc[key] = localDoc[key];
        mergedTimestamps[key] = localTimestamps[key];
      }
    }
    mergedDoc.fieldTimestamps = mergedTimestamps;
    mergedDoc._rev = currentRemote._rev;

    const uploadResp = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prepareForUpload(mergedDoc)),
      credentials: 'omit',
    });
    if (uploadResp.ok) {
      const result = await uploadResp.json();
      const db = await openDB();
      await idbPut(db, { ...mergedDoc, _rev: result.rev, _dirty: false });
      console.log('✓ Auto-merged:', localDoc._id);
      if (dataChangeCallback) dataChangeCallback();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Conflict resolution failed:', err);
    return false;
  }
}

/**
 * Persistiert die vom Nutzer gewählte Konfliktlösung auf dem Server
 * und übernimmt das Ergebnis lokal als neuen konsistenten Zustand.
 *
 * @param {string} docId
 * @param {Record<string, any>} chosenDoc
 * @returns {Promise<boolean>}
 */
export async function applyConflictResolution(docId, chosenDoc) {
  try {
    // Aktuelle Server-Rev holen
    const getResponse = await fetch(`${COUCHDB_URL}/${docId}`, {
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
      },
      credentials: 'omit',
    });

    let serverRev = chosenDoc._rev;
    if (getResponse.ok) {
      const serverDoc = await getResponse.json();
      serverRev = serverDoc._rev;
    }

    const docToUpload = { ...prepareForUpload(chosenDoc), _rev: serverRev };

    const response = await fetch(`${COUCHDB_URL}/${docId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(docToUpload),
      credentials: 'omit',
    });

    if (response.ok) {
      const result = await response.json();
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const finalDoc = { ...docToUpload, _rev: result.rev, _dirty: false };
      tx.objectStore(STORE_NAME).put(finalDoc);
      console.log('✓ Conflict resolved by user:', docId);
      if (dataChangeCallback) dataChangeCallback();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to apply conflict resolution:', err);
    return false;
  }
}

/**
 * Markiert eine lokale Version als "wiederhergestellt" und stößt normalen Sync an.
 *
 * @param {string} docId
 * @param {Record<string, any>} localVersion
 * @returns {Promise<boolean>}
 */
export async function restoreLocalVersion(docId, localVersion) {
  try {
    // Forciere die lokale Version
    const docToRestore = { ...localVersion };
    docToRestore._dirty = true;
    docToRestore._lastModified = Date.now();
    docToRestore.updatedAt = new Date().toISOString();

    await putDoc(docToRestore);
    console.log('✓ Restored local version for:', docId);
    return true;
  } catch (err) {
    console.error('Failed to restore local version:', err);
    return false;
  }
}

/**
 * Entfernt das `_pendingDelete`-Flag von einem Dokument.
 * Wird nach User-Entscheidung im Delete-Konflikt genutzt.
 *
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function clearPendingDeleteFlag(docId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(docId);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const doc = request.result;
        if (doc && doc._pendingDelete) {
          delete doc._pendingDelete;
          store.put(doc);
        }
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Error clearing pendingDelete flag:', err);
  }
}

/**
 * Lädt ein Dokument, lässt es durch `updateFn` transformieren und speichert es zurück.
 *
 * @param {string} id
 * @param {(doc: Record<string, any>) => Record<string, any>} updateFn
 * @returns {Promise<{ok: boolean, id: string, rev: string}>}
 */
export async function updateDoc(id, updateFn) {
  try {
    const doc = await getDoc(id);
    if (!doc) {
      throw new Error('Document not found');
    }
    const updatedDoc = updateFn(doc);
    return await putDoc(updatedDoc);
  } catch (err) {
    console.error('Error updating doc:', err);
    throw err;
  }
}

/**
 * Entfernt Marker für Remote-Änderungshinweise von einem Dokument.
 *
 * Entfernt:
 * - `_remoteChanged`
 * - `_changeTimestamp`
 * - `_changeType`
 *
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function clearRemoteChangedFlag(docId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(docId);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const doc = request.result;
        if (doc && doc._remoteChanged) {
          delete doc._remoteChanged;
          delete doc._changeTimestamp;
          delete doc._changeType;
          store.put(doc);
        }
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Error clearing flag:', err);
  }
}

/**
 * Erzeugt ein neues Dokument mit Standardmetadaten und speichert es lokal.
 *
 * @param {Record<string, any>} doc
 * @returns {Promise<{ok: boolean, id: string, rev: string}>}
 */
export async function createDoc(doc) {
  const newDoc = {
    ...doc,
    _id: doc._id || `${doc.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return await putDoc(newDoc);
}

/**
 * Entfernt ein Dokument endgültig lokal und – falls erreichbar – auch remote.
 *
 * Hinweis:
 * Für CouchDB-DELETE wird die aktuelle `_rev` benötigt; diese wird vorher geladen.
 *
 * @param {string} id
 * @returns {Promise<{ok: boolean, id: string}>}
 */
export async function hardDeleteDoc(id) {
  try {
    const db = await openDB();

    // 1. Aus IndexedDB löschen
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 2. Aus CouchDB löschen (braucht aktuelle _rev vom Server)
    try {
      const getResp = await fetch(`${COUCHDB_URL}/${id}`, {
        headers: { Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` },
        credentials: 'omit',
      });
      if (getResp.ok) {
        const remoteDoc = await getResp.json();
        await fetch(`${COUCHDB_URL}/${id}?rev=${remoteDoc._rev}`, {
          method: 'DELETE',
          headers: { Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` },
          credentials: 'omit',
        });
      }
    } catch (err) {
      // Offline - wird beim nächsten Sync nicht mehr hochgeladen da lokal gelöscht
      console.log('Could not delete from remote (offline):', err.message);
    }

    return { ok: true, id };
  } catch (err) {
    console.error('Error hard deleting doc:', err);
    throw err;
  }
}

/**
 * Sucht eine Liste anhand eines Share-Codes direkt in CouchDB.
 *
 * @param {string} code
 * @returns {Promise<Record<string, any> | null>}
 */
export async function findListByShareCode(code) {
  try {
    const response = await fetch(`${COUCHDB_URL}/_find`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selector: {
          type: 'list',
          shareCode: code,
        },
        limit: 1,
      }),
      credentials: 'omit',
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.docs && data.docs.length > 0) {
      return data.docs[0];
    }
    return null;
  } catch (err) {
    console.error('Error finding list by share code:', err);
    return null;
  }
}

/**
 * Lädt alle Items einer Liste aus CouchDB (Sharing-Join-Fall).
 *
 * @param {string} listId
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function fetchItemsForListFromRemote(listId) {
  try {
    const response = await fetch(`${COUCHDB_URL}/_find`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selector: {
          type: 'item',
          list_id: listId,
        },
        limit: 1000,
      }),
      credentials: 'omit',
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.docs || [];
  } catch (err) {
    console.error('Error fetching items from remote:', err);
    return [];
  }
}

/**
 * Löscht ein Dokument nur lokal aus IndexedDB.
 * (Legacy-Helfer neben `hardDeleteDoc` für reine Local-Operationen.)
 *
 * @param {string} id
 * @returns {Promise<{ok: boolean, id: string}>}
 */
export async function deleteDoc(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve({ ok: true, id });
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error deleting doc:', err);
    throw err;
  }
}
