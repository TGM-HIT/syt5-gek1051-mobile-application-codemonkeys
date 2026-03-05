<script setup>
import { ref } from 'vue'
import { useShoppingList } from '@/composables/useShoppingList'
import { useSession } from '@/composables/useSession'
import SessionSetup from './SessionSetup.vue'

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
} = useShoppingList()

const { sessionName, clearSession } = useSession()

// Neue Liste
const newListName = ref('')
function submitNewList() {
  addList(newListName.value)
  newListName.value = ''
}

// Neuer Artikel pro Liste
const newItemNames = ref({})
function submitNewItem(listId) {
  addItem(listId, newItemNames.value[listId] || '')
  newItemNames.value[listId] = ''
}

// Aktiver Tab pro Liste: 'active' oder 'deleted'
const activeTabs = ref({})

function getTab(listId) {
  return activeTabs.value[listId] || 'active'
}

function setTab(listId, tab) {
  activeTabs.value[listId] = tab
}

function conflictBannerText(conflict) {
  const f = conflict.conflictingFields[0]
  if (!f) return 'Konflikt erkannt.'
  if (f.crossField) {
    const deleter = f.remoteValue ? f.remoteUser : f.localUser
    const other   = f.remoteValue ? f.localUser  : f.remoteUser
    return `👤 ${other} hat diesen Artikel geändert. 👤 ${deleter} hat ihn als gelöscht markiert.`
  }
  if (f.field === 'checked') {
    const remoteState = f.remoteValue ? 'abgehakt ✅' : 'nicht abgehakt ☐'
    return `👤 ${f.remoteUser} hat diesen Artikel ${remoteState}.`
  }
  return `👤 ${f.remoteUser} hat etwas geändert.`
}

// Custom confirm modal
const confirmModal = ref({ show: false, title: '', message: '', step: 1, listId: null, action: null })

function showConfirm(title, message, action) {
  confirmModal.value = { show: true, title, message, step: 1, action }
}

function confirmStep1() {
  confirmModal.value.step = 2
  confirmModal.value.message = 'Bist du wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden!'
}

function confirmStep2() {
  const action = confirmModal.value.action
  confirmModal.value = { show: false }
  if (action) action()
}

function closeConfirm() {
  confirmModal.value = { show: false }
}

function confirmPermanentDelete(listId) {
  showConfirm('Alle löschen?', 'Willst du wirklich alle gelöschten Artikel endgültig löschen?', () => permanentlyDeleteAllMarked(listId))
}

function confirmDeleteList(list) {
  const listItems = getItemsForList(list._id)
  if (listItems.length > 0) {
    showConfirm('Liste nicht leer', `Die Liste "${list.name}" hat noch ${listItems.length} Artikel. Bitte zuerst alle Artikel endgültig löschen.`, null)
    return
  }
  showConfirm('Liste löschen?', `Willst du die Liste "${list.name}" wirklich löschen?`, () => deleteList(list))
}
</script>

<template>
  <div class="app">
    <!-- Session Setup Modal -->
    <SessionSetup v-if="!sessionName" />

    <header class="header">
      <div class="container">
        <h1>Einkaufslisten</h1>
        <div class="header-actions">
          <div class="session-badge" v-if="sessionName" @click="clearSession" title="Session beenden">
            👤 {{ sessionName }}
          </div>
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

        <!-- Neue Liste hinzufügen -->
        <div class="add-list-form">
          <input
            v-model="newListName"
            class="add-input"
            placeholder="Neue Liste..."
            @keyup.enter="submitNewList" />
          <button class="add-btn" @click="submitNewList">+ Liste</button>
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
                <button class="delete-list-btn" title="Liste löschen" @click="confirmDeleteList(list)">🗑️</button>
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
              <template v-for="item in getActiveItemsForList(list._id)" :key="item._id">
                <li :class="{ checked: item.checked }" class="item">
                  <input type="checkbox"
                         :checked="item.checked"
                         @click.stop="toggleItem(item)"
                         class="checkbox">
                  <div class="item-content" @click="toggleItem(item)">
                    <span class="item-name">{{ item.name }}</span>
                    <span v-if="item._remoteChanged && !item._pendingDelete" class="item-changed-hint">
                      ✏️ Geändert von {{ item.lastModifiedBy || 'Unbekannt' }}
                    </span>
                  </div>
                  <button
                    class="delete-item-btn"
                    title="Als gelöscht markieren"
                    @click.stop="markItemDeleted(item)">
                    🗑️
                  </button>
                </li>
                <!-- Inline Lösch-Banner (jemand anderes hat gelöscht) -->
                <li v-if="item._pendingDelete" class="conflict-banner">
                  <div class="conflict-banner-text">
                    🗑️ <strong>{{ item._pendingDelete }}</strong> hat diesen Artikel gelöscht.
                  </div>
                  <div class="conflict-banner-btns">
                    <button class="cbtn-keep-remote" @click="acceptDelete(item)">Ja</button>
                    <button class="cbtn-keep-local" @click="rejectDelete(item)">Nein</button>
                  </div>
                </li>
              </template>
            </ul>

            <!-- Tab: Gelöschte Artikel -->
            <template v-if="getTab(list._id) === 'deleted'">
              <div v-if="getDeletedItemsForList(list._id).length > 0" class="permanent-delete-bar">
                <button class="permanent-delete-btn" @click="confirmPermanentDelete(list._id)">
                  🗑️ Alle endgültig löschen
                </button>
              </div>
              <ul class="items">
                <template v-for="item in getDeletedItemsForList(list._id)" :key="item._id">
                  <li class="item item-deleted">
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
                </template>
              </ul>
            </template>

            <div v-if="getTab(list._id) === 'active' && getActiveItemsForList(list._id).length === 0" class="empty-list">
              Keine aktiven Artikel in dieser Liste
            </div>

            <!-- Artikel hinzufügen -->
            <div v-if="getTab(list._id) === 'active'" class="add-item-form">
              <input
                v-model="newItemNames[list._id]"
                class="add-input"
                placeholder="Neuer Artikel..."
                @keyup.enter="submitNewItem(list._id)" />
              <button class="add-btn" @click="submitNewItem(list._id)">+</button>
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

    <!-- Conflict Notifications entfernt: Konflikte werden inline beim Artikel angezeigt -->

    <!-- Custom Confirm Modal -->
    <div v-if="confirmModal.show" class="modal-overlay" @click.self="closeConfirm">
      <div class="modal">
        <div class="modal-title">{{ confirmModal.title }}</div>
        <div class="modal-message">{{ confirmModal.message }}</div>
        <div class="modal-btns">
          <button class="modal-btn-cancel" @click="closeConfirm">{{ confirmModal.action ? 'Abbrechen' : 'OK' }}</button>
          <button v-if="confirmModal.action && confirmModal.step === 1" class="modal-btn-confirm" @click="confirmStep1">Weiter</button>
          <button v-else-if="confirmModal.action && confirmModal.step === 2" class="modal-btn-confirm modal-btn-danger" @click="confirmStep2">Ja, löschen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ShoppingList.css"></style>
