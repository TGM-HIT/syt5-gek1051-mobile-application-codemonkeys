<script setup>
import { ref, computed, onMounted } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { useSession } from '@/composables/useSession';
import SessionSetup from './SessionSetup.vue';
import ThemeToggle from './ThemeToggle.vue';

// Alle Logik ist jetzt im Composable ausgelagert
const {
  lists,
  items,
  loading,
  error,
  isOnline,
  syncActive,
  notifications,
  requestNotificationPermission,
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
  acceptDelete,
  rejectDelete,
  hasChangedItems,
  clearListChanges,
  dismissNotification,
  generateShareCode,
  joinListByCode,
} = useShoppingList();

// ── Benachrichtigungsberechtigung ──
const notifPermission = ref(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

async function enableNotifications() {
  const result = await requestNotificationPermission();
  notifPermission.value = result;
}

// ── PWA Install ──
const installPrompt = ref(null);
const installable = ref(false);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt.value = e;
  installable.value = true;
});

window.addEventListener('appinstalled', () => {
  installable.value = false;
  installPrompt.value = null;
});

async function installPwa() {
  if (!installPrompt.value) return;
  installPrompt.value.prompt();
  const { outcome } = await installPrompt.value.userChoice;
  if (outcome === 'accepted') {
    installable.value = false;
    installPrompt.value = null;
  }
}

onMounted(() => {
  if (typeof Notification !== 'undefined') {
    notifPermission.value = Notification.permission;
  }
});

// ── Nur geänderte Artikel anzeigen ──
const showOnlyChanged = ref(false);

function getDisplayItems(listId) {
  if (showOnlyChanged.value) {
    return getChangedItemsForList(listId);
  }
  return getActiveItemsForList(listId);
}

const totalChangedCount = computed(() => items.value.filter((i) => i._remoteChanged).length);

const { sessionName, clearSession } = useSession();

// ── Inline Editing ──
const editingListId = ref(null);
const editingListName = ref('');
const editingItemId = ref(null);
const editingItemName = ref('');

function startEditList(list) {
  editingListId.value = list._id;
  editingListName.value = list.name;
}

function cancelEditList() {
  editingListId.value = null;
  editingListName.value = '';
}

async function saveEditList(listId) {
  if (editingListName.value.trim()) {
    await renameList(listId, editingListName.value);
  }
  editingListId.value = null;
  editingListName.value = '';
}

function startEditItem(item) {
  editingItemId.value = item._id;
  editingItemName.value = item.name;
}

function cancelEditItem() {
  editingItemId.value = null;
  editingItemName.value = '';
}

async function saveEditItem(item) {
  if (editingItemName.value.trim()) {
    await renameItem(item, editingItemName.value);
  }
  editingItemId.value = null;
  editingItemName.value = '';
}

// ── Suche ──
const searchQuery = ref('');
function clearSearch() {
  searchQuery.value = '';
}
function isSearchMatch(item) {
  if (!searchQuery.value) return true;
  return item.name.toLowerCase().includes(searchQuery.value.toLowerCase());
}

// Neue Liste
const newListName = ref('');
function submitNewList() {
  addList(newListName.value);
  newListName.value = '';
}

// Neuer Artikel pro Liste
const newItemNames = ref({});
function submitNewItem(listId) {
  addItem(listId, newItemNames.value[listId] || '');
  newItemNames.value[listId] = '';
}

// Aktiver Tab pro Liste: 'active' oder 'deleted'
const activeTabs = ref({});

function getTab(listId) {
  return activeTabs.value[listId] || 'active';
}

function setTab(listId, tab) {
  activeTabs.value[listId] = tab;
}

// ── Sharing ──
const shareModal = ref({ show: false, listId: null, code: null, loading: false });
const joinCode = ref('');
const joinMessage = ref({ text: '', type: '' });

async function openShareDialog(list) {
  shareModal.value = { show: true, listId: list._id, code: list.shareCode || null, loading: false };
  // Falls noch kein Code existiert, gleich generieren
  if (!list.shareCode) {
    shareModal.value.loading = true;
    const code = await generateShareCode(list._id);
    shareModal.value.code = code;
    shareModal.value.loading = false;
  }
}

function closeShareDialog() {
  shareModal.value = { show: false, listId: null, code: null, loading: false };
}

async function copyShareCode() {
  if (shareModal.value.code) {
    await navigator.clipboard.writeText(shareModal.value.code);
  }
}

