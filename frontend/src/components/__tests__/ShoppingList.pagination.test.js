import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ShoppingList from '../ShoppingList.vue'

// Mock für useShoppingList
const lists = ref([])
const items = ref([])
const loading = ref(false)
const error = ref(null)
const isOnline = ref(true)
const syncActive = ref(false)

const mockUseShoppingList = {
  lists,
  items,
  loading,
  error,
  isOnline,
  syncActive,
  conflicts: ref({}),
  toggleItem: vi.fn(),
  addItem: vi.fn(),
  addList: vi.fn(),
  deleteList: vi.fn(),
  renameList: vi.fn(),
  renameItem: vi.fn(),
  getItemsForList: vi.fn(),
  getActiveItemsForList: vi.fn(),
  getDeletedItemsForList: vi.fn(),
  markItemDeleted: vi.fn(),
  restoreItem: vi.fn(),
  permanentlyDeleteAllMarked: vi.fn(),
  getProgress: vi.fn(() => 0),
  getConflictForItem: vi.fn(() => null),
  resolveConflict: vi.fn(),
  acceptDelete: vi.fn(),
  rejectDelete: vi.fn(),
  hasChangedItems: vi.fn(() => false),
  clearListChanges: vi.fn(),
  generateShareCode: vi.fn(),
  joinListByCode: vi.fn(),
}

const sessionName = ref('TestUser')

const mockUseSession = {
  sessionName,
  clearSession: vi.fn(),
}

vi.mock('../../composables/useShoppingList', () => ({
  useShoppingList: () => mockUseShoppingList,
}))

vi.mock('../../composables/useSession', () => ({
  useSession: () => mockUseSession,
}))

describe('ShoppingList - Pagination', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    sessionName.value = 'TestUser'

    lists.value = [
      {
        _id: 'list_1',
        name: 'Große Einkaufsliste',
        owner: 'TestUser',
        createdAt: '2026-03-20T10:00:00.000Z'
      }
    ]

    // Wir erstellen eine Liste mit exakt 45 Artikeln (mehr als ITEMS_PER_PAGE=40)
    const testItems = []
    for (let i = 1; i <= 45; i++) {
      testItems.push({
        _id: `item_${i}`,
        list_id: 'list_1',
        name: `Artikel ${i}`,
        checked: false,
        markedDeleted: false,
        lastModifiedBy: 'TestUser',
        createdAt: new Date().toISOString()
      })
    }
    items.value = testItems

    mockUseShoppingList.getActiveItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId && !i.markedDeleted)
    })
    mockUseShoppingList.getDeletedItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId && i.markedDeleted)
    })
    mockUseShoppingList.getItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId)
    })

    wrapper = mount(ShoppingList, {
      global: {
        stubs: {
          SessionSetup: true,
          ThemeToggle: true
        }
      }
    })
  })

  it('rendert initial genau 40 Artikel und zeigt den Button an', async () => {
    await wrapper.vm.$nextTick()
    
    // Prüfe ob exakt 40 Items gerendert wurden (Klasse .item bei aktiven Artikeln)
    const renderedItems = wrapper.findAll('.item')
    expect(renderedItems.length).toBe(40)

    // Prüfe ob der "Weitere Artikel anzeigen" Button im DOM existiert
    const loadMoreBtn = wrapper.find('.load-more-btn')
    expect(loadMoreBtn.exists()).toBe(true)
  })

  it('lädt beim Klick auf den Button weitere Artikel nach und verschwindet korrekt', async () => {
    await wrapper.vm.$nextTick()
    
    const loadMoreBtn = wrapper.find('.load-more-btn')
    // Klick simulieren
    await loadMoreBtn.trigger('click')
    
    // Warten bis Vue reaktiv die Liste neu gerendert hat
    await wrapper.vm.$nextTick()
    
    // Nun sollten alle 45 Items sichtbar sein
    const renderedItems = wrapper.findAll('.item')
    expect(renderedItems.length).toBe(45)

    // Da keine weiteren Items übrig sind, darf der Button nicht mehr existieren
    const hiddenLoadMoreBtn = wrapper.find('.load-more-btn')
    expect(hiddenLoadMoreBtn.exists()).toBe(false)
  })
})
