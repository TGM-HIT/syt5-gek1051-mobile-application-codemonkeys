// Einfache IndexedDB-basierte Offline-Datenbank
// Verwendet natives Browser IndexedDB statt PouchDB wegen Vite-Kompatibilitätsproblemen

const DB_NAME = 'einkaufsliste_db'
const DB_VERSION = 6  // Bump: _changes feed, hardDelete
const STORE_NAME = 'documents'
const COUCHDB_URL = import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/einkaufsliste'
const COUCHDB_USER = import.meta.env.VITE_COUCHDB_USER || 'admin'
const COUCHDB_PASSWORD = import.meta.env.VITE_COUCHDB_PASSWORD || 'password'

let db = null

// IndexedDB initialisieren
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: '_id' })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('deleted', 'deleted', { unique: false })
      }
    }
  })
}

export async function initPouchDB() {
  await openDB()
  return { localDB: db, remoteDB: null }
}

// Sync-Handler
let syncHandler = null
let syncInterval = null
let syncStatusCallback = null
let conflictCallback = null
let dataChangeCallback = null

export function startSync(onStatusChange, onConflict, onDataChange) {
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  syncStatusCallback = onStatusChange
  conflictCallback = onConflict
  dataChangeCallback = onDataChange

  // Initiale Sync nur wenn DB leer ist
  checkAndInitialSync()

  // Sofortiger erster Status-Check
  syncInBackground()

  // Periodischer Sync alle 5 Sekunden (im Hintergrund)
  syncInterval = setInterval(() => {
    syncInBackground()
  }, 5000)

  return {
    cancel: () => {
      if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
      }
    }
  }
}

async function checkAndInitialSync() {
  try {
    const docs = await getAllDocs()
    if (docs.length === 0) {
      console.log('Local DB empty, doing initial sync from remote')
      await syncFromRemote()
    }
  } catch (err) {
    console.log('Initial sync check failed:', err.message)
  }
}

async function syncInBackground() {
  try {
    // 1. Push: Alle dirty docs hochladen
    const db = await openDB()
    await pushDirtyDocs(db)
    
    // 2. Pull: Neue/geänderte Docs von Remote holen
    const syncResult = await syncFromRemote()
    
    // Benachrichtige UI über Änderungen
    if (syncResult.updated && dataChangeCallback) {
      dataChangeCallback(syncResult.changedDocIds)
    }
    
    // Server ist erreichbar
    if (syncStatusCallback) {
      syncStatusCallback({ online: true, syncing: true })
    }
  } catch (err) {
    // Server nicht erreichbar
    if (syncStatusCallback) {
      syncStatusCallback({ online: false, syncing: false })
    }
  }
}

export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

