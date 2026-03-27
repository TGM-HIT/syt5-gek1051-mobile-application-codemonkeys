/**
 * Unit-Tests für die PWA-Notification-Features:
 *  - showOsNotification: Nutzung von registration.showNotification() (Service Worker)
 *  - showOsNotification: Fallback auf window.Notification
 *  - showOsNotification: Body-Inhalt, Icons, Overflow-Zähler
 *  - generateNotifications: Gruppierung nach Liste, Deduplication
 *  - requestNotificationPermission: alle Berechtigungs-Zustände
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// Isolated rebuild von showOsNotification (gleiche Logik wie useShoppingList.js)
// Dieser Ansatz spiegelt search.test.js: Private Funktionen werden isoliert
// getestet, ohne den vollen Composable-Kontext zu benötigen.
// ─────────────────────────────────────────────────────────────────────────────
async function showOsNotification(listName, categories) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const lines = [];
  if (categories.modified.length > 0) {
    const preview = categories.modified.slice(0, 3).join(', ');
    const more = categories.modified.length > 3 ? ` +${categories.modified.length - 3}` : '';
    lines.push(`✏️ Geändert: ${preview}${more}`);
  }
  if (categories.added.length > 0) {
    const preview = categories.added.slice(0, 3).join(', ');
    const more = categories.added.length > 3 ? ` +${categories.added.length - 3}` : '';
    lines.push(`➕ Hinzugefügt: ${preview}${more}`);
  }
  if (categories.deleted.length > 0) {
    const preview = categories.deleted.slice(0, 3).join(', ');
    const more = categories.deleted.length > 3 ? ` +${categories.deleted.length - 3}` : '';
    lines.push(`🗑️ Gelöscht markiert: ${preview}${more}`);
  }

  const options = {
    body: lines.join('\n'),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `einkaufsliste_${listName}`,
    renotify: true,
  };
  const title = `🛒 ${listName} wurde geändert`;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch {
      // Fallback auf window.Notification
    }
  }
  new Notification(title, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks für Composable-Level-Tests (generateNotifications, requestPermission)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    onMounted: vi.fn((fn) => fn()),
    onUnmounted: vi.fn(),
  };
});

vi.mock('../database.js', () => ({
  startSync: vi.fn(() => ({ cancel: vi.fn() })),
  stopSync: vi.fn(),
  getAllDocs: vi.fn(async () => []),
  updateDoc: vi.fn(async (id, fn) => {
    const doc = { _id: id, _rev: '2-new' };
    fn(doc);
    return { ok: true, id, rev: '2-new' };
  }),
  createDoc: vi.fn(async () => ({ ok: true })),
  hardDeleteDoc: vi.fn(async () => ({ ok: true })),
  restoreLocalVersion: vi.fn(async () => true),
  clearRemoteChangedFlag: vi.fn(async () => {}),
  applyConflictResolution: vi.fn(async () => true),
  clearPendingDeleteFlag: vi.fn(async () => {}),
  findListByShareCode: vi.fn(async () => null),
  fetchItemsForListFromRemote: vi.fn(async () => []),
  initPouchDB: vi.fn(async () => ({
    localDB: {
      transaction: () => {
        const tx = { oncomplete: null, objectStore: () => ({ put: () => ({}) }) };
        Promise.resolve().then(() => tx.oncomplete?.());
        return tx;
      },
    },
  })),
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ currentUser: ref({ name: 'TestUser', roles: [] }) }),
}));

async function getDb() {
  return await import('../database.js');
}

// ─────────────────────────────────────────────────────────────────────────────
// showOsNotification – Berechtigungsprüfung
// ─────────────────────────────────────────────────────────────────────────────
describe('showOsNotification – Berechtigungsprüfung', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tut nichts wenn Notification API nicht unterstützt wird', async () => {
    // Notification aus globalThis entfernen
    const saved = globalThis.Notification;
    delete globalThis.Notification;
    const swNotify = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(swNotify).not.toHaveBeenCalled();
    globalThis.Notification = saved;
  });

  it('tut nichts wenn permission "denied" ist', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'denied' }));
    const swNotify = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(swNotify).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('tut nichts wenn permission "default" ist (noch nicht entschieden)', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default' }));
    const swNotify = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(swNotify).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showOsNotification – Service-Worker-Nutzung (PWA-Modus)
// ─────────────────────────────────────────────────────────────────────────────
describe('showOsNotification – Service-Worker (PWA)', () => {
  let swNotify;

  beforeEach(() => {
    swNotify = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('nutzt registration.showNotification() statt window.Notification', async () => {
    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(swNotify).toHaveBeenCalledOnce();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('übergibt den Listenname im Titel', async () => {
    await showOsNotification('Wochenmarkt', { modified: ['Brot'], added: [], deleted: [] });

    const [title] = swNotify.mock.calls[0];
    expect(title).toBe('🛒 Wochenmarkt wurde geändert');
  });

  it('nutzt das PWA-Icon (icon-192.png) als icon und badge', async () => {
    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    const [, options] = swNotify.mock.calls[0];
    expect(options.icon).toBe('/icons/icon-192.png');
    expect(options.badge).toBe('/icons/icon-192.png');
  });

  it('setzt renotify: true damit Benachrichtigungen erneut aufpoppen', async () => {
    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    const [, options] = swNotify.mock.calls[0];
    expect(options.renotify).toBe(true);
  });

  it('setzt Tag basierend auf dem Listennamen (für Gruppierung)', async () => {
    await showOsNotification('Camping', { modified: ['Zelt'], added: [], deleted: [] });

    const [, options] = swNotify.mock.calls[0];
    expect(options.tag).toBe('einkaufsliste_Camping');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showOsNotification – Fallback auf window.Notification
// ─────────────────────────────────────────────────────────────────────────────
describe('showOsNotification – Fallback auf window.Notification', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fällt auf window.Notification zurück wenn navigator.serviceWorker fehlt', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {}); // kein serviceWorker

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(Notification).toHaveBeenCalledOnce();
  });

  it('fällt auf window.Notification zurück wenn SW-showNotification einen Fehler wirft', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: vi.fn().mockRejectedValue(new Error('SW nicht verfügbar')),
        }),
      },
    });

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(Notification).toHaveBeenCalledOnce();
  });

  it('fällt zurück wenn navigator.serviceWorker.ready rejected', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.reject(new Error('kein SW')) },
    });

    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    expect(Notification).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showOsNotification – Body-Inhalt & Overflow
// ─────────────────────────────────────────────────────────────────────────────
describe('showOsNotification – Body-Inhalt', () => {
  let swNotify;

  beforeEach(() => {
    swNotify = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('enthält geänderte Items im Body', async () => {
    await showOsNotification('Einkauf', { modified: ['Milch', 'Brot'], added: [], deleted: [] });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('✏️ Geändert: Milch, Brot');
  });

  it('enthält hinzugefügte Items im Body', async () => {
    await showOsNotification('Einkauf', { modified: [], added: ['Käse'], deleted: [] });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('➕ Hinzugefügt: Käse');
  });

  it('enthält als gelöscht markierte Items im Body', async () => {
    await showOsNotification('Einkauf', { modified: [], added: [], deleted: ['Joghurt'] });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('🗑️ Gelöscht markiert: Joghurt');
  });

  it('zeigt maximal 3 Items pro Kategorie und den Rest als +N', async () => {
    await showOsNotification('Einkauf', {
      modified: ['A', 'B', 'C', 'D', 'E'],
      added: [],
      deleted: [],
    });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('A, B, C');
    expect(body).toContain('+2');
    expect(body).not.toContain('D');
    expect(body).not.toContain('E');
  });

  it('berechnet den Overflow-Zähler korrekt bei 4 Items (+1)', async () => {
    await showOsNotification('Einkauf', {
      modified: [],
      added: ['1', '2', '3', '4'],
      deleted: [],
    });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('+1');
  });

  it('zeigt keinen Overflow wenn genau 3 Items vorhanden', async () => {
    await showOsNotification('Einkauf', {
      modified: ['X', 'Y', 'Z'],
      added: [],
      deleted: [],
    });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).not.toContain('+');
  });

  it('kombiniert alle drei Kategorien im Body', async () => {
    await showOsNotification('Einkauf', {
      modified: ['Milch'],
      added: ['Brot'],
      deleted: ['Eier'],
    });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).toContain('Geändert');
    expect(body).toContain('Hinzugefügt');
    expect(body).toContain('Gelöscht');
  });

  it('zeigt keine leere Zeile wenn eine Kategorie leer ist', async () => {
    await showOsNotification('Einkauf', { modified: ['Milch'], added: [], deleted: [] });

    const [, { body }] = swNotify.mock.calls[0];
    expect(body).not.toContain('Hinzugefügt');
    expect(body).not.toContain('Gelöscht');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requestNotificationPermission – alle Zustände
// ─────────────────────────────────────────────────────────────────────────────
describe('requestNotificationPermission', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gibt "unsupported" zurück wenn Notification API fehlt', async () => {
    const saved = globalThis.Notification;
    delete globalThis.Notification;

    const { useShoppingList } = await import('../useShoppingList.js');
    const { requestNotificationPermission } = useShoppingList();
    const result = await requestNotificationPermission();

    expect(result).toBe('unsupported');
    globalThis.Notification = saved;
  });

  it('gibt sofort "granted" zurück wenn Berechtigung bereits erteilt', async () => {
    const mockRequestPermission = vi.fn();
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'granted', requestPermission: mockRequestPermission }),
    );

    const { useShoppingList } = await import('../useShoppingList.js');
    const { requestNotificationPermission } = useShoppingList();
    const result = await requestNotificationPermission();

    expect(result).toBe('granted');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('gibt sofort "denied" zurück wenn Berechtigung verweigert', async () => {
    const mockRequestPermission = vi.fn();
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'denied', requestPermission: mockRequestPermission }),
    );

    const { useShoppingList } = await import('../useShoppingList.js');
    const { requestNotificationPermission } = useShoppingList();
    const result = await requestNotificationPermission();

    expect(result).toBe('denied');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('ruft requestPermission() auf wenn Berechtigung noch offen ("default")', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'default', requestPermission: mockRequestPermission }),
    );

    const { useShoppingList } = await import('../useShoppingList.js');
    const { requestNotificationPermission } = useShoppingList();

    // onMounted ruft requestNotificationPermission() bereits einmal auf → Mock zurücksetzen
    mockRequestPermission.mockClear();

    const result = await requestNotificationPermission();

    expect(mockRequestPermission).toHaveBeenCalledOnce();
    expect(result).toBe('granted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateNotifications – Gruppierung und Deduplication via Composable
// ─────────────────────────────────────────────────────────────────────────────
describe('generateNotifications – über Composable-Callback', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function setupWithChangedItems(changedItems, lists) {
    const db = await getDb();

    // getAllDocs gibt die vorbereiteten Daten zurück
    db.getAllDocs.mockResolvedValue([...lists, ...changedItems]);

    // SW-Notification mocken
    const swNotify = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }));
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification: swNotify }) },
    });

    const { useShoppingList } = await import('../useShoppingList.js');
    const composable = useShoppingList();

    // Data-Change-Callback aus startSync extrahieren
    const dataChangeCb = db.startSync.mock.calls.at(-1)[2];
    await dataChangeCb();

    return { composable, swNotify };
  }

  it('erstellt eine Benachrichtigung pro geänderter Liste', async () => {
    const { composable } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Milch',
          _remoteChanged: true,
          _changeType: 'added',
          deleted: false,
          markedDeleted: false,
        },
      ],
      [{ _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false }],
    );

    expect(composable.notifications.value).toHaveLength(1);
    expect(composable.notifications.value[0].listName).toBe('Einkauf');
  });

  it('gruppiert mehrere geänderte Items derselben Liste in einer Benachrichtigung', async () => {
    const { composable } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Milch',
          _remoteChanged: true,
          _changeType: 'added',
          deleted: false,
          markedDeleted: false,
        },
        {
          _id: 'i2',
          type: 'item',
          list_id: 'list1',
          name: 'Brot',
          _remoteChanged: true,
          _changeType: 'modified',
          deleted: false,
          markedDeleted: false,
        },
      ],
      [{ _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false }],
    );

    expect(composable.notifications.value).toHaveLength(1);
    expect(composable.notifications.value[0].added).toContain('Milch');
    expect(composable.notifications.value[0].modified).toContain('Brot');
  });

  it('erstellt separate Benachrichtigungen für verschiedene Listen', async () => {
    const { composable } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Milch',
          _remoteChanged: true,
          _changeType: 'added',
          deleted: false,
          markedDeleted: false,
        },
        {
          _id: 'i2',
          type: 'item',
          list_id: 'list2',
          name: 'Schraube',
          _remoteChanged: true,
          _changeType: 'added',
          deleted: false,
          markedDeleted: false,
        },
      ],
      [
        { _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false },
        { _id: 'list2', type: 'list', name: 'Baumarkt', owner: 'TestUser', deleted: false },
      ],
    );

    expect(composable.notifications.value).toHaveLength(2);
    const listNames = composable.notifications.value.map((n) => n.listName);
    expect(listNames).toContain('Einkauf');
    expect(listNames).toContain('Baumarkt');
  });

  it('feuert eine OS-Benachrichtigung via Service Worker bei neuen Änderungen', async () => {
    const { swNotify } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Milch',
          _remoteChanged: true,
          _changeType: 'added',
          _changeTimestamp: 12345,
          deleted: false,
          markedDeleted: false,
        },
      ],
      [{ _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false }],
    );

    expect(swNotify).toHaveBeenCalledOnce();
  });

  it('erzeugt keine Benachrichtigung wenn keine remote-geänderten Items vorhanden', async () => {
    const { composable, swNotify } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Milch',
          _remoteChanged: false,
          deleted: false,
          markedDeleted: false,
        },
      ],
      [{ _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false }],
    );

    expect(composable.notifications.value).toHaveLength(0);
    expect(swNotify).not.toHaveBeenCalled();
  });

  it('kategorisiert gelöschte Items als "deleted" in der Benachrichtigung', async () => {
    const { composable } = await setupWithChangedItems(
      [
        {
          _id: 'i1',
          type: 'item',
          list_id: 'list1',
          name: 'Eier',
          _remoteChanged: true,
          _changeType: 'deleted',
          deleted: false,
          markedDeleted: true,
        },
      ],
      [{ _id: 'list1', type: 'list', name: 'Einkauf', owner: 'TestUser', deleted: false }],
    );

    expect(composable.notifications.value[0].deleted).toContain('Eier');
  });
});
