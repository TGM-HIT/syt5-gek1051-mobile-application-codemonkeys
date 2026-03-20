<script setup>
import { ref } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { useSession } from '@/composables/useSession';
import SessionSetup from './SessionSetup.vue';

// Alle Logik ist jetzt im Composable ausgelagert
const {
  lists,
  loading,
  error,
  isOnline,
  syncActive,
  toggleItem,
  addItem,
  addList,
  deleteList,
  renameList,
  renameItem,
  getItemsForList,
  getActiveItemsForList,
  getDeletedItemsForList,
  markItemDeleted,
  restoreItem,
  permanentlyDeleteAllMarked,
  getProgress,
  acceptDelete,
  rejectDelete,
  hasChangedItems,
  clearListChanges,
  generateShareCode,
  joinListByCode,
} = useShoppingList();

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

// ── Export ──
function exportListAsJson(list) {
  const listItems = getItemsForList(list._id)

  const exportData = {
    list: {
      id: list._id,
      name: list.name,
      owner: list.owner,
      createdAt: list.createdAt,
      shareCode: list.shareCode || null
    },
    items: listItems.map(item => ({
      id: item._id,
      name: item.name,
      checked: item.checked,
      markedDeleted: item.markedDeleted,
      lastModifiedBy: item.lastModifiedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    })),
    statistics: {
      totalItems: listItems.length,
      activeItems: getActiveItemsForList(list._id).length,
      deletedItems: getDeletedItemsForList(list._id).length,
      checkedItems: listItems.filter(i => i.checked && !i.markedDeleted).length,
      progress: getProgress(list._id)
    },
    exportedAt: new Date().toISOString(),
    exportedBy: sessionName.value
  }

  const jsonString = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${list.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Import ──
const importModal = ref({ show: false, error: null, success: null })
const fileInput = ref(null)

function openImportDialog() {
  importModal.value = { show: true, error: null, success: null }
}

function closeImportDialog() {
  importModal.value = { show: false, error: null, success: null }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleFileImport(event) {
  const file = event.target.files?.[0]
  if (!file) return

  importModal.value.error = null
  importModal.value.success = null

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // Validiere Struktur
    if (!data.list || !data.items) {
      throw new Error('Ungültiges Format: list oder items fehlen')
    }

    // Prüfe ob Liste bereits existiert
    const existingList = lists.value.find(l => l.name === data.list.name)
    if (existingList) {
      importModal.value.error = `Liste "${data.list.name}" existiert bereits. Bitte umbenennen oder löschen Sie die vorhandene Liste zuerst.`
      return
    }

    // Importiere Liste
    await addList(data.list.name)

    // Finde die neu erstellte Liste
    await new Promise(resolve => setTimeout(resolve, 100)) // Warte auf loadData
    const newList = lists.value.find(l => l.name === data.list.name)

    if (!newList) {
      throw new Error('Liste konnte nicht erstellt werden')
    }

    // Importiere Items
    for (const item of data.items) {
      await addItem(newList._id, item.name)
    }

    // Wenn Items checked oder deleted waren, aktualisiere sie
    await new Promise(resolve => setTimeout(resolve, 100))
    const importedItems = getItemsForList(newList._id)

    for (let i = 0; i < data.items.length && i < importedItems.length; i++) {
      const sourceItem = data.items[i]
      const targetItem = importedItems[i]

      if (sourceItem.checked || sourceItem.markedDeleted) {
        // Verwende toggleItem oder markItemDeleted je nach Zustand
        if (sourceItem.checked && !sourceItem.markedDeleted) {
          await toggleItem(targetItem)
        }
        if (sourceItem.markedDeleted) {
          await markItemDeleted(targetItem)
        }
      }
    }

    importModal.value.success = `Liste "${data.list.name}" mit ${data.items.length} Artikel(n) erfolgreich importiert!`

    // Modal nach 2 Sekunden schließen
    setTimeout(() => {
      if (importModal.value.success) {
        closeImportDialog()
      }
    }, 2000)

  } catch (err) {
    console.error('Import-Fehler:', err)
    importModal.value.error = `Import fehlgeschlagen: ${err.message}`
  }
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
          {{ error }}
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
          <button class="import-btn" @click="openImportDialog" title="Liste aus JSON importieren">📤 Import</button>
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
                <button 
                  class="export-list-btn" 
                  title="Als JSON exportieren" 
                  @click="exportListAsJson(list)"
                >
                  📥
                </button>
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

            <!-- Tabs -->
            <div class="tabs">
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

            <!-- Tab: Aktive Artikel -->
            <ul v-if="getTab(list._id) === 'active'" class="items">
              <template v-for="item in getActiveItemsForList(list._id)" :key="item._id">
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

            <!-- Tab: Gelöschte Artikel -->
            <template v-if="getTab(list._id) === 'deleted'">
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
              v-if="getTab(list._id) === 'active' && getActiveItemsForList(list._id).length === 0"
              class="empty-list"
            >
              Keine aktiven Artikel in dieser Liste
            </div>

            <!-- Artikel hinzufügen -->
            <div v-if="getTab(list._id) === 'active'" class="add-item-form">
              <input
                v-model="newItemNames[list._id]"
                class="add-input"
                placeholder="Neuer Artikel..."
                @keyup.enter="submitNewItem(list._id)"
              />
              <button class="add-btn" @click="submitNewItem(list._id)">+</button>
            </div>
            <div
              v-if="getTab(list._id) === 'deleted' && getDeletedItemsForList(list._id).length === 0"
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

    <!-- Import Modal -->
    <div v-if="importModal.show" class="modal-overlay" @click.self="closeImportDialog">
      <div class="modal import-modal">
        <div class="modal-title">📤 Liste importieren</div>
        <div class="modal-message">
          Wähle eine JSON-Datei aus, die zuvor exportiert wurde.
        </div>

        <div v-if="importModal.error" class="import-error">
          ⚠️ {{ importModal.error }}
        </div>

        <div v-if="importModal.success" class="import-success">
          ✓ {{ importModal.success }}
        </div>

        <input
          type="file"
          ref="fileInput"
          accept="application/json,.json"
          @change="handleFileImport"
          style="display: none"
        />

        <button class="import-file-btn" @click="triggerFileSelect">
          📁 Datei auswählen
        </button>

        <div class="modal-btns">
          <button class="modal-btn-cancel" @click="closeImportDialog">Schließen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ShoppingList.css"></style>
