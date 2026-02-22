import { ref, onMounted, onUnmounted } from 'vue'
import { startSync, stopSync, getAllDocs, updateDoc, createDoc, hardDeleteDoc, restoreLocalVersion, clearRemoteChangedFlag, applyConflictResolution, clearPendingDeleteFlag } from './database'
import { useSession } from './useSession'

/**
 * Composable für die Einkaufslisten-Logik mit PouchDB Offline-First
 */
export function useShoppingList() {
  const { sessionName } = useSession()

  // State
  const lists = ref([])
  const items = ref([])
  const loading = ref(true)
  const error = ref(null)
  const isOnline = ref(false) // Initial false, wird durch ersten Sync gesetzt
  const syncActive = ref(false)
  const conflicts = ref({}) // nicht mehr aktiv genutzt, für Kompatibilität behalten

  let syncHandler = null

  /**
   * Lädt alle Listen und Items aus der lokalen Datenbank
   */
  async function loadData() {
    try {
      loading.value = true

      const docs = await getAllDocs()

      lists.value = docs.filter(doc => doc.type === 'list' && !doc.deleted)
      items.value = docs.filter(doc => doc.type === 'item' && !doc.deleted)

      error.value = null
    } catch (err) {
      console.error('Fehler beim Laden:', err)
      error.value = 'Fehler beim Laden der lokalen Daten'
    } finally {
      loading.value = false
    }
  }

  async function deleteList(list) {
    // Zuerst alle Items der Liste löschen
    const listItems = getItemsForList(list._id)
    for (const item of listItems) {
      await hardDeleteDoc(item._id)
    }
    await hardDeleteDoc(list._id)
    await loadData()
  }

  async function addItem(listId, name) {
    if (!name || !name.trim()) return
    await createDoc({
      type: 'item',
      list_id: listId,
      name: name.trim(),
      checked: false,
      markedDeleted: false,
      lastModifiedBy: sessionName.value || 'Unbekannt',
    })
    await loadData()
  }

  async function addList(name) {
    if (!name || !name.trim()) return
    await createDoc({
      type: 'list',
      name: name.trim(),
      owner: sessionName.value || 'Unbekannt',
      deleted: false,
    })
    await loadData()
  }

  /**
   * Toggelt den Checked-Status eines Items (nur lokal)
   * @param {Object} item - Das zu aktualisierende Item
   */
  async function toggleItem(item) {
    try {
      const newCheckedState = !item.checked
      item.checked = newCheckedState

      const result = await updateDoc(item._id, (doc) => {
        return {
          ...doc,
          checked: newCheckedState,
          lastModifiedBy: sessionName.value || 'Unbekannt',
          updatedAt: new Date().toISOString()
        }
      })

      item._rev = result.rev

    } catch (err) {
      console.error('Fehler beim Updaten:', err)
      item.checked = !item.checked
      error.value = 'Item konnte nicht aktualisiert werden'
      setTimeout(() => error.value = null, 3000)
    }
  }

  /**
   * Initialisiert die Synchronisation (läuft im Hintergrund)
   */
  function initSync() {
    try {
      syncHandler = startSync(
        // Status-Callback
        (status) => {
          isOnline.value = status.online
          syncActive.value = status.syncing
        },
        // Conflict-Callback – nicht mehr für markedDeleted nötig
        () => {},
        // Data-Change-Callback
        (changedDocIds) => {
          loadData() // UI neu laden bei Remote-Änderungen
        }
      )
      syncActive.value = true
    } catch (err) {
      console.error('Sync initialization failed:', err)
    }
  }

  // Nicht mehr benötigt - _pendingDelete wird direkt auf items gesetzt
  function handleConflict() {}
  function dismissConflict() {}
  function getConflictForItem() { return null }
  async function resolveConflict() {}

  /**
   * Online/Offline Event-Handler
   */
  function handleOnline() {
    console.log('Network is online')
    // Status wird durch Sync-Callback aktualisiert
  }

  function handleOffline() {
    console.log('Network is offline')
    isOnline.value = false
    syncActive.value = false
  }

  /**
   * Gibt alle Items für eine bestimmte Liste zurück
   * @param {string} listId - Die ID der Liste
   * @returns {Array} Array von Items
   */
  function getItemsForList(listId) {
    return items.value.filter(i => i.list_id === listId)
  }

  /**
   * Gibt aktive (nicht gelöscht markierte) Items für eine Liste zurück
   */
  function getActiveItemsForList(listId) {
    return items.value.filter(i => i.list_id === listId && !i.markedDeleted)
  }

  /**
   * Gibt als gelöscht markierte Items für eine Liste zurück
   */
  function getDeletedItemsForList(listId) {
    return items.value.filter(i => i.list_id === listId && i.markedDeleted)
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
          updatedAt: new Date().toISOString()
        }
      })
      item._rev = result.rev
      item.markedDeleted = false
    } catch (err) {
      console.error('Fehler beim Wiederherstellen:', err)
      error.value = 'Item konnte nicht wiederhergestellt werden'
      setTimeout(() => error.value = null, 3000)
    }
  }

  /**
   * Löscht alle als gelöscht markierten Items einer Liste endgültig
   * @param {string} listId - Die ID der Liste
   */
  async function permanentlyDeleteAllMarked(listId) {
    const deletedItems = getDeletedItemsForList(listId)
    for (const item of deletedItems) {
      await hardDeleteDoc(item._id)
    }
    await loadData()
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
          updatedAt: new Date().toISOString()
        }
      })
      item._rev = result.rev
      item.markedDeleted = true
    } catch (err) {
      console.error('Fehler beim Markieren als gelöscht:', err)
      error.value = 'Item konnte nicht gelöscht werden'
      setTimeout(() => error.value = null, 3000)
    }
  }

  /**
   * Prüft ob eine Liste geänderte Items hat
   * @param {string} listId - Die ID der Liste
   * @returns {boolean} True wenn es geänderte Items gibt
   */
  function hasChangedItems(listId) {
    return getItemsForList(listId).some(item => item._remoteChanged)
  }

  /**
   * Entfernt alle Änderungs-Hinweise für eine Liste
   * @param {string} listId - Die ID der Liste
   */
  async function clearListChanges(listId) {
    const listItems = getItemsForList(listId)
    const changedItems = listItems.filter(item => item._remoteChanged)
    
    for (const item of changedItems) {
      await clearRemoteChangedFlag(item._id)
    }
    
    await loadData() // UI aktualisieren
  }

  /**
   * User akzeptiert die Löschung (Ja → markedDeleted anwenden)
   */
  async function acceptDelete(item) {
    try {
      item._pendingDelete = undefined
      const result = await updateDoc(item._id, (doc) => {
        const clean = { ...doc }
        delete clean._pendingDelete
        return { ...clean, markedDeleted: true, lastModifiedBy: sessionName.value || 'Unbekannt', updatedAt: new Date().toISOString() }
      })
      await loadData()
    } catch (err) {
      console.error('Fehler beim Akzeptieren der Löschung:', err)
    }
  }

  /**
   * User lehnt die Löschung ab (Nein → lokalen Zustand zurückpushen)
   */
  async function rejectDelete(item) {
    try {
      item._pendingDelete = undefined
      const result = await updateDoc(item._id, (doc) => {
        const clean = { ...doc }
        delete clean._pendingDelete
        return { ...clean, markedDeleted: false, lastModifiedBy: sessionName.value || 'Unbekannt', updatedAt: new Date().toISOString() }
      })
      await loadData()
    } catch (err) {
      console.error('Fehler beim Ablehnen der Löschung:', err)
    }
  }

  /**
   * Berechnet den Fortschritt einer Listein Prozent (nur aktive Items)
   * @param {string} listId - Die ID der Liste
   * @returns {number} Fortschritt in Prozent (0-100)
   */
  function getProgress(listId) {
    const listItems = getActiveItemsForList(listId)
    if (listItems.length === 0) return 0
    const checked = listItems.filter(i => i.checked).length
    return Math.round((checked / listItems.length) * 100)
  }

  // Daten beim Mount laden
  onMounted(() => {
    loadData()
    initSync()
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    stopSync()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

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

    // Actions
    toggleItem,
    addItem,
    addList,
    deleteList,
    getItemsForList,
    getActiveItemsForList,
    getDeletedItemsForList,
    markItemDeleted,
    restoreItem,
    permanentlyDeleteAllMarked,
    getProgress,
    getConflictForItem,
    resolveConflict,
    acceptDelete,
    rejectDelete,
    hasChangedItems,
    clearListChanges
  }
}

