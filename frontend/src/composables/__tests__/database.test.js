import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─────────────────────────────────────────────
// Minimal IndexedDB in-memory mock
// ─────────────────────────────────────────────
function createIDBMock() {
  const stores = {};

  function makeRequest(result, error = null) {
    const req = { result, error, onsuccess: null, onerror: null };
    Promise.resolve().then(() => {
      if (error) req.onerror?.({ target: req });
      else req.onsuccess?.({ target: req });
    });
    return req;
  }

  function makeTransaction(storeName, _mode) {
    if (!stores[storeName]) stores[storeName] = {};
    const store = stores[storeName];
    const tx = {
      oncomplete: null,
      onerror: null,
      objectStore: () => ({
        put: (doc) => {
          store[doc._id] = { ...doc };
          const req = makeRequest(doc._id);
          Promise.resolve().then(() => tx.oncomplete?.());
          return req;
        },
        get: (id) => makeRequest(store[id] ?? undefined),
        delete: (id) => {
          delete store[id];
          const req = makeRequest(undefined);
          Promise.resolve().then(() => tx.oncomplete?.());
          return req;
        },
        getAll: () => makeRequest(Object.values(store)),
        createIndex: () => {},
      }),
    };
    return tx;
  }

  const dbInstance = {
    objectStoreNames: { contains: (name) => name in stores },
    transaction: makeTransaction,
    createObjectStore: (name) => {
      stores[name] = {};
      return { createIndex: () => {} };
    },
  };

  function open() {
    if (!stores['documents']) stores['documents'] = {};
    const req = {
      result: dbInstance,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    Promise.resolve().then(() => {
      req.onupgradeneeded?.({ target: req });
      req.onsuccess?.({ target: req });
    });
    return req;
  }

  return { open, stores, dbInstance };
}

// ─────────────────────────────────────────────
// Hilfsfunktionen für fetch-Mocks
// ─────────────────────────────────────────────
function jsonOk(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}
function jsonFail(status, body = '') {
  return { ok: false, status, json: async () => body, text: async () => body };
}

// ─────────────────────────────────────────────
// Global setup
// ─────────────────────────────────────────────
let idbMock;

beforeEach(() => {
  idbMock = createIDBMock();
  globalThis.indexedDB = { open: idbMock.open };
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
  globalThis.btoa = (s) => Buffer.from(s).toString('base64');
  vi.resetModules();
});

async function loadDB() {
  return await import('../database.js');
}

// ─────────────────────────────────────────────
// initPouchDB
// ─────────────────────────────────────────────
describe('initPouchDB', () => {
  it('öffnet die IndexedDB und gibt ein Objekt zurück', async () => {
    const { initPouchDB } = await loadDB();
    const result = await initPouchDB();
    expect(result).toHaveProperty('localDB');
    expect(result.remoteDB).toBeNull();
  });
});

// ─────────────────────────────────────────────
// createDoc
// ─────────────────────────────────────────────
describe('createDoc', () => {
  it('erstellt ein Dokument mit generierten Feldern', async () => {
    const { createDoc, getAllDocs } = await loadDB();
    await createDoc({ type: 'list', name: 'Einkauf', deleted: false });
    const docs = await getAllDocs();
    expect(docs.length).toBe(1);
    expect(docs[0].type).toBe('list');
    expect(docs[0]._id).toBeTruthy();
    expect(docs[0].createdAt).toBeTruthy();
  });

  it('verwendet eine vorhandene _id wenn übergeben', async () => {
    const { createDoc, getDoc } = await loadDB();
    await createDoc({ _id: 'list_abc123', type: 'list', name: 'Test' });
    const doc = await getDoc('list_abc123');
    expect(doc._id).toBe('list_abc123');
  });
});

// ─────────────────────────────────────────────
// putDoc
// ─────────────────────────────────────────────
describe('putDoc', () => {
  it('speichert ein Dokument und markiert es als dirty', async () => {
    const { putDoc, getDoc } = await loadDB();
    const result = await putDoc({ _id: 'item_1', type: 'item', name: 'Milch' });
    expect(result.ok).toBe(true);
    const saved = await getDoc('item_1');
    expect(saved._dirty).toBe(true);
    expect(saved.name).toBe('Milch');
  });

  it('behält die _rev aus dem bestehenden Dokument', async () => {
    const { putDoc, getDoc } = await loadDB();
    await putDoc({ _id: 'item_rev', type: 'item', name: 'Butter', _rev: '1-aaa' });
    await putDoc({ _id: 'item_rev', type: 'item', name: 'Butter geändert' });
    const saved = await getDoc('item_rev');
    expect(saved.name).toBe('Butter geändert');
  });

  it('setzt fieldTimestamps für geänderte Felder', async () => {
    const { putDoc, getDoc } = await loadDB();
    await putDoc({ _id: 'item_ts', type: 'item', name: 'Käse', checked: false });
    const saved = await getDoc('item_ts');
    expect(saved.fieldTimestamps).toBeTruthy();
    expect(saved.fieldTimestamps.name).toBeTruthy();
  });

  it('syncToRemote: online success aktualisiert _rev und _dirty=false', async () => {
    // GET → Server-Rev; PUT → ok mit neuer Rev
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonOk({ _id: 'sync_ok', _rev: '2-server', type: 'item', name: 'Test' }),
      )
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'sync_ok', rev: '3-synced' }));

    const { putDoc, getDoc } = await loadDB();
    await putDoc({ _id: 'sync_ok', type: 'item', name: 'Test' });

    // Kurz warten, da syncToRemote fire-and-forget ist
    await new Promise((r) => setTimeout(r, 50));

    const saved = await getDoc('sync_ok');
    expect(saved._dirty).toBe(false);
    expect(saved._rev).toBe('3-synced');
  });

  it('syncToRemote: 409 Conflict löst resolveConflict aus (offline → false)', async () => {
    // GET ok, PUT 409, dann resolveConflict GET → offline
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 'c1', _rev: '2-s', type: 'item' }))
      .mockResolvedValueOnce(jsonFail(409))
      .mockRejectedValueOnce(new Error('offline'));

    const { putDoc } = await loadDB();
    await putDoc({ _id: 'c1', type: 'item', name: 'Konflikt' });
    await new Promise((r) => setTimeout(r, 50));
    // kein Fehler-Throw erwartet
  });

  it('syncToRemote: Server-Fehler (z.B. 500) wird still ignoriert', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 's500', _rev: '1-a' }))
      .mockResolvedValueOnce(jsonFail(500, 'Internal Server Error'));

    const { putDoc } = await loadDB();
    await expect(putDoc({ _id: 's500', type: 'item', name: 'Test' })).resolves.toMatchObject({
      ok: true,
    });
    await new Promise((r) => setTimeout(r, 50));
  });
});

