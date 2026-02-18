import { ref, onMounted } from 'vue'

/**
 * Composable für die Einkaufslisten-Logik
 * Hier wird später PouchDB für Offline-Sync integriert
 */
export function useShoppingList() {
  // State
  const lists = ref([])
  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  // Konfiguration - später in separates Config-File auslagern
  const COUCHDB_URL = 'http://localhost:5984/einkaufsliste'
  const AUTH = btoa('admin:passwort')

  /**
   * Lädt alle Listen und Items aus der Datenbank
   */
  async function loadData() {
    try {
      loading.value = true

      const response = await fetch(`${COUCHDB_URL}/_all_docs?include_docs=true`, {
        headers: {
          'Authorization': `Basic ${AUTH}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      lists.value = data.rows
        .map(row => row.doc)
        .filter(doc => doc.type === 'list' && !doc.deleted)

      items.value = data.rows
        .map(row => row.doc)
        .filter(doc => doc.type === 'item' && !doc.deleted)

      error.value = null
    } catch (err) {
      console.error('Fehler beim Laden:', err)
      error.value = 'Verbindung zur Datenbank fehlgeschlagen'
    } finally {
      loading.value = false
    }
  }

  /**
   * Toggelt den Checked-Status eines Items
   * @param {Object} item - Das zu aktualisierende Item
   */
  async function toggleItem(item) {
    try {
      // Item lokal sofort updaten für besseres UX
      item.checked = !item.checked

      // Update in CouchDB
      const response = await fetch(`${COUCHDB_URL}/${item._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...item,
          checked: item.checked
        })
      })

      if (!response.ok) {
        // Bei Fehler zurücksetzen
        item.checked = !item.checked
        throw new Error('Update fehlgeschlagen')
      }

      const result = await response.json()
      // Rev aktualisieren für nächstes Update
      item._rev = result.rev

    } catch (err) {
      console.error('Fehler beim Updaten:', err)
      error.value = 'Item konnte nicht aktualisiert werden'
      setTimeout(() => error.value = null, 3000)
    }
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
  })

  // Public API
  return {
    // State
    lists,
    items,
    loading,
    error,

    // Actions
    loadData,
    toggleItem,
    getItemsForList,
    getProgress
  }
}