async function syncFromRemote() {
  const response = await fetch(`${COUCHDB_URL}/_changes?include_docs=true&since=0`, {
    headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` }
  })
  if (!response.ok) throw new Error('Remote not reachable')

  const data = await response.json()
  const db = await openDB()
  let updatedCount = 0
  const changedDocIds = []

  for (const row of data.results) {
    const remoteDoc = row.doc
    if (!remoteDoc) continue

    // Tombstone: Dokument wurde auf Remote gelöscht → lokal auch löschen
    if (row.deleted || remoteDoc._deleted) {
      const localDoc = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(remoteDoc._id)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      })
      if (localDoc) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).delete(remoteDoc._id)
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        })
        updatedCount++
        changedDocIds.push(remoteDoc._id)
      }
      continue
    }

    // Lokales Dokument holen
    const localDoc = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(remoteDoc._id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })

    if (!localDoc) {
      await idbPut(db, remoteDoc)
      updatedCount++
    } else if (localDoc._dirty) {
      // Lokale ungesyncte Änderungen - NICHT überschreiben
    } else if (localDoc._pendingDelete) {
      // User muss noch entscheiden - nicht überschreiben
    } else if (localDoc._rev !== remoteDoc._rev) {
      if (remoteDoc.markedDeleted === true && !localDoc.markedDeleted) {
        await idbPut(db, {
          ...localDoc,
          _rev: remoteDoc._rev,
          _pendingDelete: remoteDoc.lastModifiedBy || 'Unbekannt'
        })
      } else {
        await idbPut(db, {
          ...remoteDoc,
          _remoteChanged: true,
          _changeTimestamp: Date.now()
        })
      }
      updatedCount++
      changedDocIds.push(remoteDoc._id)
    }
  }

  if (updatedCount > 0) console.log('Pulled', updatedCount, 'docs from remote')
  return { updated: updatedCount > 0, changedDocIds }
}

async function pushDirtyDocs(db) {
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    const allDocs = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const dirtyDocs = allDocs.filter(doc => doc._dirty)
    
    if (dirtyDocs.length > 0) {
      console.log('Pushing', dirtyDocs.length, 'local changes to remote')
      for (const doc of dirtyDocs) {
        const success = await syncToRemote(doc)
        if (success) {
          console.log('✓ Pushed', doc._id)
        }
      }
    }
  } catch (err) {
    // Silent fail
  }
}

export async function getAllDocs() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error getting all docs:', err)
    throw err
  }
}

export async function getDoc(id) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error getting doc:', err)
    throw err
  }
}

export async function putDoc(doc) {
  try {
    const db = await openDB()
    
    // Erst das bestehende Dokument holen (für lokale _rev)
    let existing = null
    try {
      existing = await getDoc(doc._id)
      // Behalte die _rev vom bestehenden Dokument (vom letzten Sync)
      if (existing && existing._rev) {
        doc._rev = existing._rev
      }
    } catch (err) {
      // Dokument existiert nicht, neue _rev wird beim Sync gesetzt
      doc._rev = `1-local-${Date.now()}`
    }

    // Per-Feld Timestamps tracken für konfliktfreies Mergen
    const now = new Date().toISOString()
    const existingTimestamps = existing?.fieldTimestamps || {}
    const newTimestamps = { ...existingTimestamps }
    for (const key of Object.keys(doc)) {
      if (key.startsWith('_') || key === 'updatedAt' || key === 'createdAt' || key === 'type') continue
      if (!existing || JSON.stringify(existing[key]) !== JSON.stringify(doc[key])) {
        newTimestamps[key] = now
      }
    }
    doc.fieldTimestamps = newTimestamps

    // Markiere Dokument als lokal geändert (noch nicht gesynct)
    doc._dirty = true
    doc._lastModified = Date.now()

    // Jetzt in neuer Transaktion speichern
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(doc)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // Sync to remote (fire and forget)
        syncToRemote(doc).catch(err => console.log('Remote sync failed:', err.message))
        resolve({ ok: true, id: doc._id, rev: doc._rev })
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error putting doc:', err)
    throw err
  }
}

// Entfernt ALLE internen Felder (alles mit _ außer _id und _rev) vor dem CouchDB-Upload
function prepareForUpload(doc) {
  const KEEP = new Set(['_id', '_rev'])
  const clean = {}
  for (const [key, val] of Object.entries(doc)) {
    if (key.startsWith('_') && !KEEP.has(key)) continue
    clean[key] = val
  }
  return clean
}

async function syncToRemote(doc) {
  try {
    // Erst die aktuelle _rev vom Server holen
    const getResponse = await fetch(`${COUCHDB_URL}/${doc._id}`, {
      headers: {
        'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`
      }
    })

    let remoteDoc = null
    if (getResponse.ok) {
      remoteDoc = await getResponse.json()
      doc._rev = remoteDoc._rev // Server-_rev verwenden
    }

    const docToUpload = prepareForUpload(doc)

    const response = await fetch(`${COUCHDB_URL}/${doc._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(docToUpload)
    })

    if (response.ok) {
      const result = await response.json()
      doc._rev = result.rev
      doc._dirty = false
      
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(doc)
      
      console.log('Synced to remote:', doc._id)
      return true
    } else if (response.status === 409) {
      console.warn('⚠️ Conflict detected for', doc._id, '- attempting field-level merge')
      const resolved = await resolveConflict(doc, remoteDoc)
      return resolved
    } else {
      const body = await response.text()
      console.error('Remote rejected doc', doc._id, response.status, body)
    }
  } catch (err) {
    console.log('Could not sync to remote (offline):', err.message)
    return false
  }
}

// Hilfsfunktion: IndexedDB put awaiten
function idbPut(db, doc) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(doc)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Conflict Resolution: markedDeleted → _pendingDelete Banner, alles andere → auto-merge
async function resolveConflict(localDoc, remoteDoc) {
  try {
    const getResponse = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
      headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` }
    })
    if (!getResponse.ok) return false
    const currentRemote = await getResponse.json()

    // Fall 1: Remote hat als gelöscht markiert, lokal nicht → Banner zeigen, NICHT anwenden
    if (currentRemote.markedDeleted === true && !localDoc.markedDeleted) {
      const pendingDoc = {
        ...localDoc,
        _rev: currentRemote._rev,
        _pendingDelete: currentRemote.lastModifiedBy || 'Unbekannt'
      }
      const db = await openDB()
      await idbPut(db, pendingDoc)
      console.log('⚠️ Pending delete banner set for:', localDoc._id)
      if (dataChangeCallback) dataChangeCallback()
      return true
    }

    // Fall 2: Lokal als gelöscht markiert, remote nicht → lokal gewinnt, hochladen
    if (localDoc.markedDeleted === true && !currentRemote.markedDeleted) {
      const docToUpload = { ...prepareForUpload(localDoc), _rev: currentRemote._rev }
      const resp = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(docToUpload)
      })
      if (resp.ok) {
        const result = await resp.json()
        const db = await openDB()
        await idbPut(db, { ...localDoc, _rev: result.rev, _dirty: false })
        if (dataChangeCallback) dataChangeCallback()
      }
      return true
    }

    // Fall 3: Sonstige Konflikte → auto-merge (letzter Schreiber per Feld gewinnt)
    const localTimestamps = localDoc.fieldTimestamps || {}
    const remoteTimestamps = currentRemote.fieldTimestamps || {}
    const mergedDoc = { ...currentRemote }
    const mergedTimestamps = { ...remoteTimestamps }
    const skip = new Set(['updatedAt', 'createdAt', 'type', 'list_id', 'deleted', 'fieldTimestamps'])

    for (const key of Object.keys(localDoc)) {
      if (key.startsWith('_') || skip.has(key)) continue
      if (localTimestamps[key] && !remoteTimestamps[key]) {
        mergedDoc[key] = localDoc[key]
        mergedTimestamps[key] = localTimestamps[key]
      }
    }
    mergedDoc.fieldTimestamps = mergedTimestamps
    mergedDoc._rev = currentRemote._rev

    const uploadResp = await fetch(`${COUCHDB_URL}/${localDoc._id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(prepareForUpload(mergedDoc))
    })
    if (uploadResp.ok) {
      const result = await uploadResp.json()
      const db = await openDB()
      await idbPut(db, { ...mergedDoc, _rev: result.rev, _dirty: false })
      console.log('✓ Auto-merged:', localDoc._id)
      if (dataChangeCallback) dataChangeCallback()
      return true
    }
    return false
  } catch (err) {
    console.error('Conflict resolution failed:', err)
    return false
  }
}

// User hat im Conflict-Dialog eine Version gewählt → auf Server pushen
export async function applyConflictResolution(docId, chosenDoc) {
  try {
    // Aktuelle Server-Rev holen
    const getResponse = await fetch(`${COUCHDB_URL}/${docId}`, {
      headers: {
        'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`
      }
    })

    let serverRev = chosenDoc._rev
    if (getResponse.ok) {
      const serverDoc = await getResponse.json()
      serverRev = serverDoc._rev
    }

    const docToUpload = { ...prepareForUpload(chosenDoc), _rev: serverRev }

    const response = await fetch(`${COUCHDB_URL}/${docId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(docToUpload)
    })

    if (response.ok) {
      const result = await response.json()
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const finalDoc = { ...docToUpload, _rev: result.rev, _dirty: false }
      tx.objectStore(STORE_NAME).put(finalDoc)
      console.log('✓ Conflict resolved by user:', docId)
      if (dataChangeCallback) dataChangeCallback()
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to apply conflict resolution:', err)
    return false
  }
}

// Ermögliche User die eigene Version wiederherzustellen
export async function restoreLocalVersion(docId, localVersion) {
  try {
    // Forciere die lokale Version
    const docToRestore = { ...localVersion }
    docToRestore._dirty = true
    docToRestore._lastModified = Date.now()
    docToRestore.updatedAt = new Date().toISOString()
    
    await putDoc(docToRestore)
    console.log('✓ Restored local version for:', docId)
    return true
  } catch (err) {
    console.error('Failed to restore local version:', err)
    return false
  }
}

export async function clearPendingDeleteFlag(docId) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(docId)
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const doc = request.result
        if (doc && doc._pendingDelete) {
          delete doc._pendingDelete
          store.put(doc)
        }
        resolve()
      }
      request.onerror = () => resolve()
    })
  } catch (err) {
    console.error('Error clearing pendingDelete flag:', err)
  }
}

export async function updateDoc(id, updateFn) {
  try {
    const doc = await getDoc(id)
    if (!doc) {
      throw new Error('Document not found')
    }
    const updatedDoc = updateFn(doc)
    return await putDoc(updatedDoc)
  } catch (err) {
    console.error('Error updating doc:', err)
    throw err
  }
}

export async function clearRemoteChangedFlag(docId) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(docId)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const doc = request.result
        if (doc && doc._remoteChanged) {
          delete doc._remoteChanged
          delete doc._changeTimestamp
          store.put(doc)
        }
        resolve()
      }
      request.onerror = () => resolve()
    })
  } catch (err) {
    console.error('Error clearing flag:', err)
  }
}

export async function createDoc(doc) {
  const newDoc = {
    ...doc,
    _id: doc._id || `${doc.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return await putDoc(newDoc)
}

export async function hardDeleteDoc(id) {
  try {
    const db = await openDB()
    // Aktuelle _rev holen (brauchen wir für CouchDB DELETE)
    const doc = await getDoc(id)
    
    // 1. Aus IndexedDB löschen
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // 2. Aus CouchDB löschen (braucht aktuelle _rev vom Server)
    try {
      const getResp = await fetch(`${COUCHDB_URL}/${id}`, {
        headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` }
      })
      if (getResp.ok) {
        const remoteDoc = await getResp.json()
        await fetch(`${COUCHDB_URL}/${id}?rev=${remoteDoc._rev}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}` }
        })
      }
    } catch (err) {
      // Offline - wird beim nächsten Sync nicht mehr hochgeladen da lokal gelöscht
      console.log('Could not delete from remote (offline):', err.message)
    }

    return { ok: true, id }
  } catch (err) {
    console.error('Error hard deleting doc:', err)
    throw err
  }
}

export async function deleteDoc(id) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve({ ok: true, id })
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error deleting doc:', err)
    throw err
  }
}

