import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ShoppingList from '../ShoppingList.vue'

// Mock für useShoppingList - verwende ref() für Reaktivität
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
  getItemsForList: vi.fn(() => []),
  getActiveItemsForList: vi.fn(() => []),
  getDeletedItemsForList: vi.fn(() => []),
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

describe('ShoppingList - Export Funktion', () => {
  let wrapper

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setze sessionName damit SessionSetup nicht angezeigt wird
    sessionName.value = 'TestUser'

    lists.value = [
      {
        _id: 'list_1',
        name: 'Einkaufsliste',
        owner: 'TestUser',
        createdAt: '2026-03-01T10:00:00.000Z',
        shareCode: 'ABC123'
      }
    ]

    items.value = [
      {
        _id: 'item_1',
        list_id: 'list_1',
        name: 'Milch',
        checked: true,
        markedDeleted: false,
        lastModifiedBy: 'TestUser',
        createdAt: '2026-03-01T10:05:00.000Z'
      },
      {
        _id: 'item_2',
        list_id: 'list_1',
        name: 'Brot',
        checked: false,
        markedDeleted: false,
        lastModifiedBy: 'TestUser',
        createdAt: '2026-03-01T10:06:00.000Z'
      }
    ]

    mockUseShoppingList.getItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId)
    })

    mockUseShoppingList.getActiveItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId && !i.markedDeleted)
    })

    mockUseShoppingList.getDeletedItemsForList.mockImplementation((listId) => {
      return items.value.filter(i => i.list_id === listId && i.markedDeleted)
    })

    mockUseShoppingList.getProgress.mockReturnValue(50)

    wrapper = mount(ShoppingList, {
      global: {
        stubs: {
          SessionSetup: true
        }
      }
    })
  })

  it('erstellt einen Export-Button für jede Liste', async () => {
    await wrapper.vm.$nextTick()

    // Debug: Prüfe ob Listen gerendert werden
    const lists = wrapper.findAll('.list')
    expect(lists.length).toBeGreaterThan(0)

    const exportButton = wrapper.find('.export-list-btn')
    expect(exportButton.exists()).toBe(true)
  })

  it('exportiert Liste als JSON mit korrekter Struktur', async () => {
    await wrapper.vm.$nextTick()

    // Stelle sicher, dass die Liste gerendert wird
    const lists = wrapper.findAll('.list')
    expect(lists.length).toBeGreaterThan(0)

    // Mock für Blob und URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock für createElement und appendChild
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }
    const originalCreateElement = document.createElement.bind(document)
    document.createElement = vi.fn((tag) => {
      if (tag === 'a') return mockLink
      return originalCreateElement(tag)
    })

    const originalAppendChild = document.body.appendChild
    const originalRemoveChild = document.body.removeChild
    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()

    const exportButton = wrapper.find('.export-list-btn')

    if (!exportButton.exists()) {
      // Debug-Ausgabe
      console.log('HTML:', wrapper.html())
      console.log('Lists:', mockUseShoppingList.lists.value)
    }

    expect(exportButton.exists()).toBe(true)

    await exportButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('Einkaufsliste')
    expect(mockLink.download).toContain('.json')

    // Cleanup
    document.createElement = originalCreateElement
    document.body.appendChild = originalAppendChild
    document.body.removeChild = originalRemoveChild
  })
})

describe('ShoppingList - Import Funktion', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()

    // Setze sessionName damit SessionSetup nicht angezeigt wird
    sessionName.value = 'TestUser'

    lists.value = []
    items.value = []
    mockUseShoppingList.getItemsForList.mockReturnValue([])
    mockUseShoppingList.addList.mockResolvedValue()
    mockUseShoppingList.addItem.mockResolvedValue()

    wrapper = mount(ShoppingList, {
      global: {
        stubs: {
          SessionSetup: true
        }
      }
    })
  })

  it('zeigt Import-Button an', () => {
    const importButton = wrapper.find('.import-btn')
    expect(importButton.exists()).toBe(true)
    expect(importButton.text()).toContain('Import')
  })

  it('öffnet Import-Modal beim Klick auf Import-Button', async () => {
    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')

    await wrapper.vm.$nextTick()

    const modal = wrapper.find('.import-modal')
    expect(modal.exists()).toBe(true)
  })

  it('zeigt Datei-Auswahl-Button im Modal', async () => {
    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')
    await wrapper.vm.$nextTick()

    const fileButton = wrapper.find('.import-file-btn')
    expect(fileButton.exists()).toBe(true)
  })

  it('schließt Modal beim Klick auf Schließen', async () => {
    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')
    await wrapper.vm.$nextTick()

    const closeButton = wrapper.findAll('.modal-btn-cancel').find(btn =>
      btn.element.textContent.includes('Schließen')
    )
    await closeButton.trigger('click')
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('.import-modal')
    expect(modal.exists()).toBe(false)
  })

  it('verarbeitet valide JSON-Datei', async () => {
    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')
    await wrapper.vm.$nextTick()

    const validJson = {
      list: {
        name: 'Importierte Liste',
        owner: 'OtherUser',
        createdAt: '2026-03-01T10:00:00.000Z'
      },
      items: [
        {
          name: 'Test Item 1',
          checked: false,
          markedDeleted: false
        },
        {
          name: 'Test Item 2',
          checked: true,
          markedDeleted: false
        }
      ]
    }

    const blob = new Blob([JSON.stringify(validJson)], { type: 'application/json' })
    const file = new File([blob], 'test.json', { type: 'application/json' })

    const fileInput = wrapper.find('input[type="file"]')

    // Mock File API
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      writable: false
    })

    await fileInput.trigger('change')

    // Warte auf async Operationen
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(mockUseShoppingList.addList).toHaveBeenCalledWith('Importierte Liste')
  })

  it('zeigt Fehler bei ungültigem JSON', async () => {
    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')
    await wrapper.vm.$nextTick()

    const invalidJson = '{ invalid json }'
    const blob = new Blob([invalidJson], { type: 'application/json' })
    const file = new File([blob], 'invalid.json', { type: 'application/json' })

    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      writable: false
    })

    await fileInput.trigger('change')
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    const errorMessage = wrapper.find('.import-error')
    expect(errorMessage.exists()).toBe(true)
  })

  it('zeigt Fehler wenn Liste bereits existiert', async () => {
    // Setze existierende Liste
    lists.value = [
      { _id: 'existing', name: 'Bestehende Liste' }
    ]

    // Remount Component damit die neuen Listen sichtbar sind
    wrapper.unmount()
    wrapper = mount(ShoppingList, {
      global: {
        stubs: {
          SessionSetup: true
        }
      }
    })

    const importButton = wrapper.find('.import-btn')
    await importButton.trigger('click')
    await wrapper.vm.$nextTick()

    const validJson = {
      list: {
        name: 'Bestehende Liste',
        owner: 'User'
      },
      items: []
    }

    const blob = new Blob([JSON.stringify(validJson)], { type: 'application/json' })
    const file = new File([blob], 'test.json', { type: 'application/json' })

    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      writable: false
    })

    await fileInput.trigger('change')
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    const errorMessage = wrapper.find('.import-error')
    expect(errorMessage.exists()).toBe(true)
    expect(errorMessage.text()).toContain('existiert bereits')
  })
})









