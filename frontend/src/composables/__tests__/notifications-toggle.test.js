/**
 * Unit-Tests für den notificationsEnabled-Toggle (U12 / Body-Header)
 *  - Startzustand ist true
 *  - Wenn deaktiviert: showOsNotification feuert keine OS-Benachrichtigung
 *  - Wenn wieder aktiviert: OS-Benachrichtigungen kommen zurück
 *
 * Hinweis: Die Basis-Tests für showOsNotification (Berechtigungen, Body-Inhalt,
 * Service-Worker-Fallback) befinden sich in pwa-notifications.test.js.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
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
  updateDoc: vi.fn(async (id, fn) => {
    const d = { _id: id };
    fn(d);
    return { ok: true, id, rev: '2' };
  }),
  createDoc: vi.fn(async () => ({ ok: true, id: 'new_id' })),
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

const LIST_1 = {
  _id: 'list1',
  type: 'list',
  name: 'Einkauf',
  owner: 'TestUser',
  deleted: false,
};
const CHANGED_ITEM = {
  _id: 'i1',
  type: 'item',
  list_id: 'list1',
  name: 'Milch',
  _remoteChanged: true,
  _changeType: 'added',
  _changeTimestamp: 999,
  deleted: false,
  markedDeleted: false,
};

/** Richtet den Composable ein und triggert einen Sync-Callback mit geänderten Items */
async function setupAndTriggerSync(swNotify) {
  const db = await getDb();
  db.getAllDocs.mockResolvedValue([LIST_1, CHANGED_ITEM]);

  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
  });

  const { useShoppingList } = await import('../useShoppingList.js');
  const composable = useShoppingList();

  // Sync-Callback simulieren (wie bei Remote-Änderungen)
  const dataChangeCb = db.startSync.mock.calls.at(-1)[2];
  await dataChangeCb();

  return composable;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('notificationsEnabled – Startzustand', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ist standardmäßig true', async () => {
    const { useShoppingList } = await import('../useShoppingList.js');
    const { notificationsEnabled } = useShoppingList();
    expect(notificationsEnabled.value).toBe(true);
  });
});

describe('notificationsEnabled – Deaktiviert', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('feuert keine OS-Benachrichtigung wenn notificationsEnabled false ist', async () => {
    const swNotify = vi.fn().mockResolvedValue(undefined);
    const composable = await setupAndTriggerSync(swNotify);

    // Deaktivieren und erneut Sync auslösen
    composable.notificationsEnabled.value = false;
    swNotify.mockClear();

    const db = await getDb();
    const dataChangeCb = db.startSync.mock.calls.at(-1)[2];
    await dataChangeCb();

    expect(swNotify).not.toHaveBeenCalled();
  });

  it('zeigt weiterhin In-App-Benachrichtigungen (notifications-Array) auch wenn deaktiviert', async () => {
    const swNotify = vi.fn().mockResolvedValue(undefined);
    const composable = await setupAndTriggerSync(swNotify);

    composable.notificationsEnabled.value = false;

    const db = await getDb();
    const dataChangeCb = db.startSync.mock.calls.at(-1)[2];
    await dataChangeCb();

    // In-App-Banner soll trotzdem erscheinen
    expect(composable.notifications.value.length).toBeGreaterThan(0);
  });
});

describe('notificationsEnabled – Wieder aktiviert', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('feuert wieder OS-Benachrichtigungen nachdem wieder aktiviert', async () => {
    const swNotify = vi.fn().mockResolvedValue(undefined);
    const composable = await setupAndTriggerSync(swNotify);

    // Deaktivieren
    composable.notificationsEnabled.value = false;
    swNotify.mockClear();

    // Wieder aktivieren
    composable.notificationsEnabled.value = true;

    // Neues Item mit anderem Timestamp damit Deduplication nicht greift
    const db = await getDb();
    db.getAllDocs.mockResolvedValue([LIST_1, { ...CHANGED_ITEM, _changeTimestamp: 1234 }]);
    const dataChangeCb = db.startSync.mock.calls.at(-1)[2];
    await dataChangeCb();

    expect(swNotify).toHaveBeenCalledOnce();
  });
});
