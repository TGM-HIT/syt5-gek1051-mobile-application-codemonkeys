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
   * Berechnet den Fortschritt einer Liste in Prozent
   * @param {string} listId - Die ID der Liste
   * @returns {number} Fortschritt in Prozent (0-100)
   */
  function getProgress(listId) {
    const listItems = getItemsForList(listId)
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
    getProgress,
    dismissConflict,
    restoreMyVersion,
    hasChangedItems,
    clearListChanges
  }
}