async function submitJoinCode() {
  joinMessage.value = { text: '', type: '' };
  if (!joinCode.value.trim()) {
    joinMessage.value = { text: 'Bitte einen Code eingeben.', type: 'error' };
    return;
  }
  const result = await joinListByCode(joinCode.value);
  joinMessage.value = { text: result.message, type: result.success ? 'success' : 'error' };
  if (result.success) {
    joinCode.value = '';
    setTimeout(() => {
      joinMessage.value = { text: '', type: '' };
    }, 3000);
  }
}

// Custom confirm modal
const confirmModal = ref({
  show: false,
  title: '',
  message: '',
  step: 1,
  listId: null,
  action: null,
});

function showConfirm(title, message, action) {
  confirmModal.value = { show: true, title, message, step: 1, action };
}

function confirmStep1() {
  confirmModal.value.step = 2;
  confirmModal.value.message =
    'Bist du wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden!';
}

function confirmStep2() {
  const action = confirmModal.value.action;
  confirmModal.value = { show: false };
  if (action) action();
}

function closeConfirm() {
  confirmModal.value = { show: false };
}

function confirmPermanentDelete(listId) {
  showConfirm(
    'Alle löschen?',
    'Willst du wirklich alle gelöschten Artikel endgültig löschen?',
    () => permanentlyDeleteAllMarked(listId),
  );
}

