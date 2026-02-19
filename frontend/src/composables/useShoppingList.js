import { ref, onMounted, onUnmounted } from 'vue'
import { startSync, stopSync, getAllDocs, updateDoc } from './database'

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
      syncHandler = startSync((status) => {
        isOnline.value = status.online
        syncActive.value = status.syncing
      })
      syncActive.value = true
    } catch (err) {
      console.error('Sync initialization failed:', err)
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

    // Actions
    toggleItem,
    getItemsForList,
    getProgress
  }
}

