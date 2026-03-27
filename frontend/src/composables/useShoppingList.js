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
 * Composable für die Einkaufslisten-Logik mit PouchDB Offline-First
 */
export function useShoppingList() {
  const { currentUser } = useAuth();
  const sessionName = { value: currentUser.value?.name || '' };

  // sessionName reaktiv halten
  Object.defineProperty(sessionName, 'value', {
    get: () => currentUser.value?.name || '',
    enumerable: true,
    configurable: true,
  });

  // State
  const lists = ref([]);
  const items = ref([]);
  const loading = ref(true);
  const error = ref(null);
  const isOnline = ref(false); // Initial false, wird durch ersten Sync gesetzt
  const syncActive = ref(false);
  const conflicts = ref({}); // nicht mehr aktiv genutzt, für Kompatibilität behalten
  const notifications = ref([]); // Benachrichtigungen für Remote-Änderungen
  const shownNotificationIds = new Set(); // Verhindert doppelte OS-Benachrichtigungen

  // ── Joined Lists (localStorage) ──
  function getJoinedListIds() {
    try {
      return JSON.parse(localStorage.getItem('joinedListIds') || '[]');
    } catch {
      return [];
    }
  }

  function addJoinedListId(listId) {
    const ids = getJoinedListIds();
    if (!ids.includes(listId)) {
      ids.push(listId);
      localStorage.setItem('joinedListIds', JSON.stringify(ids));
    }
  }

  function removeJoinedListId(listId) {
    const ids = getJoinedListIds().filter((id) => id !== listId);
    localStorage.setItem('joinedListIds', JSON.stringify(ids));
  }

  /**
   * Lädt alle Listen und Items aus der lokalen Datenbank
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
      error.value = 'Fehler beim Laden der lokalen Daten';
    } finally {
      loading.value = false;
    }
  }

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

  async function addItem(listId, name) {
    if (!name || !name.trim()) return;
    try {
      await createDoc({
        type: 'item',
        list_id: listId,
        name: name.trim(),
        checked: false,
        markedDeleted: false,
        lastModifiedBy: sessionName.value || 'Unbekannt',
      });
      await loadData();
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Items:', err);
      error.value = 'Item konnte nicht hinzugefügt werden';
    }
  }

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
   * Toggelt den Checked-Status eines Items (nur lokal)
   * @param {Object} item - Das zu aktualisierende Item
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
   * Initialisiert die Synchronisation (läuft im Hintergrund)
   */
  function initSync() {
    try {
      startSync(
        // Status-Callback
        (status) => {
          isOnline.value = status.online;
          syncActive.value = status.syncing;
        },
        // Conflict-Callback – nicht mehr für markedDeleted nötig
        () => {},
        // Data-Change-Callback
        async () => {
          await loadData(); // UI neu laden bei Remote-Änderungen
          generateNotifications(); // Benachrichtigungen erzeugen
        },
      );
      syncActive.value = true;
    } catch (err) {
      console.error('Sync initialization failed:', err);
    }
  }

  // Nicht mehr benötigt - _pendingDelete wird direkt auf items gesetzt
  function getConflictForItem() {
    return null;
  }
  async function resolveConflict() {}

  /**
   * Generiert einen 6-stelligen Share-Code für eine Liste
   * und speichert ihn auf dem Listen-Dokument.
   * @param {string} listId - Die ID der Liste
   * @returns {string} Der generierte Share-Code
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
   * Tritt einer geteilten Liste bei anhand des Share-Codes.
   * Sucht die Liste in CouchDB und importiert sie + Items lokal.
   * @param {string} code - Der 6-stellige Share-Code
   * @returns {Object} { success: boolean, message: string }
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
   * Online/Offline Event-Handler
   */
  function handleOnline() {
    console.log('Network is online');
    // Status wird durch Sync-Callback aktualisiert
  }

  function handleOffline() {
    console.log('Network is offline');
    isOnline.value = false;
    syncActive.value = false;
  }

  /**
   * Gibt alle Items für eine bestimmte Liste zurück
   * @param {string} listId - Die ID der Liste
   * @returns {Array} Array von Items
   */
  function getItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId);
  }

  /**
   * Gibt aktive (nicht gelöscht markierte) Items für eine Liste zurück
   */
  function getActiveItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && !i.markedDeleted);
  }

  /**
   * Gibt als gelöscht markierte Items für eine Liste zurück
   */
  function getDeletedItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && i.markedDeleted);
  }

  /**
   * Stellt ein als gelöscht markiertes Item wieder her
   * @param {Object} item - Das wiederherzustellende Item
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
   * Löscht alle als gelöscht markierten Items einer Liste endgültig
   * @param {string} listId - Die ID der Liste
   */
  async function permanentlyDeleteAllMarked(listId) {
    const deletedItems = getDeletedItemsForList(listId);
    for (const item of deletedItems) {
      await hardDeleteDoc(item._id);
    }
    await loadData();
  }

  /**
   * Markiert ein Item als gelöscht (Soft-Delete)
   * @param {Object} item - Das zu markierende Item
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
   * Prüft ob eine Liste geänderte Items hat
   * @param {string} listId - Die ID der Liste
   * @returns {boolean} True wenn es geänderte Items gibt
   */
  function hasChangedItems(listId) {
    return getItemsForList(listId).some((item) => item._remoteChanged);
  }

  /**
   * Gibt alle remote-geänderten aktiven Items einer Liste zurück
   * @param {string} listId - Die ID der Liste
   * @returns {Array} Array von geänderten Items
   */
  function getChangedItemsForList(listId) {
    return items.value.filter((i) => i.list_id === listId && i._remoteChanged && !i.markedDeleted);
  }

  /**
   * Fragt die Berechtigung für Browser/OS-Benachrichtigungen an.
   * Muss beim ersten Mal durch eine Nutzeraktion ausgelöst werden.
   */
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
  }

  /**
   * Zeigt eine OS-/Browser-Systembenachrichtigung.
   * Nutzt den Service Worker (PWA), wenn verfügbar – damit die Nachricht
   * auch über der installierten App erscheint. Fallback auf window.Notification.
   * Zeigt maximal 3 Items pro Kategorie.
   */
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
   * Erzeugt Benachrichtigungen für alle remote-geänderten Items,
   * gruppiert nach Liste mit 3 Kategorien: modified / added / deleted.
   * Feuert für neue Gruppen auch eine echte OS-Benachrichtigung.
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
   * Entfernt eine einzelne Benachrichtigung aus der Liste
   * @param {string} id - Die Benachrichtigungs-ID
   */
  function dismissNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  /**
   * Entfernt alle Änderungs-Hinweise für eine Liste
   * @param {string} listId - Die ID der Liste
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
   * User akzeptiert die Löschung (Ja → markedDeleted anwenden)
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
   * User lehnt die Löschung ab (Nein → lokalen Zustand zurückpushen)
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
   * Ändert den Namen einer Liste
   * @param {string} listId - Die ID der Liste
   * @param {string} newName - Der neue Name
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
   * Ändert den Namen eines Artikels
   * @param {Object} item - Das zu ändernde Item
   * @param {string} newName - Der neue Name
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
   * Berechnet den Fortschritt einer Listein Prozent (nur aktive Items)
   * @param {string} listId - Die ID der Liste
   * @returns {number} Fortschritt in Prozent (0-100)
   */
  function getProgress(listId) {
    const listItems = getActiveItemsForList(listId);
    if (listItems.length === 0) return 0;
    const checked = listItems.filter((i) => i.checked).length;
    return Math.round((checked / listItems.length) * 100);
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
    generateShareCode,
    joinListByCode,
  };
}
