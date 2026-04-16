/**
 * Unit-Tests für U12: JSON-Backup
 *  - exportBackup: korrekte JSON-Struktur, Dateiname, nur Items der Zielliste
 *  - importBackup: neue Liste anlegen, Items übernehmen, Fehlerbehandlung
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, onMounted: vi.fn((fn) => fn()), onUnmounted: vi.fn() };
});

vi.mock('../database.js', () => ({
  startSync: vi.fn(() => ({ cancel: vi.fn() })),
  stopSync: vi.fn(),
  getAllDocs: vi.fn(async () => []),
  updateDoc: vi.fn(async (id, fn) => { const d = { _id: id }; fn(d); return { ok: true, id, rev: '2' }; }),
  createDoc: vi.fn(async () => ({ ok: true, id: 'new_list_id' })),
  hardDeleteDoc: vi.fn(async () => ({ ok: true })),
  restoreLocalVersion: vi.fn(async () => true),
  clearRemoteChangedFlag: vi.fn(async () => {}),
  applyConflictResolution: vi.fn(async () => true),
  clearPendingDeleteFlag: vi.fn(async () => {}),
  findListByShareCode: vi.fn(async () => null),
  fetchItemsForListFromRemote: vi.fn(async () => []),
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ currentUser: ref({ name: 'TestUser', roles: [] }) }),
}));

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function getDb() {
  return await import('../database.js');
}

async function setupComposable(lists = [], items = []) {
  const db = await getDb();
  db.getAllDocs.mockResolvedValue([...lists, ...items]);
  const { useShoppingList } = await import('../useShoppingList.js');
  return useShoppingList();
}

const LIST_1 = { _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false, createdAt: '2026-01-01T00:00:00.000Z' };
const LIST_2 = { _id: 'list2', type: 'list', name: 'Baumarkt', owner: 'TestUser', deleted: false, createdAt: '2026-01-02T00:00:00.000Z' };
const ITEM_L1_A = { _id: 'i1', type: 'item', list_id: 'list1', name: 'Milch', checked: false, markedDeleted: false, note: 'Bio', label: 'green', deleted: false };
const ITEM_L1_B = { _id: 'i2', type: 'item', list_id: 'list1', name: 'Brot', checked: true, markedDeleted: false, note: null, label: null, deleted: false };
const ITEM_L2_A = { _id: 'i3', type: 'item', list_id: 'list2', name: 'Schraube', checked: false, markedDeleted: false, note: null, label: null, deleted: false };

// ── exportBackup – Grundverhalten ─────────────────────────────────────────────

describe('exportBackup – Grundverhalten', () => {
  let anchorClick;
  let anchorHref;
  let anchorDownload;

  beforeEach(() => {
    anchorClick = vi.fn();
    anchorHref = null;
    anchorDownload = null;

    // URL-Methoden spyen ohne den Konstruktor zu überschreiben
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Anchor-Element abfangen
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const a = realCreate('a');
        Object.defineProperty(a, 'href', { set(v) { anchorHref = v; }, get() { return anchorHref; } });
        Object.defineProperty(a, 'download', { set(v) { anchorDownload = v; }, get() { return anchorDownload; } });
        a.click = anchorClick;
        return a;
      }
      return realCreate(tag);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('tut nichts wenn die Liste nicht existiert', async () => {
    const { exportBackup } = await setupComposable([LIST_1], []);
    exportBackup('nicht-vorhanden');
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('triggert einen Datei-Download (click auf Anchor)', async () => {
    const { exportBackup } = await setupComposable([LIST_1], [ITEM_L1_A]);
    exportBackup('list1');
    expect(anchorClick).toHaveBeenCalledOnce();
  });

  it('gibt URL nach dem Download frei (revokeObjectURL)', async () => {
    const { exportBackup } = await setupComposable([LIST_1], [ITEM_L1_A]);
    exportBackup('list1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('Dateiname beginnt mit "backup-" und endet auf ".json"', async () => {
    const { exportBackup } = await setupComposable([LIST_1], [ITEM_L1_A]);
    exportBackup('list1');
    expect(anchorDownload).toMatch(/^backup-/);
    expect(anchorDownload).toMatch(/\.json$/);
  });

  it('Dateiname enthält den Listennamen (sanitized)', async () => {
    const { exportBackup } = await setupComposable([LIST_1], [ITEM_L1_A]);
    exportBackup('list1');
    expect(anchorDownload).toContain('einkauf');
  });

  it('Dateiname enthält einen ISO-Zeitstempel', async () => {
    const { exportBackup } = await setupComposable([LIST_1], [ITEM_L1_A]);
    exportBackup('list1');
    expect(anchorDownload).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });
});

// ── exportBackup – JSON-Inhalt ────────────────────────────────────────────────

describe('exportBackup – JSON-Inhalt', () => {
  let capturedBlob;

  beforeEach(() => {
    capturedBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { capturedBlob = blob; return 'blob:mock'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { set href(_) {}, set download(_) {}, click: vi.fn() };
      return realCreate(tag);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function getExportedPayload(lists, items, listId) {
    const { exportBackup } = await setupComposable(lists, items);
    exportBackup(listId);
    const text = await capturedBlob.text();
    return JSON.parse(text);
  }

  it('enthält exportedAt als ISO-String', async () => {
    const payload = await getExportedPayload([LIST_1], [ITEM_L1_A], 'list1');
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('enthält exportedBy mit dem aktuellen User', async () => {
    const payload = await getExportedPayload([LIST_1], [ITEM_L1_A], 'list1');
    expect(payload.exportedBy).toBe('TestUser');
  });

  it('enthält den Listennamen', async () => {
    const payload = await getExportedPayload([LIST_1], [ITEM_L1_A], 'list1');
    expect(payload.list.name).toBe('Einkauf');
  });

  it('enthält nur Items der exportierten Liste', async () => {
    const payload = await getExportedPayload([LIST_1, LIST_2], [ITEM_L1_A, ITEM_L1_B, ITEM_L2_A], 'list1');
    expect(payload.list.items).toHaveLength(2);
    const names = payload.list.items.map((i) => i.name);
    expect(names).toContain('Milch');
    expect(names).toContain('Brot');
    expect(names).not.toContain('Schraube');
  });

  it('exportiert Item-Felder: name, checked, note, label, markedDeleted', async () => {
    const payload = await getExportedPayload([LIST_1], [ITEM_L1_A], 'list1');
    const item = payload.list.items[0];
    expect(item).toMatchObject({ name: 'Milch', checked: false, note: 'Bio', label: 'green', markedDeleted: false });
  });

  it('exportiert keine internen DB-Felder (_id, _rev, type, list_id)', async () => {
    const payload = await getExportedPayload([LIST_1], [ITEM_L1_A], 'list1');
    const item = payload.list.items[0];
    expect(item).not.toHaveProperty('_id');
    expect(item).not.toHaveProperty('_rev');
    expect(item).not.toHaveProperty('type');
    expect(item).not.toHaveProperty('list_id');
  });

  it('exportiert eine Liste ohne Items als leeres Array', async () => {
    const payload = await getExportedPayload([LIST_1], [], 'list1');
    expect(payload.list.items).toEqual([]);
  });
});

// ── importBackup – Fehlerbehandlung ──────────────────────────────────────────

describe('importBackup – Fehlerbehandlung', () => {
  it('wirft einen Fehler bei null', async () => {
    const { importBackup } = await setupComposable();
    await expect(importBackup(null)).rejects.toThrow('Ungültiges Backup-Format');
  });

  it('wirft einen Fehler wenn list fehlt', async () => {
    const { importBackup } = await setupComposable();
    await expect(importBackup({ exportedAt: '2026-01-01' })).rejects.toThrow('Ungültiges Backup-Format');
  });

  it('wirft einen Fehler wenn list.name fehlt', async () => {
    const { importBackup } = await setupComposable();
    await expect(importBackup({ list: { items: [] } })).rejects.toThrow('Ungültiges Backup-Format');
  });
});

// ── importBackup – Liste & Items anlegen ──────────────────────────────────────

describe('importBackup – Liste & Items anlegen', () => {
  beforeEach(async () => {
    const db = await getDb();
    db.createDoc.mockReset();
    db.createDoc.mockResolvedValue({ ok: true, id: 'imported_list_id' });
    db.getAllDocs.mockResolvedValue([]);
  });

  const validPayload = {
    exportedAt: '2026-01-01T00:00:00.000Z',
    exportedBy: 'TestUser',
    list: {
      name: 'Einkauf',
      owner: 'TestUser',
      items: [
        { name: 'Milch', checked: false, note: 'Bio', label: 'green', markedDeleted: false },
        { name: 'Brot', checked: true, note: null, label: null, markedDeleted: false },
      ],
    },
  };

  it('legt eine neue Liste mit "(Backup)" im Namen an', async () => {
    const db = await getDb();
    const { importBackup } = await setupComposable();
    await importBackup(validPayload);
    const listCall = db.createDoc.mock.calls.find((c) => c[0].type === 'list');
    expect(listCall[0].name).toBe('Einkauf (Backup)');
  });

  it('setzt type: "list" beim Anlegen der Liste', async () => {
    const db = await getDb();
    const { importBackup } = await setupComposable();
    await importBackup(validPayload);
    const listCall = db.createDoc.mock.calls.find((c) => c[0].type === 'list');
    expect(listCall[0].type).toBe('list');
  });

  it('legt für jedes Item ein Dokument an', async () => {
    const db = await getDb();
    const { importBackup } = await setupComposable();
    await importBackup(validPayload);
    const itemCalls = db.createDoc.mock.calls.filter((c) => c[0].type === 'item');
    expect(itemCalls).toHaveLength(2);
  });

  it('verknüpft Items mit der neu erstellten Liste (list_id)', async () => {
    const db = await getDb();
    const { importBackup } = await setupComposable();
    await importBackup(validPayload);
    const itemCalls = db.createDoc.mock.calls.filter((c) => c[0].type === 'item');
    itemCalls.forEach((call) => expect(call[0].list_id).toBe('imported_list_id'));
  });

  it('übernimmt name, checked, note und label der Items', async () => {
    const db = await getDb();
    const { importBackup } = await setupComposable();
    await importBackup(validPayload);
    const itemCalls = db.createDoc.mock.calls.filter((c) => c[0].type === 'item');
    const milch = itemCalls.find((c) => c[0].name === 'Milch')[0];
    expect(milch).toMatchObject({ name: 'Milch', checked: false, note: 'Bio', label: 'green' });
  });

  it('importiert eine Liste ohne Items fehlerfrei', async () => {
    const { importBackup } = await setupComposable();
    await expect(importBackup({ list: { name: 'Leer', items: [] } })).resolves.not.toThrow();
  });

  it('importiert eine Liste wenn items fehlt (undefined)', async () => {
    const { importBackup } = await setupComposable();
    await expect(importBackup({ list: { name: 'OhneItems' } })).resolves.not.toThrow();
  });
});