function confirmDeleteList(list) {
  const listItems = getItemsForList(list._id);
  if (listItems.length > 0) {
    showConfirm(
      'Liste nicht leer',
      `Die Liste "${list.name}" hat noch ${listItems.length} Artikel. Bitte zuerst alle Artikel endgültig löschen.`,
      null,
    );
    return;
  }
  showConfirm('Liste löschen?', `Willst du die Liste "${list.name}" wirklich löschen?`, () =>
    deleteList(list),
  );
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
          <div
            class="session-badge"
            v-if="sessionName"
            @click="clearSession"
            title="Session beenden"
          >
            👤 {{ sessionName }}
          </div>
          <button
            v-if="installable"
            class="pwa-install-btn"
            @click="installPwa"
            title="App installieren"
          >
            📲
          </button>
          <ThemeToggle />
          <button
            v-if="notifPermission === 'default'"
            class="notif-enable-btn"
            @click="enableNotifications"
            title="Benachrichtigungen aktivieren"
          >
            🔔 Benachrichtigungen erlauben
          </button>
          <span v-else-if="notifPermission === 'denied'" class="notif-denied-hint" title="In den Browser-Einstellungen aktivieren">
            🔕 Benachrichtigungen blockiert
          </span>
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
        <div v-if="loading" class="message">Daten werden geladen...</div>

        <!-- Error -->
        <div v-if="error && !loading" class="message error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ error }}</span>
          <button class="error-close" @click="error = null" title="Schließen">✕</button>
        </div>

        <!-- Neue Liste hinzufügen -->
        <div class="add-list-form">
          <input
            v-model="newListName"
            class="add-input"
            placeholder="Neue Liste..."
            @keyup.enter="submitNewList"
          />
          <button class="add-btn" @click="submitNewList">+ Liste</button>
        </div>

        <!-- Liste beitreten -->
        <div class="join-form">
          <input
            v-model="joinCode"
            class="join-input"
            placeholder="Share-Code eingeben..."
            maxlength="6"
            @keyup.enter="submitJoinCode"
          />
          <button class="join-btn" @click="submitJoinCode">🔗 Beitreten</button>
        </div>
        <div v-if="joinMessage.text" class="join-message" :class="joinMessage.type">
          {{ joinMessage.text }}
        </div>

        <!-- Suchfeld -->
        <div class="search-bar">
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Artikel suchen…"
          />
          <button
            v-if="searchQuery"
            class="search-clear-btn"
            @click="clearSearch"
            title="Suche zurücksetzen"
          >
            ✕
          </button>
        </div>

        <!-- Benachrichtigungen -->
        <div v-if="notifications.length > 0" class="notifications">
          <div v-for="notif in notifications" :key="notif.id" class="notification-banner">
            <div class="notif-header">
              <span class="notif-list-name">🛒 {{ notif.listName }}</span>
              <button class="notification-dismiss" @click="dismissNotification(notif.id)" title="Schließen">✕</button>
            </div>
            <div class="notif-body">
              <div v-if="notif.modified.length > 0" class="notif-row notif-modified">
                <span class="notif-label">✏️ Geändert</span>
                <span class="notif-items">{{ notif.modified.join(', ') }}</span>
              </div>
              <div v-if="notif.added.length > 0" class="notif-row notif-added">
                <span class="notif-label">➕ Hinzugefügt</span>
                <span class="notif-items">{{ notif.added.join(', ') }}</span>
              </div>
              <div v-if="notif.deleted.length > 0" class="notif-row notif-deleted">
                <span class="notif-label">🗑️ Gelöscht markiert</span>
                <span class="notif-items">{{ notif.deleted.join(', ') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter: Nur geänderte Artikel -->
        <div class="filter-bar">
          <button
            class="filter-changed-btn"
            :class="{ active: showOnlyChanged }"
            @click="showOnlyChanged = !showOnlyChanged"
          >
            {{ showOnlyChanged ? '✓ Nur geänderte' : 'Nur geänderte' }}
            <span class="filter-badge" :class="{ 'filter-badge-active': showOnlyChanged }">
              {{ totalChangedCount }}
            </span>
          </button>
        </div>

        <!-- Listen -->
        <div v-if="!loading && !error" class="lists">
          <div v-for="list in lists" :key="list._id" class="list">
            <div class="list-header">
              <div class="list-title">
                <div v-if="editingListId !== list._id" class="list-name-display">
                  <h2>{{ list.name }}</h2>
                  <button
                    class="edit-list-btn"
                    @click="startEditList(list)"
                    title="Liste umbenennen"
                  >
                    ✏️
                  </button>
                </div>
                <div v-else class="edit-list-form">
                  <input
                    v-model="editingListName"
                    class="edit-input"
                    @keyup.enter="saveEditList(list._id)"
                    @keyup.esc="cancelEditList"
                    ref="editListInput"
                    autofocus
                  />
                  <button class="edit-save-btn" @click="saveEditList(list._id)" title="Speichern">
                    ✓
                  </button>
                  <button class="edit-cancel-btn" @click="cancelEditList" title="Abbrechen">
                    ✕
                  </button>
                </div>
                <span class="list-meta"
                  >{{ list.owner }} •
                  {{ new Date(list.createdAt).toLocaleDateString('de-DE') }}</span
                >
              </div>
              <div class="list-stats">
                <button
                  v-if="hasChangedItems(list._id)"
                  @click="clearListChanges(list._id)"
                  class="clear-changes-btn"
                  title="Änderungshinweise entfernen"
                >
                  ✓ Gesehen
                </button>
                <span class="progress-text">{{ getProgress(list._id) }}%</span>
                <button class="share-list-btn" title="Liste teilen" @click="openShareDialog(list)">
                  🔗
                </button>
                <button
                  class="delete-list-btn"
                  title="Liste löschen"
                  @click="confirmDeleteList(list)"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgress(list._id) + '%' }"></div>
            </div>

            <!-- Tabs (ausgeblendet wenn nur geänderte angezeigt werden) -->
            <div v-if="!showOnlyChanged" class="tabs">
              <button
                class="tab-btn"
                :class="{ active: getTab(list._id) === 'active' }"
                @click="setTab(list._id, 'active')"
              >
                Aktiv
                <span class="tab-count">{{ getActiveItemsForList(list._id).length }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ active: getTab(list._id) === 'deleted' }"
                @click="setTab(list._id, 'deleted')"
              >
                Gelöscht
                <span class="tab-count">{{ getDeletedItemsForList(list._id).length }}</span>
              </button>
            </div>

            <!-- Tab: Aktive Artikel / Geänderte Artikel -->
            <ul v-if="showOnlyChanged || getTab(list._id) === 'active'" class="items">
              <template v-for="item in getDisplayItems(list._id)" :key="item._id">
                <li
                  :class="{
                    checked: item.checked,
                    'search-dimmed': searchQuery && !isSearchMatch(item),
                  }"
                  class="item"
                >
                  <input
                    type="checkbox"
                    :checked="item.checked"
                    @click.stop="toggleItem(item)"
                    class="checkbox"
                  />
                  <div class="item-content" @click="toggleItem(item)">
                    <div v-if="editingItemId !== item._id" class="item-name-display">
                      <span class="item-name">{{ item.name }}</span>
                      <button
                        class="edit-item-btn"
                        @click.stop="startEditItem(item)"
                        title="Artikel umbenennen"
                      >
                        ✏️
                      </button>
                    </div>
                    <div v-else class="edit-item-form" @click.stop>
                      <input
                        v-model="editingItemName"
                        class="edit-input"
                        @keyup.enter="saveEditItem(item)"
                        @keyup.esc="cancelEditItem"
                        @click.stop
                        autofocus
                      />
                      <button
                        class="edit-save-btn"
                        @click.stop="saveEditItem(item)"
                        title="Speichern"
                      >
                        ✓
                      </button>
                      <button
                        class="edit-cancel-btn"
                        @click.stop="cancelEditItem"
                        title="Abbrechen"
                      >
                        ✕
                      </button>
                    </div>
                    <span
                      v-if="
                        item._remoteChanged && !item._pendingDelete && editingItemId !== item._id
                      "
                      class="item-changed-hint"
                    >
                      ✏️ Geändert von {{ item.lastModifiedBy || 'Unbekannt' }}
                    </span>
                  </div>
                  <button
                    v-if="editingItemId !== item._id"
                    class="delete-item-btn"
                    title="Als gelöscht markieren"
                    @click.stop="markItemDeleted(item)"
                  >
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

            <!-- Tab: Gelöschte Artikel (nur wenn kein Filter aktiv) -->
            <template v-if="!showOnlyChanged && getTab(list._id) === 'deleted'">
              <div v-if="getDeletedItemsForList(list._id).length > 0" class="permanent-delete-bar">
                <button class="permanent-delete-btn" @click="confirmPermanentDelete(list._id)">
                  🗑️ Alle endgültig löschen
                </button>
              </div>
              <ul class="items">
                <template v-for="item in getDeletedItemsForList(list._id)" :key="item._id">
                  <li
                    :class="{ 'search-dimmed': searchQuery && !isSearchMatch(item) }"
                    class="item item-deleted"
                  >
                    <div class="item-content">
                      <span class="item-name">{{ item.name }}</span>
                    </div>
                    <button
                      class="restore-item-btn"
                      title="Wiederherstellen"
                      @click.stop="restoreItem(item)"
                    >
                      ↩️
                    </button>
                  </li>
                </template>
              </ul>
            </template>

            <div
              v-if="(showOnlyChanged || getTab(list._id) === 'active') && getDisplayItems(list._id).length === 0"
              class="empty-list"
            >
              {{ showOnlyChanged ? 'Keine geänderten Artikel in dieser Liste' : 'Keine aktiven Artikel in dieser Liste' }}
            </div>

            <!-- Artikel hinzufügen (nur wenn kein Filter aktiv) -->
            <div v-if="!showOnlyChanged && getTab(list._id) === 'active'" class="add-item-form">
              <input
                v-model="newItemNames[list._id]"
                class="add-input"
                placeholder="Neuer Artikel..."
                @keyup.enter="submitNewItem(list._id)"
              />
              <button class="add-btn" @click="submitNewItem(list._id)">+</button>
            </div>
            <div
              v-if="!showOnlyChanged && getTab(list._id) === 'deleted' && getDeletedItemsForList(list._id).length === 0"
              class="empty-list"
            >
              Keine gelöschten Artikel
            </div>
          </div>

          <div v-if="lists.length === 0" class="message">Keine Listen vorhanden</div>
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
          <button class="modal-btn-cancel" @click="closeConfirm">
            {{ confirmModal.action ? 'Abbrechen' : 'OK' }}
          </button>
          <button
            v-if="confirmModal.action && confirmModal.step === 1"
            class="modal-btn-confirm"
            @click="confirmStep1"
          >
            Weiter
          </button>
          <button
            v-else-if="confirmModal.action && confirmModal.step === 2"
            class="modal-btn-confirm modal-btn-danger"
            @click="confirmStep2"
          >
            Ja, löschen
          </button>
        </div>
      </div>
    </div>

    <!-- Share Code Modal -->
    <div v-if="shareModal.show" class="modal-overlay" @click.self="closeShareDialog">
      <div class="modal share-modal">
        <div class="modal-title">🔗 Liste teilen</div>
        <div v-if="shareModal.loading" class="modal-message">Code wird generiert...</div>
        <div v-else class="share-code-display">
          <div class="share-code-label">Dein Share-Code:</div>
          <div class="share-code">{{ shareModal.code }}</div>
          <button class="share-copy-btn" @click="copyShareCode">📋 Code kopieren</button>
          <p class="share-hint">Teile diesen Code, damit andere der Liste beitreten können.</p>
        </div>
        <div class="modal-btns">
          <button class="modal-btn-cancel" @click="closeShareDialog">Schließen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ShoppingList.css"></style>
