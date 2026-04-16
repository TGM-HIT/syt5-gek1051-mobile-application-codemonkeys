<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useShoppingList } from '@/composables/useShoppingList';
import { useAuth } from '@/composables/useAuth';
import {
  useItemDetails,
  LABEL_COLORS,
  getLabelColor,
  getLabelObject,
} from '@/composables/useItemDetails';
import { useLabelFilter } from '@/composables/useLabelFilter';
import LabelFilterBar from '@/components/LabelFilterBar.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const router = useRouter();
const {
  currentUser,
  authLoading: authLoadingState,
  authError,
  clearError: clearAuthError,
  changePassword,
  logout: authLogout,
} = useAuth();

async function handleLogout() {
  await authLogout();
  router.push('/login');
}

// Alle Logik ist jetzt im Composable ausgelagert
const {
  lists,
  items,
  loading,
  error,
  isOnline,
  syncActive,
  notifications,
  notificationsEnabled,
  requestNotificationPermission,
  toggleItem,
  addItem,
  addList,
  deleteList,
  renameList,
  renameItem,
  updateItemDetails,
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
  exportBackup,
  importBackup,
} = useShoppingList();

// ── Benachrichtigungsberechtigung ──
const notifPermission = ref(
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
);

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

// ── Listen auf-/zuklappen ──
const collapsedLists = ref({});

function isCollapsed(listId) {
  return !!collapsedLists.value[listId];
}

function toggleCollapse(listId) {
  collapsedLists.value[listId] = !collapsedLists.value[listId];
}

const allCollapsed = computed(() => lists.value.length > 0 && lists.value.every((l) => collapsedLists.value[l._id]));

function toggleAllCollapse() {
  const collapse = !allCollapsed.value;
  lists.value.forEach((l) => { collapsedLists.value[l._id] = collapse; });
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
const joinMessageRole = computed(() => (joinMessage.value.type === 'error' ? 'alert' : 'status'));
const joinMessageLive = computed(() =>
  joinMessage.value.type === 'error' ? 'assertive' : 'polite',
);
const profileModal = ref({ show: false });
const profileModalRef = ref(null);
const profileCurrentPassword = ref('');
const profileNewPassword = ref('');
const profileConfirmPassword = ref('');
const profileShowPasswords = ref(false);
const profileLocalError = ref('');
const profileSuccessMessage = ref('');
const confirmModalRef = ref(null);
const shareModalRef = ref(null);
const modalFocusReturnTarget = ref(null);
const isProfileSubmitDisabled = computed(
  () =>
    authLoadingState.value ||
    !profileCurrentPassword.value ||
    !profileNewPassword.value ||
    !profileConfirmPassword.value,
);

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function saveModalFocusTarget() {
  if (typeof document === 'undefined') return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    modalFocusReturnTarget.value = activeElement;
  }
}

