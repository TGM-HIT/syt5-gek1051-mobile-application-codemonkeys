<script setup>
import { ref } from 'vue'
import { useShoppingList } from '@/composables/useShoppingList'
import ConflictNotification from './ConflictNotification.vue'

// Alle Logik ist jetzt im Composable ausgelagert
const {
  lists,
  items,
  loading,
  error,
  isOnline,
  syncActive,
  conflicts,
  toggleItem,
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
} = useShoppingList()

// Aktiver Tab pro Liste: 'active' oder 'deleted'
const activeTabs = ref({})

function getTab(listId) {
  return activeTabs.value[listId] || 'active'
}

function setTab(listId, tab) {
  activeTabs.value[listId] = tab
}

function confirmPermanentDelete(listId) {
  const first = confirm('Willst du wirklich alle gelöschten Artikel endgültig löschen?')
  if (!first) return
  const second = confirm('Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden!')
  if (!second) return
  permanentlyDeleteAllMarked(listId)
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <h1>Einkaufslisten</h1>
        <div class="header-actions">
          <div class="status-indicator" :class="{ online: isOnline, offline: !isOnline }">
            <span class="status-dot"></span>
            <span class="status-text">{{ isOnline ? 'Online' : 'Offline' }}</span>
            <span v-if="syncActive && isOnline" class="sync-text">• Sync aktiv</span>
          </div>
        </div>
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
                <button 
                  v-if="hasChangedItems(list._id)"
                  @click="clearListChanges(list._id)"
                  class="clear-changes-btn"
                  title="Änderungshinweise entfernen">
                  ✓ Gesehen
                </button>
                <span class="progress-text">{{ getProgress(list._id) }}%</span>
              </div>
            </div>

            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgress(list._id) + '%' }"></div>
            </div>

            <!-- Tabs -->
            <div class="tabs">
              <button
                class="tab-btn"
                :class="{ active: getTab(list._id) === 'active' }"
                @click="setTab(list._id, 'active')">
                Aktiv
                <span class="tab-count">{{ getActiveItemsForList(list._id).length }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ active: getTab(list._id) === 'deleted' }"
                @click="setTab(list._id, 'deleted')">
                Gelöscht
                <span class="tab-count">{{ getDeletedItemsForList(list._id).length }}</span>
              </button>
            </div>

            <!-- Tab: Aktive Artikel -->
            <ul v-if="getTab(list._id) === 'active'" class="items">
              <li v-for="item in getActiveItemsForList(list._id)" :key="item._id"
                  :class="{ checked: item.checked }"
                  class="item">
                <input type="checkbox"
                       :checked="item.checked"
                       @click.stop="toggleItem(item)"
                       class="checkbox">
                <div class="item-content" @click="toggleItem(item)">
                  <span class="item-name">{{ item.name }}</span>
                  <span v-if="item._remoteChanged" class="item-changed-hint">
                    Änderung wurde vorgenommen
                  </span>
                </div>
                <button
                  class="delete-item-btn"
                  title="Als gelöscht markieren"
                  @click.stop="markItemDeleted(item)">
                  🗑️
                </button>
              </li>
            </ul>

            <!-- Tab: Gelöschte Artikel -->
            <template v-if="getTab(list._id) === 'deleted'">
              <div v-if="getDeletedItemsForList(list._id).length > 0" class="permanent-delete-bar">
                <button class="permanent-delete-btn" @click="confirmPermanentDelete(list._id)">
                  🗑️ Alle endgültig löschen
                </button>
              </div>
              <ul class="items">
                <li v-for="item in getDeletedItemsForList(list._id)" :key="item._id"
                    class="item item-deleted">
                  <div class="item-content">
                    <span class="item-name">{{ item.name }}</span>
                  </div>
                  <button
                    class="restore-item-btn"
                    title="Wiederherstellen"
                    @click.stop="restoreItem(item)">
                    ↩️
                  </button>
                </li>
              </ul>
            </template>

            <div v-if="getTab(list._id) === 'active' && getActiveItemsForList(list._id).length === 0" class="empty-list">
              Keine aktiven Artikel in dieser Liste
            </div>
            <div v-if="getTab(list._id) === 'deleted' && getDeletedItemsForList(list._id).length === 0" class="empty-list">
              Keine gelöschten Artikel
            </div>
          </div>

          <div v-if="lists.length === 0" class="message">
            Keine Listen vorhanden
          </div>
        </div>
      </div>
    </main>

    <!-- Conflict Notifications -->
    <TransitionGroup name="conflict-list">
      <ConflictNotification
        v-for="conflict in conflicts"
        :key="conflict.id"
        :conflict="conflict"
        :style="{ bottom: (20 + conflicts.indexOf(conflict) * 100) + 'px' }"
        @dismiss="dismissConflict"
        @restore="restoreMyVersion"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped src="./ShoppingList.css"></style>
