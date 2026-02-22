import { ref, onMounted, onUnmounted } from 'vue'
import { startSync, stopSync, getAllDocs, updateDoc, restoreLocalVersion, clearRemoteChangedFlag } from './database'

/**
 * Composable für die Einkaufslisten-Logik mit PouchDB Offline-First
 */
export function useShoppingList() {
  // State
  const lists = ref([])
  const items = ref([])
  const loading = ref(true)
  const error = ref(null)
  const isOnline = ref(false) // Initial false, wird durch ersten Sync gesetzt
  const syncActive = ref(false)
  const conflicts = ref([]) // Liste von Konflikten zur Anzeige

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
        // Conflict-Callback
        (conflict) => {
          handleConflict(conflict)
        },
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

  /**
   * Behandelt einen Konflikt und zeigt Notification
   */
  function handleConflict(conflict) {
    const item = items.value.find(i => i._id === conflict.docId) || 
                 lists.value.find(l => l._id === conflict.docId)
    
    const conflictInfo = {
      id: conflict.docId,
      timestamp: Date.now(),
      localVersion: conflict.localVersion,
      resolvedVersion: conflict.resolvedVersion,
      itemName: item?.name || item?.title || 'Unbekanntes Item'
    }
    
    conflicts.value.push(conflictInfo)
    
    // Auto-remove nach 10 Sekunden
    setTimeout(() => {
      dismissConflict(conflictInfo.id)
    }, 10000)
  }

  /**
   * User akzeptiert die Konfliktlösung
   */
  function dismissConflict(conflictId) {
    conflicts.value = conflicts.value.filter(c => c.id !== conflictId)
  }

  /**
   * User will eigene Version wiederherstellen
   */
  async function restoreMyVersion(conflictId) {
    const conflict = conflicts.value.find(c => c.id === conflictId)
    if (!conflict) return
    
    try {
      await restoreLocalVersion(conflictId, conflict.localVersion)
      dismissConflict(conflictId)
      await loadData() // UI aktualisieren
    } catch (err) {
      console.error('Failed to restore version:', err)
      error.value = 'Konnte Version nicht wiederherstellen'
      setTimeout(() => error.value = null, 3000)
    }
  }

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
      try {
        await updateDoc(item._id, (doc) => {
          return { ...doc, deleted: true, updatedAt: new Date().toISOString() }
        })
      } catch (err) {
        console.error('Fehler beim endgültigen Löschen:', err)
      }
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
   * Berechnet den Fortschritt einer Liste in Prozent (nur aktive Items)
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
    getItemsForList,
    getActiveItemsForList,
    getDeletedItemsForList,
    markItemDeleted,
    restoreItem,
    permanentlyDeleteAllMarked,
    getProgress,
    dismissConflict,
    restoreMyVersion,
    hasChangedItems,
    clearListChanges
  }
}