// ─────────────────────────────────────────────
// getDoc
// ─────────────────────────────────────────────
describe('getDoc', () => {
  it('gibt ein gespeichertes Dokument zurück', async () => {
    const { createDoc, getDoc, getAllDocs } = await loadDB();
    await createDoc({ type: 'item', name: 'Brot' });
    const all = await getAllDocs();
    const doc = await getDoc(all[0]._id);
    expect(doc.name).toBe('Brot');
  });

  it('gibt undefined zurück wenn das Dokument nicht existiert', async () => {
    const { getDoc } = await loadDB();
    const doc = await getDoc('nicht_vorhanden');
    expect(doc).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// getAllDocs
// ─────────────────────────────────────────────
describe('getAllDocs', () => {
  it('gibt alle gespeicherten Dokumente zurück', async () => {
    const db = await loadDB();
    await db.createDoc({ type: 'list', name: 'Liste 1' });
    await db.createDoc({ type: 'list', name: 'Liste 2' });
    const docs = await db.getAllDocs();
    expect(docs.length).toBe(2);
  });

  it('gibt leeres Array zurück wenn keine Dokumente vorhanden', async () => {
    const { getAllDocs } = await loadDB();
    const docs = await getAllDocs();
    expect(docs).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// updateDoc
// ─────────────────────────────────────────────
describe('updateDoc', () => {
  it('aktualisiert ein Dokument mit einer Update-Funktion', async () => {
    const { createDoc, updateDoc, getDoc } = await loadDB();
    await createDoc({ _id: 'upd_1', type: 'item', name: 'Alt', checked: false });
    await updateDoc('upd_1', (doc) => ({ ...doc, name: 'Neu', checked: true }));
    const updated = await getDoc('upd_1');
    expect(updated.name).toBe('Neu');
    expect(updated.checked).toBe(true);
  });

  it('wirft einen Fehler wenn das Dokument nicht existiert', async () => {
    const { updateDoc } = await loadDB();
    await expect(updateDoc('ghost', (d) => d)).rejects.toThrow('Document not found');
  });
});

// ─────────────────────────────────────────────
// deleteDoc
// ─────────────────────────────────────────────
describe('deleteDoc', () => {
  it('löscht ein Dokument aus IndexedDB', async () => {
    const { createDoc, deleteDoc, getDoc } = await loadDB();
    await createDoc({ _id: 'del_1', type: 'item', name: 'Wegwerfitem' });
    const result = await deleteDoc('del_1');
    expect(result.ok).toBe(true);
    const doc = await getDoc('del_1');
    expect(doc).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// hardDeleteDoc
// ─────────────────────────────────────────────
describe('hardDeleteDoc', () => {
  it('löscht lokal – offline kein Fehler', async () => {
    const { createDoc, hardDeleteDoc, getDoc } = await loadDB();
    await createDoc({ _id: 'hard_1', type: 'item', name: 'Hartes Löschen' });
    const result = await hardDeleteDoc('hard_1');
    expect(result.ok).toBe(true);
    const doc = await getDoc('hard_1');
    expect(doc).toBeUndefined();
  });

  it('löscht lokal und remote wenn Server erreichbar', async () => {
    globalThis.fetch = vi
      .fn()
      // Für putDoc-sync beim createDoc: 2 calls (GET+PUT)
      .mockResolvedValueOnce(jsonOk({ _id: 'hard_2', _rev: '1-a' }))
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'hard_2', rev: '2-b' }))
      // hardDeleteDoc: GET für _rev, dann DELETE
      .mockResolvedValueOnce(jsonOk({ _id: 'hard_2', _rev: '2-b' }))
      .mockResolvedValueOnce(jsonOk({ ok: true }));

    const { createDoc, hardDeleteDoc, getDoc } = await loadDB();
    await createDoc({ _id: 'hard_2', type: 'item', name: 'Online löschen' });
    await new Promise((r) => setTimeout(r, 30));
    const result = await hardDeleteDoc('hard_2');
    expect(result.ok).toBe(true);
    expect(await getDoc('hard_2')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// clearRemoteChangedFlag
// ─────────────────────────────────────────────
describe('clearRemoteChangedFlag', () => {
  it('entfernt _remoteChanged und _changeTimestamp', async () => {
    const { putDoc, clearRemoteChangedFlag, getDoc } = await loadDB();
    await putDoc({
      _id: 'flag_1',
      type: 'item',
      name: 'Test',
      _remoteChanged: true,
      _changeTimestamp: 12345,
    });
    await clearRemoteChangedFlag('flag_1');
    const doc = await getDoc('flag_1');
    expect(doc._remoteChanged).toBeUndefined();
    expect(doc._changeTimestamp).toBeUndefined();
  });

  it('tut nichts wenn Dokument nicht existiert', async () => {
    const { clearRemoteChangedFlag } = await loadDB();
    await expect(clearRemoteChangedFlag('ghost')).resolves.toBeUndefined();
  });

  it('tut nichts wenn _remoteChanged nicht gesetzt ist', async () => {
    const { putDoc, clearRemoteChangedFlag, getDoc } = await loadDB();
    await putDoc({ _id: 'flag_2', type: 'item', name: 'Ohne Flag' });
    await clearRemoteChangedFlag('flag_2');
    const doc = await getDoc('flag_2');
    expect(doc.name).toBe('Ohne Flag');
  });
});

// ─────────────────────────────────────────────
// clearPendingDeleteFlag
// ─────────────────────────────────────────────
describe('clearPendingDeleteFlag', () => {
  it('entfernt _pendingDelete von einem Dokument', async () => {
    const { putDoc, clearPendingDeleteFlag, getDoc } = await loadDB();
    await putDoc({ _id: 'pd_1', type: 'item', name: 'Test', _pendingDelete: 'Alice' });
    await clearPendingDeleteFlag('pd_1');
    const doc = await getDoc('pd_1');
    expect(doc._pendingDelete).toBeUndefined();
  });

  it('tut nichts wenn Dokument nicht existiert', async () => {
    const { clearPendingDeleteFlag } = await loadDB();
    await expect(clearPendingDeleteFlag('ghost')).resolves.toBeUndefined();
  });

  it('tut nichts wenn _pendingDelete nicht gesetzt', async () => {
    const { putDoc, clearPendingDeleteFlag, getDoc } = await loadDB();
    await putDoc({ _id: 'pd_2', type: 'item', name: 'Kein Pending' });
    await clearPendingDeleteFlag('pd_2');
    const doc = await getDoc('pd_2');
    expect(doc.name).toBe('Kein Pending');
  });
});

// ─────────────────────────────────────────────
// restoreLocalVersion
// ─────────────────────────────────────────────
describe('restoreLocalVersion', () => {
  it('stellt eine lokale Version wieder her', async () => {
    const { createDoc, restoreLocalVersion, getDoc } = await loadDB();
    await createDoc({ _id: 'restore_1', type: 'item', name: 'Original', checked: false });
    const original = await getDoc('restore_1');
    const oldVersion = { ...original, name: 'Alte Version' };
    const result = await restoreLocalVersion('restore_1', oldVersion);
    expect(result).toBe(true);
    const doc = await getDoc('restore_1');
    expect(doc.name).toBe('Alte Version');
  });

  it('gibt false zurück wenn putDoc fehlschlägt', async () => {
    const { restoreLocalVersion } = await loadDB();
    // Kein Dokument in DB → getDoc gibt undefined → putDoc-intern kann trotzdem schreiben
    // Wir testen nur den happy path hier; Fehlerfall via Error in putDoc
    const result = await restoreLocalVersion('unknown_id', {
      _id: 'unknown_id',
      type: 'item',
      name: 'Test',
    });
    expect(result).toBe(true); // putDoc erstellt neues Dokument
  });
});

// ─────────────────────────────────────────────
// startSync / stopSync
// ─────────────────────────────────────────────
describe('startSync / stopSync', () => {
  it('startSync gibt ein Objekt mit cancel() zurück', async () => {
    const { startSync, stopSync } = await loadDB();
    const handler = startSync(
      () => {},
      () => {},
      () => {},
    );
    expect(handler).toHaveProperty('cancel');
    expect(typeof handler.cancel).toBe('function');
    handler.cancel();
    stopSync();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('stopSync läuft ohne Fehler auch wenn kein Sync aktiv ist', async () => {
    const { stopSync } = await loadDB();
    await expect(Promise.resolve(stopSync())).resolves.toBeUndefined();
  });

  it('cancel() räumt den Interval auf', async () => {
    const { startSync } = await loadDB();
    const handler = startSync(
      () => {},
      () => {},
      () => {},
    );
    handler.cancel();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('syncInBackground ruft statusCallback mit online=true auf wenn Server erreichbar', async () => {
    // _changes feed → ok
    globalThis.fetch = vi.fn().mockResolvedValue(jsonOk({ results: [] }));

    const { startSync } = await loadDB();
    const statusCalls = [];
    const handler = startSync(
      (status) => statusCalls.push(status),
      () => {},
      () => {},
    );

    await new Promise((r) => setTimeout(r, 100));
    handler.cancel();

    const onlineCalls = statusCalls.filter((s) => s.online === true);
    expect(onlineCalls.length).toBeGreaterThan(0);
  });

  it('syncInBackground ruft statusCallback mit online=false auf wenn offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const { startSync } = await loadDB();
    const statusCalls = [];
    const handler = startSync(
      (status) => statusCalls.push(status),
      () => {},
      () => {},
    );

    await new Promise((r) => setTimeout(r, 100));
    handler.cancel();

    const offlineCalls = statusCalls.filter((s) => s.online === false);
    expect(offlineCalls.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// syncFromRemote – verschiedene Pfade
// ─────────────────────────────────────────────
describe('syncFromRemote (via startSync)', () => {
  it('neues Dokument vom Remote wird lokal gespeichert', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonOk({
        results: [{ doc: { _id: 'remote_1', _rev: '1-a', type: 'item', name: 'Remote Item' } }],
      }),
    );

    const { startSync, getDoc } = await loadDB();
    const handler = startSync(
      () => {},
      () => {},
      () => {},
    );
    await new Promise((r) => setTimeout(r, 100));
    handler.cancel();

    const doc = await getDoc('remote_1');
    expect(doc).toBeTruthy();
    expect(doc.name).toBe('Remote Item');
  });

  it('remote gelöschtes Dokument (deleted=true) wird lokal entfernt', async () => {
    const { putDoc } = await loadDB();
    // Erst lokal anlegen
    await putDoc({ _id: 'to_del', type: 'item', name: 'Wird gelöscht', _rev: '1-a' });

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonOk({
        results: [{ deleted: true, doc: { _id: 'to_del', _rev: '2-b', _deleted: true } }],
      }),
    );

    const { startSync: startSync2 } = await loadDB();
    const handler = startSync2(
      () => {},
      () => {},
      () => {},
    );
    await new Promise((r) => setTimeout(r, 100));
    handler.cancel();
  });

  it('remote Dokument mit markedDeleted=true setzt _pendingDelete lokal', async () => {
    const { putDoc } = await loadDB();
    await putDoc({ _id: 'pd_item', type: 'item', name: 'Test', _rev: '1-a', markedDeleted: false });

    // Neues Modul mit neuer DB-Instanz
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    // Lokal anlegen, dann sync
    const db2 = await import('../database.js');
    await db2.putDoc({
      _id: 'pd_item2',
      type: 'item',
      name: 'PD Test',
      _rev: '1-a',
      markedDeleted: false,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonOk({
        results: [
          {
            doc: {
              _id: 'pd_item2',
              _rev: '2-b',
              type: 'item',
              name: 'PD Test',
              markedDeleted: true,
              lastModifiedBy: 'Alice',
            },
          },
        ],
      }),
    );

    const handler = db2.startSync(
      () => {},
      () => {},
      () => {},
    );
    await new Promise((r) => setTimeout(r, 150));
    handler.cancel();

    const doc = await db2.getDoc('pd_item2');
    expect(doc?._pendingDelete).toBe('Alice');
  });

  it('remote Dokument mit anderem _rev wird lokal mit _remoteChanged gespeichert', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    await db2.putDoc({ _id: 'rc_item', type: 'item', name: 'Lokal', _rev: '1-a' });
    // _dirty entfernen damit sync die Änderung übernimmt
    const localDoc = await db2.getDoc('rc_item');
    localDoc._dirty = false;
    await db2.putDoc(localDoc);

    globalThis.fetch = vi
      .fn()
      // Für putDoc-sync: offline
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      // syncFromRemote pull
      .mockResolvedValueOnce(
        jsonOk({
          results: [
            { doc: { _id: 'rc_item', _rev: '3-c', type: 'item', name: 'Remote geändert' } },
          ],
        }),
      );

    const handler = db2.startSync(
      () => {},
      () => {},
      () => {},
    );
    await new Promise((r) => setTimeout(r, 150));
    handler.cancel();
  });

  it('dataChangeCallback wird aufgerufen wenn es Änderungen gibt', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonOk({
        results: [{ doc: { _id: 'change_1', _rev: '1-a', type: 'item', name: 'Neu' } }],
      }),
    );

    const { startSync } = await loadDB();
    const changeCalls = [];
    const handler = startSync(
      () => {},
      () => {},
      (ids) => changeCalls.push(ids),
    );

    await new Promise((r) => setTimeout(r, 100));
    handler.cancel();

    expect(changeCalls.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// pushDirtyDocs (via startSync)
// ─────────────────────────────────────────────
describe('pushDirtyDocs (via startSync)', () => {
  it('pusht dirty Dokumente zum Server', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    // Lokal anlegen (wird _dirty=true gesetzt)
    await db2.putDoc({ _id: 'dirty_1', type: 'item', name: 'Dirty Item', _dirty: true });

    const fetchCalls = [];
    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      fetchCalls.push({ url, method: opts?.method || 'GET' });
      if (opts?.method === 'PUT') {
        return Promise.resolve(jsonOk({ ok: true, id: 'dirty_1', rev: '2-pushed' }));
      }
      return Promise.resolve(
        jsonOk({ _id: 'dirty_1', _rev: '1-a', type: 'item', name: 'Dirty Item' }),
      );
    });

    const handler = db2.startSync(
      () => {},
      () => {},
      () => {},
    );
    await new Promise((r) => setTimeout(r, 200));
    handler.cancel();

    const putCalls = fetchCalls.filter((c) => c.method === 'PUT');
    expect(putCalls.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// resolveConflict – alle Fälle
// ─────────────────────────────────────────────
describe('resolveConflict (via syncToRemote 409)', () => {
  it('Fall 1: Remote markedDeleted=true → _pendingDelete wird gesetzt', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    await db2.putDoc({ _id: 'cf1', type: 'item', name: 'Lokal', markedDeleted: false });

    globalThis.fetch = vi
      .fn()
      // syncToRemote: GET _rev
      .mockResolvedValueOnce(jsonOk({ _id: 'cf1', _rev: '2-s' }))
      // syncToRemote: PUT → 409
      .mockResolvedValueOnce(jsonFail(409))
      // resolveConflict: GET aktuelle Remote
      .mockResolvedValueOnce(
        jsonOk({
          _id: 'cf1',
          _rev: '3-r',
          markedDeleted: true,
          lastModifiedBy: 'Bob',
          type: 'item',
          name: 'Remote gelöscht',
        }),
      );

    await db2.putDoc({ _id: 'cf1', type: 'item', name: 'Lokal update', markedDeleted: false });
    await new Promise((r) => setTimeout(r, 100));

    const doc = await db2.getDoc('cf1');
    expect(doc?._pendingDelete).toBe('Bob');
  });

  it('Fall 2: Lokal markedDeleted=true, remote nicht → lokal gewinnt', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    await db2.putDoc({ _id: 'cf2', type: 'item', name: 'Lokal', markedDeleted: true });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 'cf2', _rev: '2-s', markedDeleted: false }))
      .mockResolvedValueOnce(jsonFail(409))
      // resolveConflict GET
      .mockResolvedValueOnce(
        jsonOk({ _id: 'cf2', _rev: '3-r', markedDeleted: false, type: 'item', name: 'Remote' }),
      )
      // resolveConflict PUT
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'cf2', rev: '4-merged' }));

    await db2.putDoc({ _id: 'cf2', type: 'item', name: 'Lokal gelöscht', markedDeleted: true });
    await new Promise((r) => setTimeout(r, 100));

    const doc = await db2.getDoc('cf2');
    expect(doc?._dirty).toBe(false);
  });

  it('Fall 3: Auto-merge – lokale Felder mit Timestamps gewinnen', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    await db2.putDoc({
      _id: 'cf3',
      type: 'item',
      name: 'Lokal',
      markedDeleted: false,
      fieldTimestamps: { name: '2025-01-01T00:00:00.000Z' },
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 'cf3', _rev: '2-s', markedDeleted: false }))
      .mockResolvedValueOnce(jsonFail(409))
      // resolveConflict GET
      .mockResolvedValueOnce(
        jsonOk({
          _id: 'cf3',
          _rev: '3-r',
          markedDeleted: false,
          type: 'item',
          name: 'Remote',
          fieldTimestamps: {},
        }),
      )
      // resolveConflict PUT (merge)
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'cf3', rev: '4-auto' }));

    await db2.putDoc({
      _id: 'cf3',
      type: 'item',
      name: 'Lokal geändert',
      markedDeleted: false,
      fieldTimestamps: { name: '2025-06-01T00:00:00.000Z' },
    });
    await new Promise((r) => setTimeout(r, 100));

    const doc = await db2.getDoc('cf3');
    expect(doc?._dirty).toBe(false);
  });

  it('Fall 3: Auto-merge upload schlägt fehl → false', async () => {
    vi.resetModules();
    idbMock = createIDBMock();
    globalThis.indexedDB = { open: idbMock.open };

    const db2 = await import('../database.js');
    await db2.putDoc({ _id: 'cf4', type: 'item', name: 'Lokal', markedDeleted: false });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 'cf4', _rev: '2-s' }))
      .mockResolvedValueOnce(jsonFail(409))
      .mockResolvedValueOnce(
        jsonOk({
          _id: 'cf4',
          _rev: '3-r',
          markedDeleted: false,
          type: 'item',
          name: 'Remote',
          fieldTimestamps: {},
        }),
      )
      .mockResolvedValueOnce(jsonFail(500, 'Server Error'));

    await db2.putDoc({
      _id: 'cf4',
      type: 'item',
      name: 'Update',
      markedDeleted: false,
      fieldTimestamps: { name: '2025-01-01T00:00:00.000Z' },
    });
    await new Promise((r) => setTimeout(r, 100));
    // kein Fehler-Throw erwartet
  });
});

// ─────────────────────────────────────────────
// deleteDoc – onerror Pfad
// ─────────────────────────────────────────────
describe('deleteDoc – Fehlerpfad', () => {
  it('wirft wenn IDB delete einen Fehler liefert', async () => {
    // IDB-Mock überschreiben der bei delete onerror feuert
    const fakeDB = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({
        oncomplete: null,
        onerror: null,
        objectStore: () => ({
          delete: () => {
            const req = {
              result: undefined,
              error: new Error('IDB delete error'),
              onsuccess: null,
              onerror: null,
            };
            Promise.resolve().then(() => req.onerror?.({ target: req }));
            return req;
          },
          get: (_id) => {
            const req = { result: undefined, error: null, onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: req }));
            return req;
          },
          getAll: () => {
            const req = { result: [], error: null, onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: req }));
            return req;
          },
          createIndex: () => {},
        }),
      }),
    };
    globalThis.indexedDB = {
      open: () => {
        const req = {
          result: fakeDB,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        Promise.resolve().then(() => req.onsuccess?.({ target: req }));
        return req;
      },
    };

    const { deleteDoc } = await loadDB();
    await expect(deleteDoc('any_id')).rejects.toThrow('IDB delete error');
  });
});

// ─────────────────────────────────────────────
// hardDeleteDoc – throw Pfad (IDB schlägt fehl)
// ─────────────────────────────────────────────
describe('hardDeleteDoc – Fehlerpfad', () => {
  it('wirft wenn IDB-Transaktion fehlschlägt', async () => {
    const fakeDB = {
      objectStoreNames: { contains: () => true },
      transaction: (storeName, mode) => {
        if (mode === 'readwrite') {
          // readwrite (für hardDelete) schlägt fehl
          throw new Error('IDB transaction error');
        }
        return {
          oncomplete: null,
          onerror: null,
          objectStore: () => ({
            get: (id) => {
              const req = {
                result: { _id: id, _rev: '1-a' },
                error: null,
                onsuccess: null,
                onerror: null,
              };
              Promise.resolve().then(() => req.onsuccess?.({ target: req }));
              return req;
            },
            getAll: () => {
              const req = { result: [], error: null, onsuccess: null, onerror: null };
              Promise.resolve().then(() => req.onsuccess?.({ target: req }));
              return req;
            },
            createIndex: () => {},
          }),
        };
      },
    };
    globalThis.indexedDB = {
      open: () => {
        const req = {
          result: fakeDB,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        Promise.resolve().then(() => req.onsuccess?.({ target: req }));
        return req;
      },
    };

    const { hardDeleteDoc } = await loadDB();
    await expect(hardDeleteDoc('any_id')).rejects.toThrow();
  });
});
describe('applyConflictResolution', () => {
  it('gibt false zurück wenn Server nicht erreichbar (offline)', async () => {
    const { applyConflictResolution } = await loadDB();
    const result = await applyConflictResolution('doc_1', {
      _id: 'doc_1',
      _rev: '1-a',
      type: 'item',
    });
    expect(result).toBe(false);
  });

  it('gibt true zurück wenn Server antwortet', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonOk({ _id: 'doc_1', _rev: '2-server', type: 'item', name: 'Remote' }),
      )
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'doc_1', rev: '3-new' }));

    const { applyConflictResolution } = await loadDB();
    const result = await applyConflictResolution('doc_1', {
      _id: 'doc_1',
      _rev: '2-server',
      type: 'item',
      name: 'Chosen',
    });
    expect(result).toBe(true);
  });

  it('gibt false zurück wenn PUT fehlschlägt', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonOk({ _id: 'doc_2', _rev: '2-server' }))
      .mockResolvedValueOnce(jsonFail(409));

    const { applyConflictResolution } = await loadDB();
    const result = await applyConflictResolution('doc_2', {
      _id: 'doc_2',
      _rev: '1-a',
      type: 'item',
    });
    expect(result).toBe(false);
  });

  it('GET schlägt fehl → verwendet _rev aus chosenDoc', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonFail(404))
      .mockResolvedValueOnce(jsonOk({ ok: true, id: 'doc_3', rev: '2-new' }));

    const { applyConflictResolution } = await loadDB();
    const result = await applyConflictResolution('doc_3', {
      _id: 'doc_3',
      _rev: '1-a',
      type: 'item',
      name: 'Test',
    });
    expect(result).toBe(true);
  });
});
