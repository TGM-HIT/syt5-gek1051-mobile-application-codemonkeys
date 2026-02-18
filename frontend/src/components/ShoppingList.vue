<script setup>
import { ref, onMounted } from 'vue'

const lists = ref([])
const items = ref([])
const loading = ref(true)
const error = ref(null)

const COUCHDB_URL = 'http://localhost:5984/einkaufsliste'
const AUTH = btoa('admin:passwort')

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

function getItemsForList(listId) {
  return items.value.filter(i => i.list_id === listId)
}

function getProgress(listId) {
  const listItems = getItemsForList(listId)
  if (listItems.length === 0) return 0
  const checked = listItems.filter(i => i.checked).length
  return Math.round((checked / listItems.length) * 100)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <h1>Einkaufslisten</h1>
        <button @click="loadData" class="refresh-btn" :disabled="loading">
          {{ loading ? 'Lädt...' : 'Aktualisieren' }}
        </button>
      </div>
    </header>

    <main class="main">
      <div class="container">
        <!-- Loading -->
        <div v-if="loading" class="message">
          Daten werden geladen...
        </div>

        <!-- Error -->
        <div v-if="error && !loading" class="message error">
          {{ error }}
        </div>

        <!-- Listen -->
        <div v-if="!loading && !error" class="lists">
          <div v-for="list in lists" :key="list._id" class="list">
            <div class="list-header">
              <div class="list-title">
                <h2>{{ list.name }}</h2>
                <span class="list-meta">{{ list.owner }} • {{ new Date(list.createdAt).toLocaleDateString('de-DE') }}</span>
              </div>
              <div class="list-stats">
                <span class="progress-text">{{ getProgress(list._id) }}%</span>
              </div>
            </div>

            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgress(list._id) + '%' }"></div>
            </div>

            <ul class="items">
              <li v-for="item in getItemsForList(list._id)" :key="item._id" 
                  :class="{ checked: item.checked }"
                  class="item">
                <input type="checkbox" :checked="item.checked" disabled class="checkbox">
                <span class="item-name">{{ item.name }}</span>
              </li>
            </ul>

            <div v-if="getItemsForList(list._id).length === 0" class="empty-list">
              Keine Artikel in dieser Liste
            </div>
          </div>

          <div v-if="lists.length === 0" class="message">
            Keine Listen vorhanden
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  width: 100%;
}

.header {
  background: white;
  border-bottom: 2px solid #e0e0e0;
  padding: 1.25rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  width: 100%;
}

.container {
  padding: 0 2rem;
  width: 100%;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.refresh-btn {
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.refresh-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.refresh-btn:active:not(:disabled) {
  transform: translateY(0);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.main {
  padding: 2rem 0 3rem;
}

.message {
  padding: 1.25rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  text-align: center;
  color: #666;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.message.error {
  background: #fff5f5;
  border-color: #feb2b2;
  color: #c53030;
}

.lists {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.list {
  background: white;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: all 0.2s;
}

.list:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.list-header {
  padding: 1.5rem 1.75rem;
  background: linear-gradient(135deg, #ff0000 0%, #ffde00 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.list-title h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.list-meta {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.85);
  font-weight: 500;
}

.list-stats {
  text-align: right;
  flex-shrink: 0;
}

.progress-text {
  display: inline-block;
  padding: 0.375rem 0.875rem;
  background: rgba(255,255,255,0.2);
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 700;
  color: white;
  backdrop-filter: blur(10px);
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
  transition: width 0.4s ease;
}

.items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.75rem;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.item:last-child {
  border-bottom: none;
}

.item:hover {
  background: #fafafa;
}

.checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: #667eea;
}

.item-name {
  flex: 1;
  color: #2d3748;
  font-size: 1rem;
  line-height: 1.5;
}

.item.checked .item-name {
  text-decoration: line-through;
  color: #a0aec0;
}

.empty-list {
  padding: 2.5rem 1.75rem;
  text-align: center;
  color: #a0aec0;
  font-size: 0.95rem;
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 0 1rem;
  }

  h1 {
    font-size: 1.375rem;
  }

  .refresh-btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .list-header {
    padding: 1.25rem 1.25rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .list-title h2 {
    font-size: 1.25rem;
  }

  .list-stats {
    text-align: left;
  }

  .item {
    padding: 0.875rem 1.25rem;
  }

  .item-name {
    font-size: 0.95rem;
  }
}
</style>
