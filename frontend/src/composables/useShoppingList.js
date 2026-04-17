import { ref, onMounted, onUnmounted } from 'vue';
import {
  startSync,
  stopSync,
  getAllDocs,
  updateDoc,
  createDoc,
  hardDeleteDoc,
  clearRemoteChangedFlag,
  findListByShareCode,
  fetchItemsForListFromRemote,
} from './database';
import { useAuth } from './useAuth';

/**
 * Zentrale Geschäftslogik für Listen, Items, Sync-Status und Benachrichtigungen.
 *
 * Aufgaben dieses Composables:
 * - Laden/Filtern der sichtbaren Listen und Items.
 * - CRUD-Operationen auf Listen/Items über die lokale Datenbank.
 * - Anbindung an den Background-Sync (online/offline, Pull/Push-Ereignisse).
 * - Remote-Änderungshinweise (In-App + OS-Notifications).
 * - Sharing (Code generieren / Liste beitreten) und Backup Import/Export.
 *
 * Alle Schreiboperationen laufen über `database.js`, damit `_dirty`, `_rev`
 * und Konfliktlogik konsistent bleiben.
 */
export function useShoppingList() {
  const { currentUser } = useAuth();
  const sessionName = { value: currentUser.value?.name || '' };

  /**
   * `sessionName` spiegelt den aktuellen Usernamen, bleibt aber kompatibel mit
   * vorhandenem Code, der ein `{ value }`-Objekt erwartet.
   */
  Object.defineProperty(sessionName, 'value', {
    get: () => currentUser.value?.name || '',
    enumerable: true,
    configurable: true,
  });

  // Reaktiver UI-/Domain-State
  const lists = ref([]);
  const items = ref([]);
  const loading = ref(true);
  const error = ref(null);
  const isOnline = ref(false); // Initial false, wird durch ersten Sync gesetzt
  const syncActive = ref(false);
  const conflicts = ref({}); // nicht mehr aktiv genutzt, für Kompatibilität behalten
  const notifications = ref([]); // Benachrichtigungen für Remote-Änderungen
  const notificationsEnabled = ref(true); // Kann vom User deaktiviert werden
  const shownNotificationIds = new Set(); // Verhindert doppelte OS-Benachrichtigungen

  /**
   * Übersetzt technische Fehler in verständliche UI-Meldungen.
   *
   * @param {Error|unknown} err - Originalfehler aus Netzwerk/DB/Sync.
   * @returns {string} Nutzerfreundlicher deutscher Fehlertext.
   */
  function getErrorMessage(err) {
    const msg = err?.message || '';
    const status = err?.status || err?.statusCode || 0;

    // Netzwerkfehler / Offline
    if (
      err instanceof TypeError ||
      msg.includes('Failed to fetch') ||
      msg.includes('Network') ||
      msg.includes('offline') ||
      msg.includes('not reachable') ||
      msg.includes('ECONNREFUSED')
    ) {
      return 'Offline-Modus: Änderungen werden lokal gespeichert und synchronisiert, sobald du wieder online bist.';
    }

    // Authentifizierungsfehler
    if (
      status === 401 ||
      status === 403 ||
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('auth') ||
      msg.includes('Unauthorized')
    ) {
      return 'Sitzung abgelaufen oder ungültige Zugangsdaten. Bitte melde dich erneut an.';
    }

    // Nicht gefunden
    if (
      status === 404 ||
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('Document not found')
    ) {
      return 'Die angeforderten Daten wurden nicht gefunden.';
    }

    // Sonstige Fehler
    return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
  }

  // ── Joined Lists (localStorage) ──
  /**
   * Liest die IDs der per Share-Code beigetretenen Listen aus localStorage.
   * Fehlerhafte JSON-Werte werden defensiv als leere Liste behandelt.
   *
   * @returns {string[]}
   */
  function getJoinedListIds() {
    try {
      return JSON.parse(localStorage.getItem('joinedListIds') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Merkt eine Liste als "beigetreten", ohne Duplikate zu erzeugen.
   *
   * @param {string} listId
   */
  function addJoinedListId(listId) {
    const ids = getJoinedListIds();
    if (!ids.includes(listId)) {
      ids.push(listId);
      localStorage.setItem('joinedListIds', JSON.stringify(ids));
    }
  }

  /**
   * Entfernt eine Liste aus den gespeicherten "beigetretenen" IDs.
   *
   * @param {string} listId
   */
  function removeJoinedListId(listId) {
    const ids = getJoinedListIds().filter((id) => id !== listId);
    localStorage.setItem('joinedListIds', JSON.stringify(ids));
  }

  /**
   * Lädt den sichtbaren Datenzustand für die aktuelle Session.
   *
   * Filterlogik:
   * - Listen: eigene + per Share-Code beigetretene.
   * - Items: nur Elemente sichtbarer Listen und ohne `deleted`-Tombstones.
   */
  async function loadData() {
    try {
      loading.value = true;

      const docs = await getAllDocs();

      const allLists = docs.filter((doc) => doc.type === 'list' && !doc.deleted);
      const joinedIds = getJoinedListIds();
      const currentUser = sessionName.value || '';

      // Nur eigene Listen + beigetretene Listen anzeigen
      lists.value = allLists.filter(
        (list) => list.owner === currentUser || joinedIds.includes(list._id),
      );

      // Items nur für sichtbare Listen laden
      const visibleListIds = new Set(lists.value.map((l) => l._id));
      items.value = docs.filter(
        (doc) => doc.type === 'item' && !doc.deleted && visibleListIds.has(doc.list_id),
      );

      error.value = null;
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      error.value = getErrorMessage(err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Löscht eine Liste endgültig über `hardDeleteDoc` und entfernt
   * ihren Join-Marker aus localStorage.
   *
   * @param {{ _id: string }} list
   */
  async function deleteList(list) {
    try {
      removeJoinedListId(list._id);
      await hardDeleteDoc(list._id);
      await loadData();
    } catch (err) {
      console.error('Fehler beim Löschen der Liste:', err);
      error.value = 'Liste konnte nicht gelöscht werden';
    }
  }

  /**
   * Erstellt ein neues Item mit Standardwerten in einer Liste.
   *
   * @param {string} listId
   * @param {string} name
   */
  async function addItem(listId, name) {
    if (!name || !name.trim()) return;
    try {
      await createDoc({
        type: 'item',
        list_id: listId,
        name: name.trim(),
        checked: false,
        markedDeleted: false,
        note: '',
        label: null,
        lastModifiedBy: sessionName.value || 'Unbekannt',
      });
      await loadData();
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Items:', err);
      error.value = 'Item konnte nicht hinzugefügt werden';
    }
  }

  /**
   * Speichert Detailfelder eines Items (Notiz + Label).
   * Aktualisiert danach die lokale Referenz für unmittelbares UI-Feedback.
   *
   * @param {Object} item
   * @param {string} note
   * @param {string|null} label
   */
  async function updateItemDetails(item, note, label) {
    try {
      const result = await updateDoc(item._id, (doc) => ({
        ...doc,
        note: note ?? '',
        label: label ?? null,
        lastModifiedBy: sessionName.value || 'Unbekannt',
        updatedAt: new Date().toISOString(),
      }));
      item._rev = result.rev;
      item.note = note ?? '';
      item.label = label ?? null;
    } catch (err) {
      console.error('Fehler beim Speichern der Details:', err);
      error.value = 'Details konnten nicht gespeichert werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Legt eine neue Liste für den aktuellen User an.
   *
   * @param {string} name
   */
  async function addList(name) {
    if (!name || !name.trim()) return;
    await createDoc({
      type: 'list',
      name: name.trim(),
      owner: sessionName.value || 'Unbekannt',
      deleted: false,
    });
    await loadData();
  }

  /**
   * Wechselt den Erledigt-Status eines Items (optimistisches UI-Update).
   * Bei Fehler wird der alte Zustand wiederhergestellt.
   *
   * @param {Object} item
   */
  async function toggleItem(item) {
    try {
      const newCheckedState = !item.checked;
      item.checked = newCheckedState;

      const result = await updateDoc(item._id, (doc) => {
        return {
          ...doc,
          checked: newCheckedState,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });

      item._rev = result.rev;
    } catch (err) {
      console.error('Fehler beim Updaten:', err);
      item.checked = !item.checked;
      error.value = 'Item konnte nicht aktualisiert werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Initialisiert die dauerhafte Hintergrund-Synchronisation.
   *
   * Callback-Verhalten:
   * - Status-Callback pflegt `isOnline`/`syncActive`.
   * - Data-Callback lädt Daten neu und erzeugt Änderungsbenachrichtigungen.
   */
  function initSync() {
    try {
      startSync(
        // Status-Callback
        (status) => {
          isOnline.value = status.online;
          syncActive.value = status.syncing;
          // Wenn wieder online: Offline-Fehlermeldung ausblenden
          if (status.online && error.value?.includes('Offline')) {
            error.value = null;
          }
        },
        // Conflict-Callback
        () => {},
        // Data-Change-Callback
        async () => {
          await loadData();
          generateNotifications();
        },
      );
      syncActive.value = true;
    } catch (err) {
      console.error('Sync initialization failed:', err);
      error.value = getErrorMessage(err);
    }
  }

  /**
   * Legacy-API: Konflikte werden inzwischen über `_pendingDelete` direkt
   * am Item signalisiert. Für API-Kompatibilität bleibt die Funktion bestehen.
   *
   * @returns {null}
   */
  function getConflictForItem() {
    return null;
  }
  /**
   * Legacy-Stub für ältere Aufrufe.
   * Konfliktentscheidungen laufen aktuell über `acceptDelete`/`rejectDelete`.
   */
  async function resolveConflict() {}

  /**
   * Erzeugt und speichert einen 6-stelligen Share-Code für eine Liste.
   *
   * Zeichensatz ist bewusst ohne leicht verwechselbare Zeichen (`I/O/0/1`).
   *
   * @param {string} listId
   * @returns {Promise<string|null>} Share-Code oder `null` bei Fehler.
   */
  async function generateShareCode(listId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I/O/0/1 zur Vermeidung von Verwechslungen
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      await updateDoc(listId, (doc) => {
        return {
          ...doc,
          shareCode: code,
          updatedAt: new Date().toISOString(),
        };
      });

      await loadData();
      return code;
    } catch (err) {
      console.error('Fehler beim Generieren des Share-Codes:', err);
      error.value = 'Share-Code konnte nicht generiert werden';
      return null;
    }
  }

  /**
   * Join-Flow für geteilte Listen.
   *
   * Ablauf:
   * 1. Code normalisieren/validieren.
   * 2. Lokale Duplikate prüfen.
   * 3. Liste und zugehörige Items aus CouchDB laden.
   * 4. Alles in lokale IndexedDB spiegeln.
   * 5. Join-Status in localStorage persistieren.
   *
   * @param {string} code
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async function joinListByCode(code) {
    if (!code || !code.trim()) {
      return { success: false, message: 'Bitte einen Code eingeben.' };
    }

    const trimmedCode = code.trim().toUpperCase();

    // Prüfen ob Liste bereits lokal vorhanden ist
    const existingList = lists.value.find((l) => l.shareCode === trimmedCode);
    if (existingList) {
      return { success: false, message: 'Diese Liste hast du bereits.' };
    }

    // Liste in CouchDB suchen
    const remoteList = await findListByShareCode(trimmedCode);
    if (!remoteList) {
      return { success: false, message: 'Keine Liste mit diesem Code gefunden.' };
    }

    // Liste lokal speichern (in IndexedDB)
    const db = await (await import('./database')).initPouchDB();
    const idb = db.localDB;
    await new Promise((resolve) => {
      const tx = idb.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(remoteList);
      tx.oncomplete = () => resolve();
    });

    // Items der Liste von CouchDB holen und lokal speichern
    const remoteItems = await fetchItemsForListFromRemote(remoteList._id);
    for (const item of remoteItems) {
      await new Promise((resolve) => {
        const tx = idb.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(item);
        tx.oncomplete = () => resolve();
      });
    }

    // Liste als "beigetreten" in localStorage merken
    addJoinedListId(remoteList._id);

    await loadData();
    return { success: true, message: `Liste "${remoteList.name}" beigetreten!` };
  }

  /**
   * Browser-Eventhandler: Verbindung wiederhergestellt.
   * Der finale Online-Status wird anschließend durch den Sync-Callback gesetzt.
   */
  function handleOnline() {
    console.log('Network is online');
    // Status wird durch Sync-Callback aktualisiert
  }

  /**
   * Browser-Eventhandler: Verbindung verloren.
   * Setzt den sichtbaren Status sofort auf offline.
   */
  function handleOffline() {
    console.log('Network is offline');
    isOnline.value = false;
    syncActive.value = false;
  }

  /**
   * Liefert alle Items einer Liste (inklusive soft-gelöschter).
   *
   * @param {string} listId
   * @returns {Array}
   */
  function getItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId);
  }

  /**
   * Liefert nur aktive (nicht als gelöscht markierte) Items.
   *
   * @param {string} listId
   * @returns {Array}
   */
  function getActiveItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && !i.markedDeleted);
  }

  /**
   * Liefert nur soft-gelöschte Items (`markedDeleted === true`).
   *
   * @param {string} listId
   * @returns {Array}
   */
  function getDeletedItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && i.markedDeleted);
  }

  /**
   * Hebt Soft-Delete auf und stellt ein Item wieder her.
   *
   * @param {Object} item
   */
  async function restoreItem(item) {
    try {
      const result = await updateDoc(item._id, (doc) => {
        return {
          ...doc,
          markedDeleted: false,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });
      item._rev = result.rev;
      item.markedDeleted = false;
    } catch (err) {
      console.error('Fehler beim Wiederherstellen:', err);
      error.value = 'Item konnte nicht wiederhergestellt werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Entfernt alle soft-gelöschten Items einer Liste endgültig.
   *
   * @param {string} listId
   */
  async function permanentlyDeleteAllMarked(listId) {
    const deletedItems = getDeletedItemsForList(listId);
    for (const item of deletedItems) {
      await hardDeleteDoc(item._id);
    }
    await loadData();
  }

  /**
   * Führt Soft-Delete aus (`markedDeleted = true`), damit Undo möglich bleibt.
   *
   * @param {Object} item
   */
  async function markItemDeleted(item) {
    try {
      const result = await updateDoc(item._id, (doc) => {
        return {
          ...doc,
          markedDeleted: true,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });
      item._rev = result.rev;
      item.markedDeleted = true;
    } catch (err) {
      console.error('Fehler beim Markieren als gelöscht:', err);
      error.value = 'Item konnte nicht gelöscht werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Prüft, ob es in der Liste Elemente mit Remote-Änderungsmarker gibt.
   *
   * @param {string} listId
   * @returns {boolean}
   */
  function hasChangedItems(listId) {
    return getItemsForList(listId).some((item) => item._remoteChanged);
  }

  /**
   * Liefert aktive Items, die durch Remote-Sync als geändert markiert wurden.
   *
   * @param {string} listId
   * @returns {Array}
   */
  function getChangedItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && i._remoteChanged && !i.markedDeleted);
  }

  /**
   * Fragt Notification-Permission ab bzw. fordert sie beim Browser an.
   *
   * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
   */
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
  }

  /**
   * Baut und zeigt eine Systembenachrichtigung für Listenänderungen.
   *
   * Eigenschaften:
   * - maximal 3 Item-Namen pro Kategorie + Overflow-Zähler
   * - bevorzugt Service-Worker-Notification (PWA-freundlich)
   * - Fallback auf `window.Notification`
   *
   * @param {string} listName
   * @param {{ modified: string[], added: string[], deleted: string[] }} categories
   */
  async function showOsNotification(listName, categories) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!notificationsEnabled.value) return;

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

    // Service-Worker-Notification bevorzugen (erscheint als echte Systemnachricht über der PWA)
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

  /**
   * Erzeugt In-App-Benachrichtigungsgruppen aus `_remoteChanged`-Items.
   *
   * Gruppierung pro Liste:
   * - modified / added / deleted
   * - `maxTimestamp` dient als Dedupe-Signatur für OS-Benachrichtigungen.
   */
  function generateNotifications() {
    // Gruppieren nach Liste (nicht nach Person – mehrere Personen pro Liste möglich)
    const groups = {};
    for (const item of items.value) {
      if (!item._remoteChanged) continue;
      const list = lists.value.find((l) => l._id === item.list_id);
      if (!list) continue;

      if (!groups[item.list_id]) {
        groups[item.list_id] = {
          id: item.list_id,
          listId: item.list_id,
          listName: list.name,
          modified: [], // geänderte Items
          added: [], // neu hinzugefügte Items
          deleted: [], // als gelöscht markierte Items
          maxTimestamp: 0,
        };
      }
      const g = groups[item.list_id];
      const ts = item._changeTimestamp || 0;
      if (ts > g.maxTimestamp) g.maxTimestamp = ts;

      const type = item._changeType || (item.markedDeleted ? 'deleted' : 'modified');
      if (type === 'added') g.added.push(item.name);
      else if (type === 'deleted') g.deleted.push(item.name);
      else g.modified.push(item.name);
    }

    // OS-Benachrichtigung nur für wirklich neue Änderungen feuern
    for (const group of Object.values(groups)) {
      const uniqueId = `${group.id}__${group.maxTimestamp}`;
      if (!shownNotificationIds.has(uniqueId)) {
        showOsNotification(group.listName, group);
        shownNotificationIds.add(uniqueId);
      }
    }

    // Veraltete IDs bereinigen
    const currentListIds = new Set(Object.keys(groups));
    for (const id of shownNotificationIds) {
      const listId = id.split('__')[0];
      if (!currentListIds.has(listId)) shownNotificationIds.delete(id);
    }

    notifications.value = Object.values(groups);
  }

  /**
   * Entfernt eine einzelne In-App-Benachrichtigung aus dem UI-State.
   *
   * @param {string} id
   */
  function dismissNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  /**
   * Bestätigt alle Änderungen einer Liste als "gesehen".
   *
   * Entfernt Remote-Marker auf betroffenen Items und baut anschließend
   * die Notification-Ansicht neu auf.
   *
   * @param {string} listId
   */
  async function clearListChanges(listId) {
    const listItems = getItemsForList(listId);
    const changedItems = listItems.filter((item) => item._remoteChanged);

    for (const item of changedItems) {
      await clearRemoteChangedFlag(item._id);
    }

    await loadData(); // UI aktualisieren
    generateNotifications(); // Benachrichtigungen aktualisieren
  }

  /**
   * Übernimmt eine remote angeforderte Löschung.
   * Entfernt `_pendingDelete` und setzt `markedDeleted = true`.
   *
   * @param {Object} item
   */
  async function acceptDelete(item) {
    try {
      item._pendingDelete = undefined;
      await updateDoc(item._id, (doc) => {
        const clean = { ...doc };
        delete clean._pendingDelete;
        return {
          ...clean,
          markedDeleted: true,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });
      await loadData();
    } catch (err) {
      console.error('Fehler beim Akzeptieren der Löschung:', err);
    }
  }

  /**
   * Lehnt eine remote angeforderte Löschung ab.
   * Entfernt `_pendingDelete` und stellt `markedDeleted = false` sicher.
   *
   * @param {Object} item
   */
  async function rejectDelete(item) {
    try {
      item._pendingDelete = undefined;
      await updateDoc(item._id, (doc) => {
        const clean = { ...doc };
        delete clean._pendingDelete;
        return {
          ...clean,
          markedDeleted: false,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });
      await loadData();
    } catch (err) {
      console.error('Fehler beim Ablehnen der Löschung:', err);
    }
  }

  /**
   * Benennt eine Liste um.
   *
   * @param {string} listId
   * @param {string} newName
   */
  async function renameList(listId, newName) {
    if (!newName || !newName.trim()) return;
    try {
      await updateDoc(listId, (doc) => {
        return {
          ...doc,
          name: newName.trim(),
          updatedAt: new Date().toISOString(),
        };
      });
      await loadData();
    } catch (err) {
      console.error('Fehler beim Umbenennen der Liste:', err);
      error.value = 'Liste konnte nicht umbenannt werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Benennt ein Item um und aktualisiert die lokale Referenz.
   *
   * @param {Object} item
   * @param {string} newName
   */
  async function renameItem(item, newName) {
    if (!newName || !newName.trim()) return;
    try {
      const result = await updateDoc(item._id, (doc) => {
        return {
          ...doc,
          name: newName.trim(),
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString(),
        };
      });
      item._rev = result.rev;
      item.name = newName.trim();
    } catch (err) {
      console.error('Fehler beim Umbenennen des Artikels:', err);
      error.value = 'Artikel konnte nicht umbenannt werden';
      setTimeout(() => (error.value = null), 3000);
    }
  }

  /**
   * Berechnet den Fortschritt einer Liste (nur aktive Items).
   *
   * Formel: `round(checked / activeItems * 100)`.
   *
   * @param {string} listId
   * @returns {number} Prozentwert zwischen 0 und 100.
   */
  function getProgress(listId) {
    const listItems = getActiveItemsForList(listId);
    if (listItems.length === 0) return 0;
    const checked = listItems.filter((i) => i.checked).length;
    return Math.round((checked / listItems.length) * 100);
  }

  /**
   * Exportiert eine Liste inkl. Items als downloadbare JSON-Datei.
   *
   * Export enthält nur fachliche Felder (keine internen `_id/_rev`-Metadaten),
   * damit Backups portabel bleiben.
   *
   * @param {string} listId
   */
  function exportBackup(listId) {
    const list = lists.value.find((l) => l._id === listId);
    if (!list) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.value?.name || 'Unbekannt',
      list: {
        name: list.name,
        owner: list.owner,
        createdAt: list.createdAt,
        items: items.value
          .filter((i) => i.list_id === listId)
          .map((i) => ({
            name: i.name,
            checked: i.checked,
            note: i.note || null,
            label: i.label || null,
            markedDeleted: i.markedDeleted || false,
          })),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${safeName}-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importiert ein zuvor exportiertes Backup in eine neue Liste.
   *
   * Verhalten:
   * - Name wird als `"<Name> (Backup)"` angelegt.
   * - Items werden sequenziell erstellt.
   * - Nach Abschluss wird die UI neu geladen.
   *
   * @param {{ list?: { name?: string, items?: Array<any> } }} payload
   * @returns {Promise<void>}
   */
  async function importBackup(payload) {
    if (!payload?.list?.name) throw new Error('Ungültiges Backup-Format');

    const listDoc = await createDoc({
      type: 'list',
      name: `${payload.list.name} (Backup)`,
      owner: sessionName.value || 'Unbekannt',
      deleted: false,
    });

    const listId = listDoc.id;
    for (const item of payload.list.items || []) {
      await createDoc({
        type: 'item',
        list_id: listId,
        name: item.name,
        checked: item.checked || false,
        markedDeleted: item.markedDeleted || false,
        note: item.note || '',
        label: item.label || null,
        lastModifiedBy: sessionName.value || 'Unbekannt',
      });
    }

    await loadData();
  }

  // Daten beim Mount laden
  onMounted(() => {
    loadData();
    initSync();
    requestNotificationPermission();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    stopSync();
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  // Public API
  return {
    // State
    lists,
    items,
    loading,
    error,
    isOnline,
    syncActive,
    conflicts,
    notifications,

    // Actions
    toggleItem,
    addItem,
    addList,
    deleteList,
    renameList,
    renameItem,
    updateItemDetails,
    getItemsForList,
    getActiveItemsForList,
    getDeletedItemsForList,
    getChangedItemsForList,
    markItemDeleted,
    restoreItem,
    permanentlyDeleteAllMarked,
    getProgress,
    getConflictForItem,
    resolveConflict,
    acceptDelete,
    rejectDelete,
    hasChangedItems,
    clearListChanges,
    dismissNotification,
    requestNotificationPermission,
    notificationsEnabled,
    generateShareCode,
    joinListByCode,
    exportBackup,
    importBackup,
  };
}