function restoreModalFocusTarget() {
  const target = modalFocusReturnTarget.value;
  modalFocusReturnTarget.value = null;
  if (target && target.isConnected) {
    nextTick(() => target.focus());
  }
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function focusFirstModalControl(container) {
  const [firstFocusable] = getFocusableElements(container);
  if (firstFocusable) {
    firstFocusable.focus();
    return;
  }
  if (container && typeof container.focus === 'function') {
    container.focus();
  }
}

function trapModalFocus(event, container) {
  if (event.key !== 'Tab' || !container || typeof document === 'undefined') return;
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;
  const isInsideModal = activeElement ? container.contains(activeElement) : false;

  if (event.shiftKey) {
    if (!isInsideModal || activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }
    return;
  }

  if (!isInsideModal || activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
}

function resetProfileForm() {
  profileCurrentPassword.value = '';
  profileNewPassword.value = '';
  profileConfirmPassword.value = '';
  profileShowPasswords.value = false;
  profileLocalError.value = '';
  profileSuccessMessage.value = '';
  clearAuthError();
}

function openProfileDialog() {
  saveModalFocusTarget();
  resetProfileForm();
  profileModal.value = { show: true };
}

function closeProfileDialog() {
  profileModal.value = { show: false };
  resetProfileForm();
  restoreModalFocusTarget();
}

async function submitPasswordChange() {
  profileLocalError.value = '';
  profileSuccessMessage.value = '';
  clearAuthError();

  if (profileNewPassword.value !== profileConfirmPassword.value) {
    profileLocalError.value = 'Neue Passwörter stimmen nicht überein.';
    return;
  }

  const result = await changePassword(profileCurrentPassword.value, profileNewPassword.value);
  if (result.success) {
    profileSuccessMessage.value = 'Passwort erfolgreich geändert.';
    profileCurrentPassword.value = '';
    profileNewPassword.value = '';
    profileConfirmPassword.value = '';
    profileShowPasswords.value = false;
  }
}

async function handleProfileLogout() {
  closeProfileDialog();
  await handleLogout();
}

async function openShareDialog(list) {
  saveModalFocusTarget();
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
  restoreModalFocusTarget();
}

async function copyShareCode() {
  if (shareModal.value.code) {
    await navigator.clipboard.writeText(shareModal.value.code);
  }
}

// ── Backup Import ──
const importError = ref('');
const importSuccess = ref('');

async function handleImportFile(event) {
  importError.value = '';
  importSuccess.value = '';
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    await importBackup(payload);
    importSuccess.value = `„${payload.list.name}" wurde wiederhergestellt.`;
  } catch {
    importError.value = 'Backup konnte nicht geladen werden. Ist die Datei gültig?';
  }
  event.target.value = '';
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
  saveModalFocusTarget();
  confirmModal.value = { show: true, title, message, step: 1, action };
}

function confirmStep1() {
  confirmModal.value.step = 2;
  confirmModal.value.message =
    'Bist du wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden!';
}

function confirmStep2() {
  const action = confirmModal.value.action;
  closeConfirm();
  if (action) action();
}

function closeConfirm() {
  confirmModal.value = { show: false };
  restoreModalFocusTarget();
}

function handleConfirmModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeConfirm();
    return;
  }
  trapModalFocus(event, confirmModalRef.value);
}

function handleShareModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeShareDialog();
    return;
  }
  trapModalFocus(event, shareModalRef.value);
}

function handleProfileModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeProfileDialog();
    return;
  }
  trapModalFocus(event, profileModalRef.value);
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

// ── Label-Filter (via useLabelFilter) ──
const {
  activeLabelFilter,
  setLabelFilter,
  getLabelCounts: getLabelCountsRaw,
  filterItemsByLabel,
} = useLabelFilter();

/**
 * Zählt Artikel pro Label für eine bestimmte Liste.
 * Wrapper um useLabelFilter.getLabelCounts() mit list-spezifischen Items.
 */
function getLabelCounts(listId) {
  return getLabelCountsRaw(getActiveItemsForList(listId));
}

/**
 * Gibt die anzuzeigenden Artikel zurück – berücksichtigt showOnlyChanged UND activeLabelFilter.
 */
function getFilteredItems(listId) {
  const result = getDisplayItems(listId);
  return filterItemsByLabel(result);
}

// ── Labels / Details (via useItemDetails) ──
const {
  expandedItemId,
  detailNote,
  detailLabel,
  isExpanded,
  closeDetail,
  toggleDetail,
  getDetailValues,
} = useItemDetails();

function toggleItemDetail(item) {
  // Inline-Editing schließen wenn Detail geöffnet wird
  if (!isExpanded(item._id)) {
    editingItemId.value = null;
  }
  toggleDetail(item);
}

function closeItemDetail() {
  closeDetail();
}

async function saveItemDetails(item) {
  const { note, label } = getDetailValues();
  await updateItemDetails(item, note, label);
  closeDetail();
}

function getToggleItemLabel(item) {
  return item.checked
    ? `Artikel ${item.name} als offen markieren`
    : `Artikel ${item.name} als erledigt markieren`;
}

function getDetailToggleLabel(item) {
  return expandedItemId.value === item._id
    ? `Details für ${item.name} schließen`
    : `Details für ${item.name} öffnen`;
}

function getLabelDisplay(labelName) {
  if (!labelName) return 'Kein Label';
  return getLabelObject(labelName)?.label ?? labelName;
}

watch(
  () => confirmModal.value.show,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => focusFirstModalControl(confirmModalRef.value));
    }
  },
);

watch(
  () => shareModal.value.show,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => focusFirstModalControl(shareModalRef.value));
    }
  },
);

watch(
  () => profileModal.value.show,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => focusFirstModalControl(profileModalRef.value));
    }
  },
);
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <h1><span class="h1-full">Einkaufslisten</span><span class="h1-short">Liste</span></h1>
        <div class="header-actions">
          <div class="session-badge" v-if="currentUser" title="Eingeloggt als">
            <span aria-hidden="true">👤</span>
            <span class="badge-name">{{ currentUser.name }}</span>
          </div>
          <ThemeToggle />
          <button
            type="button"
            class="settings-btn"
            @click="openProfileDialog"
            title="Profil & Einstellungen"
            aria-label="Profil und Einstellungen öffnen"
          >
            <span aria-hidden="true">⚙️</span><span class="btn-label"> Profil</span>
          </button>
          <button
            type="button"
            class="logout-btn"
            @click="handleLogout"
            title="Abmelden"
            aria-label="Abmelden"
          >
            <span aria-hidden="true">↩</span><span class="btn-label"> Abmelden</span>
          </button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="body-header">
        <div class="container body-header-row">
          <div class="body-header-buttons">
            <button
              v-if="notifPermission === 'default'"
              type="button"
              class="notif-enable-btn"
              @click="enableNotifications"
              title="Benachrichtigungen aktivieren"
              aria-label="Benachrichtigungen im Browser erlauben"
            >
              🔔 Aktivieren
            </button>
            <span
              v-else-if="notifPermission === 'denied'"
              class="notif-denied-hint"
              title="In den Browser-Einstellungen aktivieren"
            >
              🔕 Blockiert
            </span>
            <button
              v-else-if="notifPermission === 'granted'"
              type="button"
              class="notif-toggle-btn"
              :class="{ 'notif-on': notificationsEnabled, 'notif-off': !notificationsEnabled }"
              @click="notificationsEnabled = !notificationsEnabled"
              :title="notificationsEnabled ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'"
              :aria-pressed="notificationsEnabled"
            >
              {{ notificationsEnabled ? '🔔 Benachrichtigungen an' : '🔕 Benachrichtigungen aus' }}
            </button>
            <button
              type="button"
              class="pwa-install-btn"
              :class="{ 'pwa-installed': !installable }"
              :disabled="!installable"
              @click="installPwa"
              title="App installieren"
              aria-label="App installieren"
            >
              📲 {{ installable ? 'App installieren' : 'App installiert' }}
            </button>
          </div>
          <div
            class="status-indicator"
            :class="{ online: isOnline, offline: !isOnline }"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-text">{{ isOnline ? 'Online' : 'Offline' }}</span>
            <span v-if="syncActive && isOnline" class="sync-text">• Sync aktiv</span>
          </div>
        </div>
      </div>
      <div class="container">
        <!-- Loading -->
        <div v-if="loading" class="message">Daten werden geladen...</div>

        <!-- Error Banner -->
        <div
          v-if="error && !loading"
          class="error-banner"
          :class="{ warning: error.includes('Offline') }"
          role="alert"
        >
          <span class="error-banner-icon">{{ error.includes('Offline') ? '📶' : '⚠️' }}</span>
          <span class="error-banner-text">{{ error }}</span>
          <button
            class="error-banner-close"
            @click="error = null"
            title="Schließen"
            aria-label="Fehlermeldung schließen"
          >
            ✕
          </button>
        </div>

        <!-- Neue Liste hinzufügen -->
        <div class="add-list-form">
          <input
            v-model="newListName"
            class="add-input"
            placeholder="Neue Liste..."
            @keyup.enter="submitNewList"
            aria-label="Name für neue Liste"
          />
          <button type="button" class="add-btn" @click="submitNewList" aria-label="Liste erstellen">
            + Liste
          </button>
        </div>

        <!-- Liste beitreten -->
        <div class="join-form">
          <input
            v-model="joinCode"
            class="join-input"
            placeholder="Share-Code eingeben..."
            maxlength="6"
            @keyup.enter="submitJoinCode"
            aria-label="Share-Code eingeben"
          />
          <button
            type="button"
            class="join-btn"
            @click="submitJoinCode"
            aria-label="Liste beitreten"
          >
            🔗 Beitreten
          </button>
        </div>
        <div
          v-if="joinMessage.text"
          class="join-message"
          :class="joinMessage.type"
          :role="joinMessageRole"
          :aria-live="joinMessageLive"
          aria-atomic="true"
        >
          {{ joinMessage.text }}
        </div>

        <!-- Suchfeld -->
        <div class="search-bar">
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Artikel suchen…"
            aria-label="Artikel suchen"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear-btn"
            @click="clearSearch"
            title="Suche zurücksetzen"
            aria-label="Suche zurücksetzen"
          >
            ✕
          </button>
        </div>

        <!-- Benachrichtigungen -->
        <div
          v-if="notifications.length > 0"
          class="notifications"
          role="region"
          aria-label="Änderungsbenachrichtigungen"
          aria-live="polite"
        >
          <div
            v-for="notif in notifications"
            :key="notif.id"
            class="notification-banner"
            role="status"
          >
            <div class="notif-header">
              <span class="notif-list-name">🛒 {{ notif.listName }}</span>
              <button
                type="button"
                class="notification-dismiss"
                @click="dismissNotification(notif.id)"
                title="Schließen"
                :aria-label="`Benachrichtigung für Liste ${notif.listName} schließen`"
              >
                ✕
              </button>
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
            type="button"
            class="filter-changed-btn"
            :class="{ active: showOnlyChanged }"
            @click="showOnlyChanged = !showOnlyChanged"
            :aria-pressed="showOnlyChanged"
            :aria-label="`Nur geänderte Artikel anzeigen (${totalChangedCount})`"
          >
            {{ showOnlyChanged ? '✓ Nur geänderte' : 'Nur geänderte' }}
            <span
              class="filter-badge"
              :class="{ 'filter-badge-active': showOnlyChanged }"
              aria-hidden="true"
            >
              {{ totalChangedCount }}
            </span>
          </button>
          <button
            type="button"
            class="collapse-all-btn"
            @click="toggleAllCollapse"
            :aria-label="allCollapsed ? 'Alle Listen aufklappen' : 'Alle Listen einklappen'"
          >
            {{ allCollapsed ? '▶ Alle aufklappen' : '▼ Alle einklappen' }}
          </button>
        </div>

        <!-- Listen -->
        <div v-if="!loading && !error" class="lists">
          <div v-for="list in lists" :key="list._id" class="list">
            <div class="list-header" @click="toggleCollapse(list._id)">
              <div class="list-title">
                <div v-if="editingListId !== list._id" class="list-name-display">
                  <span class="collapse-arrow" :class="{ collapsed: isCollapsed(list._id) }"
                    >▼</span
                  >
                  <h2>{{ list.name }}</h2>
                  <button
                    type="button"
                    class="edit-list-btn"
                    @click.stop="startEditList(list)"
                    title="Liste umbenennen"
                    :aria-label="`Liste ${list.name} umbenennen`"
                  >
                    ✏️
                  </button>
                </div>
                <div v-else class="edit-list-form" @click.stop>
                  <input
                    v-model="editingListName"
                    class="edit-input"
                    @keyup.enter="saveEditList(list._id)"
                    @keyup.esc="cancelEditList"
                    ref="editListInput"
                    autofocus
                    :aria-label="`Neuer Name für Liste ${list.name}`"
                  />
                  <button
                    type="button"
                    class="edit-save-btn"
                    @click="saveEditList(list._id)"
                    title="Speichern"
                    :aria-label="`Neuen Namen für Liste ${list.name} speichern`"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    class="edit-cancel-btn"
                    @click="cancelEditList"
                    title="Abbrechen"
                    aria-label="Umbenennen abbrechen"
                  >
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
                  type="button"
                  @click="clearListChanges(list._id)"
                  class="clear-changes-btn"
                  title="Änderungshinweise entfernen"
                  :aria-label="`Änderungshinweise für Liste ${list.name} entfernen`"
                >
                  ✓ Gesehen
                </button>
                <span class="progress-text">{{ getProgress(list._id) }}%</span>
                <button
                  type="button"
                  class="share-list-btn"
                  title="Liste teilen"
                  @click="openShareDialog(list)"
                  :aria-label="`Liste ${list.name} teilen`"
                >
                  🔗
                </button>
                <button
                  type="button"
                  class="backup-list-btn"
                  title="Backup erstellen"
                  @click.stop="exportBackup(list._id)"
                  :aria-label="`Backup von Liste ${list.name} erstellen`"
                >
                  💾
                </button>
                <button
                  type="button"
                  class="delete-list-btn"
                  title="Liste löschen"
                  @click="confirmDeleteList(list)"
                  :aria-label="`Liste ${list.name} löschen`"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div
              class="progress-bar"
              role="progressbar"
              :aria-label="`Fortschritt für Liste ${list.name}`"
              :aria-valuenow="getProgress(list._id)"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="progress-fill" :style="{ width: getProgress(list._id) + '%' }"></div>
            </div>

            <div class="list-body" v-show="!isCollapsed(list._id)">
              <!-- Label-Filter-Leiste -->
              <LabelFilterBar
                v-if="!showOnlyChanged && getTab(list._id) === 'active'"
                :active-label="activeLabelFilter"
                :counts="getLabelCounts(list._id)"
                @update:activeLabel="setLabelFilter($event)"
              />

              <!-- Tabs (ausgeblendet wenn nur geänderte angezeigt werden) -->
              <div v-if="!showOnlyChanged" class="tabs">
                <button
                  type="button"
                  class="tab-btn"
                  :class="{ active: getTab(list._id) === 'active' }"
                  @click="setTab(list._id, 'active')"
                  :aria-pressed="getTab(list._id) === 'active'"
                  :aria-label="`Aktive Artikel in Liste ${list.name}`"
                >
                  Aktiv
                  <span class="tab-count" aria-hidden="true">{{
                    getActiveItemsForList(list._id).length
                  }}</span>
                </button>
                <button
                  type="button"
                  class="tab-btn"
                  :class="{ active: getTab(list._id) === 'deleted' }"
                  @click="setTab(list._id, 'deleted')"
                  :aria-pressed="getTab(list._id) === 'deleted'"
                  :aria-label="`Gelöschte Artikel in Liste ${list.name}`"
                >
                  Gelöscht
                  <span class="tab-count" aria-hidden="true">{{
                    getDeletedItemsForList(list._id).length
                  }}</span>
                </button>
              </div>

              <!-- Tab: Aktive Artikel / Geänderte Artikel -->
              <ul v-if="showOnlyChanged || getTab(list._id) === 'active'" class="items">
                <template v-for="item in getFilteredItems(list._id)" :key="item._id">
                  <li
                    :class="{
                      checked: item.checked,
                      'search-dimmed': searchQuery && !isSearchMatch(item),
                    }"
                    class="item"
                    :style="
                      item.label ? { borderLeft: `4px solid ${getLabelColor(item.label)}` } : {}
                    "
                  >
                    <input
                      type="checkbox"
                      :checked="item.checked"
                      @click.stop="toggleItem(item)"
                      class="checkbox"
                      :aria-label="getToggleItemLabel(item)"
                    />
                    <div class="item-content" @click="toggleItem(item)">
                      <div v-if="editingItemId !== item._id" class="item-name-display">
                        <span
                          v-if="item.label"
                          class="item-label-dot"
                          :style="{ background: getLabelColor(item.label) }"
                          :title="`Label: ${getLabelDisplay(item.label)}`"
                          aria-hidden="true"
                        ></span>
                        <span v-if="item.label" class="item-label-text">
                          {{ getLabelDisplay(item.label) }}
                        </span>
                        <span class="item-name">{{ item.name }}</span>
                        <span
                          v-if="item.note"
                          class="item-note-icon"
                          title="Hat eine Notiz"
                          aria-label="Hat eine Notiz"
                        >
                          📝
                        </span>
                        <button
                          type="button"
                          class="edit-item-btn"
                          @click.stop="startEditItem(item)"
                          title="Artikel umbenennen"
                          :aria-label="`Artikel ${item.name} umbenennen`"
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
                          :aria-label="`Neuer Name für Artikel ${item.name}`"
                        />
                        <button
                          type="button"
                          class="edit-save-btn"
                          @click.stop="saveEditItem(item)"
                          title="Speichern"
                          :aria-label="`Neuen Namen für Artikel ${item.name} speichern`"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          class="edit-cancel-btn"
                          @click.stop="cancelEditItem"
                          title="Abbrechen"
                          aria-label="Umbenennen abbrechen"
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
                      <span
                        v-if="item.note && expandedItemId !== item._id"
                        class="item-note-preview"
                      >
                        {{ item.note }}
                      </span>
                    </div>
                    <button
                      v-if="editingItemId !== item._id"
                      type="button"
                      class="item-detail-btn"
                      :class="{ active: expandedItemId === item._id }"
                      title="Details / Notiz"
                      @click.stop="toggleItemDetail(item)"
                      :aria-label="getDetailToggleLabel(item)"
                      :aria-expanded="expandedItemId === item._id"
                    >
                      ⋯
                    </button>
                    <button
                      v-if="editingItemId !== item._id"
                      type="button"
                      class="delete-item-btn"
                      title="Als gelöscht markieren"
                      @click.stop="markItemDeleted(item)"
                      :aria-label="`Artikel ${item.name} als gelöscht markieren`"
                    >
                      🗑️
                    </button>
                  </li>
                  <!-- Detail-Panel: Notiz + Label -->
                  <li v-if="expandedItemId === item._id" class="item-detail-panel">
                    <div class="detail-note-section">
                      <label class="detail-label-text">Notiz:</label>
                      <textarea
                        v-model="detailNote"
                        class="detail-textarea"
                        placeholder="Notiz hinzufügen…"
                        rows="2"
                        @click.stop
                        :aria-label="`Notiz für Artikel ${item.name}`"
                      ></textarea>
                    </div>
                    <div class="detail-color-section">
                      <label class="detail-label-text">Label:</label>
                      <div class="color-picker">
                        <button
                          type="button"
                          class="color-option color-none"
                          :class="{ active: detailLabel === null }"
                          @click.stop="detailLabel = null"
                          title="Kein Label"
                          :aria-pressed="detailLabel === null"
                          aria-label="Kein Label"
                        >
                          ✕
                        </button>
                        <button
                          v-for="c in LABEL_COLORS"
                          :key="c.name"
                          type="button"
                          class="color-option"
                          :class="{ active: detailLabel === c.name }"
                          :style="{ background: c.hex }"
                          @click.stop="detailLabel = c.name"
                          :title="`Label: ${c.label}`"
                          :aria-pressed="detailLabel === c.name"
                          :aria-label="`Label ${c.label} auswählen`"
                        ></button>
                      </div>
                      <p class="detail-label-selected">
                        Aktuell: <strong>{{ getLabelDisplay(detailLabel) }}</strong>
                      </p>
                    </div>
                    <div class="detail-actions">
                      <button
                        type="button"
                        class="detail-save-btn"
                        @click.stop="saveItemDetails(item)"
                        :aria-label="`Details für Artikel ${item.name} speichern`"
                      >
                        ✓ Speichern
                      </button>
                      <button
                        type="button"
                        class="detail-cancel-btn"
                        @click.stop="closeItemDetail"
                        aria-label="Details schließen ohne Speichern"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </li>
                  <!-- Inline Lösch-Banner (jemand anderes hat gelöscht) -->
                  <li v-if="item._pendingDelete" class="conflict-banner">
                    <div class="conflict-banner-text">
                      🗑️ <strong>{{ item._pendingDelete }}</strong> hat diesen Artikel gelöscht.
                    </div>
                    <div class="conflict-banner-btns">
                      <button
                        type="button"
                        class="cbtn-keep-remote"
                        @click="acceptDelete(item)"
                        :aria-label="`Löschung von Artikel ${item.name} akzeptieren`"
                      >
                        Ja
                      </button>
                      <button
                        type="button"
                        class="cbtn-keep-local"
                        @click="rejectDelete(item)"
                        :aria-label="`Löschung von Artikel ${item.name} ablehnen`"
                      >
                        Nein
                      </button>
                    </div>
                  </li>
                </template>
              </ul>

              <!-- Tab: Gelöschte Artikel (nur wenn kein Filter aktiv) -->
              <template v-if="!showOnlyChanged && getTab(list._id) === 'deleted'">
                <div
                  v-if="getDeletedItemsForList(list._id).length > 0"
                  class="permanent-delete-bar"
                >
                  <button
                    type="button"
                    class="permanent-delete-btn"
                    @click="confirmPermanentDelete(list._id)"
                    :aria-label="`Alle gelöschten Artikel aus Liste ${list.name} endgültig löschen`"
                  >
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
                        type="button"
                        class="restore-item-btn"
                        title="Wiederherstellen"
                        @click.stop="restoreItem(item)"
                        :aria-label="`Artikel ${item.name} wiederherstellen`"
                      >
                        ↩️
                      </button>
                    </li>
                  </template>
                </ul>
              </template>

              <div
                v-if="
                  (showOnlyChanged || getTab(list._id) === 'active') &&
                  getFilteredItems(list._id).length === 0
                "
                class="empty-list"
              >
                {{
                  showOnlyChanged
                    ? 'Keine geänderten Artikel in dieser Liste'
                    : activeLabelFilter
                      ? `Keine Artikel mit Label „${activeLabelFilter}"`
                      : 'Keine aktiven Artikel in dieser Liste'
                }}
              </div>

              <!-- Artikel hinzufügen (nur wenn kein Filter aktiv) -->
              <div v-if="!showOnlyChanged && getTab(list._id) === 'active'" class="add-item-form">
                <input
                  v-model="newItemNames[list._id]"
                  class="add-input"
                  placeholder="Neuer Artikel..."
                  @keyup.enter="submitNewItem(list._id)"
                  :aria-label="`Neuen Artikel zu Liste ${list.name} hinzufügen`"
                />
                <button
                  type="button"
                  class="add-btn"
                  @click="submitNewItem(list._id)"
                  :aria-label="`Artikel zu Liste ${list.name} hinzufügen`"
                >
                  +
                </button>
              </div>
              <div
                v-if="
                  !showOnlyChanged &&
                  getTab(list._id) === 'deleted' &&
                  getDeletedItemsForList(list._id).length === 0
                "
                class="empty-list"
              >
                Keine gelöschten Artikel
              </div>
            </div>
            <!-- /list-body -->
          </div>

          <div v-if="lists.length === 0" class="message">Keine Listen vorhanden</div>
        </div>
      </div>
    </main>

    <!-- Conflict Notifications entfernt: Konflikte werden inline beim Artikel angezeigt -->

    <!-- Profile Settings Modal -->
    <div v-if="profileModal.show" class="modal-overlay" @click.self="closeProfileDialog">
      <div
        ref="profileModalRef"
        class="modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        aria-describedby="profile-modal-description"
        tabindex="-1"
        @keydown="handleProfileModalKeydown"
      >
        <div id="profile-modal-title" class="modal-title">Profil & Einstellungen</div>
        <p id="profile-modal-description" class="modal-message">
          Eingeloggt als <strong>{{ currentUser?.name }}</strong>
        </p>

        <form class="profile-form" @submit.prevent="submitPasswordChange">
          <button
            type="button"
            class="profile-toggle-btn"
            @click="profileShowPasswords = !profileShowPasswords"
            :aria-label="profileShowPasswords ? 'Passwörter verbergen' : 'Passwörter anzeigen'"
            :aria-pressed="profileShowPasswords"
            aria-controls="profile-current-password profile-new-password profile-confirm-password"
          >
            {{ profileShowPasswords ? '🙈 Passwörter verbergen' : '👁️ Passwörter anzeigen' }}
          </button>

          <div class="profile-form-group">
            <label for="profile-current-password">Aktuelles Passwort</label>
            <input
              id="profile-current-password"
              v-model="profileCurrentPassword"
              :type="profileShowPasswords ? 'text' : 'password'"
              autocomplete="current-password"
              :disabled="authLoadingState"
              required
            />
          </div>

          <div class="profile-form-group">
            <label for="profile-new-password">Neues Passwort</label>
            <input
              id="profile-new-password"
              v-model="profileNewPassword"
              :type="profileShowPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              :disabled="authLoadingState"
              required
            />
          </div>

          <div class="profile-form-group">
            <label for="profile-confirm-password">Neues Passwort bestätigen</label>
            <input
              id="profile-confirm-password"
              v-model="profileConfirmPassword"
              :type="profileShowPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              :disabled="authLoadingState"
              required
            />
          </div>

          <p
            v-if="profileLocalError"
            id="profile-password-error"
            class="profile-error"
            role="alert"
            aria-live="assertive"
          >
            {{ profileLocalError }}
          </p>
          <p
            v-else-if="authError"
            id="profile-password-error"
            class="profile-error"
            role="alert"
            aria-live="assertive"
          >
            {{ authError }}
          </p>

          <p v-if="profileSuccessMessage" class="profile-success" role="status" aria-live="polite">
            {{ profileSuccessMessage }}
          </p>

          <div class="modal-btns profile-modal-actions">
            <button type="button" class="modal-btn-cancel" @click="closeProfileDialog">
              Schließen
            </button>
            <button type="submit" class="modal-btn-confirm" :disabled="isProfileSubmitDisabled">
              <span v-if="authLoadingState">Speichern…</span>
              <span v-else>Passwort ändern</span>
            </button>
          </div>
        </form>

        <div class="profile-actions-row">
          <label class="profile-backup-btn" title="Backup hochladen und Liste wiederherstellen">
            📂 Backup laden
            <input type="file" accept=".json" style="display:none" @change="handleImportFile" />
          </label>
          <button type="button" class="profile-logout-btn" @click="handleProfileLogout">
            Abmelden
          </button>
        </div>
        <p v-if="importSuccess" class="profile-success" role="status" aria-live="polite">{{ importSuccess }}</p>
        <p v-if="importError" class="profile-error" role="alert">{{ importError }}</p>
      </div>
    </div>

    <!-- Custom Confirm Modal -->
    <div v-if="confirmModal.show" class="modal-overlay" @click.self="closeConfirm">
      <div
        ref="confirmModalRef"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        tabindex="-1"
        @keydown="handleConfirmModalKeydown"
      >
        <div id="confirm-modal-title" class="modal-title">{{ confirmModal.title }}</div>
        <div id="confirm-modal-message" class="modal-message">{{ confirmModal.message }}</div>
        <div class="modal-btns">
          <button type="button" class="modal-btn-cancel" @click="closeConfirm">
            {{ confirmModal.action ? 'Abbrechen' : 'OK' }}
          </button>
          <button
            v-if="confirmModal.action && confirmModal.step === 1"
            type="button"
            class="modal-btn-confirm"
            @click="confirmStep1"
          >
            Weiter
          </button>
          <button
            v-else-if="confirmModal.action && confirmModal.step === 2"
            type="button"
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
      <div
        ref="shareModalRef"
        class="modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        aria-describedby="share-modal-message"
        tabindex="-1"
        @keydown="handleShareModalKeydown"
      >
        <div id="share-modal-title" class="modal-title">🔗 Liste teilen</div>
        <div v-if="shareModal.loading" id="share-modal-message" class="modal-message">
          Code wird generiert...
        </div>
        <div v-else id="share-modal-message" class="share-code-display">
          <div class="share-code-label">Dein Share-Code:</div>
          <div class="share-code">{{ shareModal.code }}</div>
          <button
            type="button"
            class="share-copy-btn"
            @click="copyShareCode"
            aria-label="Share-Code kopieren"
          >
            📋 Code kopieren
          </button>
          <p class="share-hint">Teile diesen Code, damit andere der Liste beitreten können.</p>
        </div>
        <div class="modal-btns">
          <button type="button" class="modal-btn-cancel" @click="closeShareDialog">
            Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ShoppingList.css"></style>
