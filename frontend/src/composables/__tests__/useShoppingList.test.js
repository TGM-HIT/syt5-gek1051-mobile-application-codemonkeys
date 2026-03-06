import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

// ─────────────────────────────────────────────
// Mocks für Abhängigkeiten
// ─────────────────────────────────────────────

// Vue lifecycle hooks mocken (kein App-Kontext in Tests)
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    onMounted: vi.fn((fn) => fn()),   // sofort aufrufen
    onUnmounted: vi.fn(),
  }
})

// database.js mocken
vi.mock('../database.js', () => ({
  startSync: vi.fn(() => ({ cancel: vi.fn() })),
  stopSync: vi.fn(),
  getAllDocs: vi.fn(async () => []),
  updateDoc: vi.fn(async (id, fn) => {
    const doc = { _id: id, _rev: '2-new' }
    fn(doc)
    return { ok: true, id, rev: '2-new' }
  }),
  createDoc: vi.fn(async () => ({ ok: true })),
  hardDeleteDoc: vi.fn(async () => ({ ok: true })),
  restoreLocalVersion: vi.fn(async () => true),
  clearRemoteChangedFlag: vi.fn(async () => { }),
  applyConflictResolution: vi.fn(async () => true),
  clearPendingDeleteFlag: vi.fn(async () => { }),
  findListByShareCode: vi.fn(async () => null),
  fetchItemsForListFromRemote: vi.fn(async () => []),
  initPouchDB: vi.fn(async () => ({
    localDB: {
      transaction: () => {
        const tx = {
          oncomplete: null,
          objectStore: () => ({
            put: () => {
              const req = { onsuccess: null, onerror: null }
              Promise.resolve().then(() => { tx.oncomplete?.() })
              return req
            }
          })
        }
        return tx
      }
    }
  })),
}))

// useSession mocken
vi.mock('../useSession.js', () => ({
  useSession: () => ({
    sessionName: ref('TestUser'),
  }),
}))

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
async function getMockDatabaseModule() {
  return await import('../database.js')
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('useShoppingList – getProgress', () => {
  it('gibt 0 zurück wenn keine Items vorhanden', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getProgress } = useShoppingList()
    expect(getProgress('list_x')).toBe(0)
  })

  it('berechnet den Fortschritt korrekt', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockResolvedValueOnce([
      { _id: 'i1', type: 'item', list_id: 'list_1', checked: true, deleted: false, markedDeleted: false },
      { _id: 'i2', type: 'item', list_id: 'list_1', checked: false, deleted: false, markedDeleted: false },
      { _id: 'i3', type: 'item', list_id: 'list_1', checked: true, deleted: false, markedDeleted: false },
    ])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { getProgress, items } = useShoppingList()

    // items manuell setzen (da onMounted bereits gefeuert hat)
    items.value = [
      { _id: 'i1', type: 'item', list_id: 'list_1', checked: true, deleted: false, markedDeleted: false },
      { _id: 'i2', type: 'item', list_id: 'list_1', checked: false, deleted: false, markedDeleted: false },
      { _id: 'i3', type: 'item', list_id: 'list_1', checked: true, deleted: false, markedDeleted: false },
    ]

    expect(getProgress('list_1')).toBe(67) // 2/3 = 66.6 → 67
  })

  it('gibt 100 zurück wenn alle Items gecheckt sind', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getProgress, items } = useShoppingList()

    items.value = [
      { _id: 'i1', type: 'item', list_id: 'list_a', checked: true, markedDeleted: false },
      { _id: 'i2', type: 'item', list_id: 'list_a', checked: true, markedDeleted: false },
    ]

    expect(getProgress('list_a')).toBe(100)
  })
})

describe('useShoppingList – getItemsForList / getActiveItemsForList / getDeletedItemsForList', () => {
  it('filtert Items nach listId', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getItemsForList, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', markedDeleted: false },
      { _id: 'i2', list_id: 'l2', markedDeleted: false },
      { _id: 'i3', list_id: 'l1', markedDeleted: true },
    ]

    expect(getItemsForList('l1')).toHaveLength(2)
    expect(getItemsForList('l2')).toHaveLength(1)
  })

  it('getActiveItemsForList filtert markedDeleted heraus', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getActiveItemsForList, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', markedDeleted: false },
      { _id: 'i2', list_id: 'l1', markedDeleted: true },
    ]

    expect(getActiveItemsForList('l1')).toHaveLength(1)
    expect(getActiveItemsForList('l1')[0]._id).toBe('i1')
  })

  it('getDeletedItemsForList gibt nur gelöschte zurück', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getDeletedItemsForList, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', markedDeleted: false },
      { _id: 'i2', list_id: 'l1', markedDeleted: true },
      { _id: 'i3', list_id: 'l1', markedDeleted: true },
    ]

    expect(getDeletedItemsForList('l1')).toHaveLength(2)
  })
})

describe('useShoppingList – hasChangedItems', () => {
  it('gibt true zurück wenn ein Item _remoteChanged hat', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { hasChangedItems, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', _remoteChanged: true },
      { _id: 'i2', list_id: 'l1' },
    ]

    expect(hasChangedItems('l1')).toBe(true)
  })

  it('gibt false zurück wenn kein Item _remoteChanged hat', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { hasChangedItems, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1' },
    ]

    expect(hasChangedItems('l1')).toBe(false)
  })
})

describe('useShoppingList – addItem', () => {
  it('ruft createDoc auf und lädt Daten neu', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem } = useShoppingList()

    await addItem('list_1', 'Milch')
    expect(db.createDoc).toHaveBeenCalledWith(expect.objectContaining({
      type: 'item',
      name: 'Milch',
      list_id: 'list_1',
      checked: false,
    }))
  })

  it('tut nichts wenn Name leer ist', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem } = useShoppingList()

    await addItem('list_1', '  ')
    expect(db.createDoc).not.toHaveBeenCalled()
  })

  it('tut nichts wenn Name null ist', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem } = useShoppingList()

    await addItem('list_1', null)
    expect(db.createDoc).not.toHaveBeenCalled()
  })
})

describe('useShoppingList – addList', () => {
  it('ruft createDoc auf', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockResolvedValue([])
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addList } = useShoppingList()

    await addList('Meine Liste')
    expect(db.createDoc).toHaveBeenCalledWith(expect.objectContaining({
      type: 'list',
      name: 'Meine Liste',
    }))
  })

  it('tut nichts wenn Name leer ist', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addList } = useShoppingList()

    await addList('')
    expect(db.createDoc).not.toHaveBeenCalled()
  })
})

describe('useShoppingList – deleteList', () => {
  it('ruft hardDeleteDoc auf', async () => {
    const db = await getMockDatabaseModule()
    db.hardDeleteDoc.mockClear()
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { deleteList } = useShoppingList()

    await deleteList({ _id: 'list_del_1' })
    expect(db.hardDeleteDoc).toHaveBeenCalledWith('list_del_1')
  })
})

describe('useShoppingList – toggleItem', () => {
  it('toggelt den checked-Status', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      const result = fn({ _id: id, checked: false })
      return { ok: true, id, rev: '2-new' }
    })

    const { useShoppingList } = await import('../useShoppingList.js')
    const { toggleItem } = useShoppingList()

    const item = { _id: 'item_1', checked: false }
    await toggleItem(item)

    expect(db.updateDoc).toHaveBeenCalledWith('item_1', expect.any(Function))
    expect(item.checked).toBe(true)
  })

  it('macht die Änderung rückgängig wenn updateDoc fehlschlägt', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockRejectedValueOnce(new Error('DB Fehler'))

    const { useShoppingList } = await import('../useShoppingList.js')
    const { toggleItem, error } = useShoppingList()

    const item = { _id: 'item_err', checked: true }
    await toggleItem(item)

    // Soll wieder true sein (Rollback: !true = false → Rollback: !false = true)
    expect(item.checked).toBe(true)
    expect(error.value).not.toBeNull()
  })
})

describe('useShoppingList – markItemDeleted / restoreItem', () => {
  it('markItemDeleted setzt markedDeleted auf true', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      fn({ _id: id })
      return { ok: true, id, rev: '2-new' }
    })

    const { useShoppingList } = await import('../useShoppingList.js')
    const { markItemDeleted } = useShoppingList()

    const item = { _id: 'item_del', markedDeleted: false }
    await markItemDeleted(item)

    expect(db.updateDoc).toHaveBeenCalledWith('item_del', expect.any(Function))
    expect(item.markedDeleted).toBe(true)
  })

  it('restoreItem setzt markedDeleted auf false', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      fn({ _id: id, markedDeleted: true })
      return { ok: true, id, rev: '2-new' }
    })

    const { useShoppingList } = await import('../useShoppingList.js')
    const { restoreItem } = useShoppingList()

    const item = { _id: 'item_restore', markedDeleted: true }
    await restoreItem(item)
    expect(item.markedDeleted).toBe(false)
  })
})

describe('useShoppingList – permanentlyDeleteAllMarked', () => {
  it('löscht alle markedDeleted Items einer Liste', async () => {
    const db = await getMockDatabaseModule()
    db.hardDeleteDoc.mockClear()
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { permanentlyDeleteAllMarked, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', markedDeleted: true },
      { _id: 'i2', list_id: 'l1', markedDeleted: false },
      { _id: 'i3', list_id: 'l1', markedDeleted: true },
    ]

    await permanentlyDeleteAllMarked('l1')
    expect(db.hardDeleteDoc).toHaveBeenCalledTimes(2)
    expect(db.hardDeleteDoc).toHaveBeenCalledWith('i1')
    expect(db.hardDeleteDoc).toHaveBeenCalledWith('i3')
  })
})

describe('useShoppingList – clearListChanges', () => {
  it('ruft clearRemoteChangedFlag für alle geänderten Items auf', async () => {
    const db = await getMockDatabaseModule()
    db.clearRemoteChangedFlag.mockClear()
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { clearListChanges, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1', _remoteChanged: true },
      { _id: 'i2', list_id: 'l1', _remoteChanged: false },
      { _id: 'i3', list_id: 'l1', _remoteChanged: true },
    ]

    await clearListChanges('l1')
    expect(db.clearRemoteChangedFlag).toHaveBeenCalledWith('i1')
    expect(db.clearRemoteChangedFlag).toHaveBeenCalledWith('i3')
    expect(db.clearRemoteChangedFlag).not.toHaveBeenCalledWith('i2')
  })
})

describe('useShoppingList – acceptDelete / rejectDelete', () => {
  it('acceptDelete setzt markedDeleted auf true und bereinigt _pendingDelete', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      fn({ _id: id, _pendingDelete: 'Alice', markedDeleted: false })
      return { ok: true, id, rev: '3-new' }
    })
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { acceptDelete } = useShoppingList()

    const item = { _id: 'item_pd', _pendingDelete: 'Alice', markedDeleted: false }
    await acceptDelete(item)
    expect(item._pendingDelete).toBeUndefined()
    expect(db.updateDoc).toHaveBeenCalledWith('item_pd', expect.any(Function))
  })

  it('rejectDelete setzt markedDeleted auf false', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      fn({ _id: id, _pendingDelete: 'Bob', markedDeleted: true })
      return { ok: true, id, rev: '3-new' }
    })
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { rejectDelete } = useShoppingList()

    const item = { _id: 'item_rej', _pendingDelete: 'Bob', markedDeleted: true }
    await rejectDelete(item)
    expect(item._pendingDelete).toBeUndefined()
  })
})

describe('useShoppingList – Stub-Methoden', () => {
  it('getConflictForItem gibt null zurück', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getConflictForItem } = useShoppingList()
    expect(getConflictForItem('anything')).toBeNull()
  })

  it('resolveConflict löst ohne Fehler auf', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { resolveConflict } = useShoppingList()
    await expect(resolveConflict()).resolves.toBeUndefined()
  })
})

describe('useShoppingList – loadData', () => {
  it('setzt loading auf false nach dem Laden', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockResolvedValueOnce([
      { _id: 'l1', type: 'list', deleted: false },
      { _id: 'i1', type: 'item', deleted: false },
    ])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { loading } = useShoppingList()

    // Warten bis onMounted-Effekte abgeschlossen sind
    await new Promise((r) => setTimeout(r, 50))
    expect(loading.value).toBe(false)
  })

  it('setzt error wenn getAllDocs fehlschlägt', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockRejectedValueOnce(new Error('DB down'))

    const { useShoppingList } = await import('../useShoppingList.js')
    const { error } = useShoppingList()

    await new Promise((r) => setTimeout(r, 50))
    expect(error.value).toBeTruthy()
  })
})

// ─────────────────────────────────────────────
// Sharing: generateShareCode
// ─────────────────────────────────────────────
describe('useShoppingList – generateShareCode', () => {
  it('generiert einen 6-stelligen Code und ruft updateDoc auf', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockImplementation(async (id, fn) => {
      const doc = fn({ _id: id, type: 'list', name: 'Test' })
      return { ok: true, id, rev: '2-new' }
    })
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { generateShareCode } = useShoppingList()

    const code = await generateShareCode('list_1')
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-Z2-9]+$/)
    expect(db.updateDoc).toHaveBeenCalledWith('list_1', expect.any(Function))
  })
})

// ─────────────────────────────────────────────
// Sharing: joinListByCode
// ─────────────────────────────────────────────
describe('useShoppingList – joinListByCode', () => {
  it('gibt Fehler zurück wenn Code leer ist', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { joinListByCode } = useShoppingList()

    const result = await joinListByCode('')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Code')
  })

  it('gibt Fehler zurück wenn Liste bereits lokal vorhanden', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { joinListByCode, lists } = useShoppingList()

    lists.value = [{ _id: 'list_1', shareCode: 'ABC123' }]

    const result = await joinListByCode('ABC123')
    expect(result.success).toBe(false)
    expect(result.message).toContain('bereits')
  })

  it('gibt Fehler zurück wenn kein Dokument gefunden', async () => {
    const db = await getMockDatabaseModule()
    db.findListByShareCode.mockResolvedValueOnce(null)

    const { useShoppingList } = await import('../useShoppingList.js')
    const { joinListByCode } = useShoppingList()

    const result = await joinListByCode('XXXXXX')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Keine Liste')
  })

  it('tritt einer Liste bei wenn Code gültig ist', async () => {
    const db = await getMockDatabaseModule()
    db.findListByShareCode.mockResolvedValueOnce({
      _id: 'list_shared', _rev: '1-a', type: 'list', name: 'Geteilte Liste', shareCode: 'XYZ789'
    })
    db.fetchItemsForListFromRemote.mockResolvedValueOnce([
      { _id: 'item_1', type: 'item', list_id: 'list_shared', name: 'Milch' }
    ])
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { joinListByCode } = useShoppingList()

    const result = await joinListByCode('XYZ789')
    expect(result.success).toBe(true)
    expect(result.message).toContain('Geteilte Liste')
  })
})

// ─────────────────────────────────────────────
// Additional edge case tests
// ─────────────────────────────────────────────
describe('useShoppingList – Edge Cases', () => {
  it('handles adding item with empty list ID', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem } = useShoppingList()

    await addItem('', 'Test Item')
    
    // Should still attempt to create (database will handle validation)
    expect(db.createDoc).toHaveBeenCalled()
  })

  it('handles multiple rapid toggles on same item', async () => {
    const db = await getMockDatabaseModule()
    let checkedState = false
    db.updateDoc.mockImplementation(async (id, fn) => {
      checkedState = !checkedState
      const result = fn({ _id: id, checked: !checkedState })
      return { ok: true, id, rev: '2-new' }
    })

    const { useShoppingList } = await import('../useShoppingList.js')
    const { toggleItem } = useShoppingList()

    const item = { _id: 'item_toggle', checked: false }
    
    await toggleItem(item)
    await toggleItem(item)
    await toggleItem(item)
    
    expect(db.updateDoc).toHaveBeenCalledTimes(3)
  })

  it('getProgress handles list with no items gracefully', async () => {
    const { useShoppingList } = await import('../useShoppingList.js')
    const { getProgress, items } = useShoppingList()

    items.value = []
    expect(getProgress('nonexistent_list')).toBe(0)
  })

  it('addList with very long name', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addList } = useShoppingList()

    const longName = 'A'.repeat(1000)
    await addList(longName)
    
    expect(db.createDoc).toHaveBeenCalledWith(expect.objectContaining({
      name: longName
    }))
  })

  it('handles special characters in item names', async () => {
    const db = await getMockDatabaseModule()
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem } = useShoppingList()

    await addItem('list_1', 'Äpfel & Birnen 🍎')
    
    expect(db.createDoc).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Äpfel & Birnen 🍎'
    }))
  })

  it('permanentlyDeleteAllMarked with empty list', async () => {
    const db = await getMockDatabaseModule()
    db.hardDeleteDoc.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { permanentlyDeleteAllMarked, items } = useShoppingList()

    items.value = []
    await permanentlyDeleteAllMarked('empty_list')
    
    expect(db.hardDeleteDoc).not.toHaveBeenCalled()
  })

  it('clearListChanges with no changed items', async () => {
    const db = await getMockDatabaseModule()
    db.clearRemoteChangedFlag.mockClear()

    const { useShoppingList } = await import('../useShoppingList.js')
    const { clearListChanges, items } = useShoppingList()

    items.value = [
      { _id: 'i1', list_id: 'l1' },
      { _id: 'i2', list_id: 'l1' }
    ]

    await clearListChanges('l1')
    expect(db.clearRemoteChangedFlag).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// Error handling tests
// ─────────────────────────────────────────────
describe('useShoppingList – Error Handling', () => {
  it('handles database errors gracefully when adding items', async () => {
    const db = await getMockDatabaseModule()
    db.createDoc.mockRejectedValueOnce(new Error('Database error'))
    db.getAllDocs.mockResolvedValue([])

    const { useShoppingList } = await import('../useShoppingList.js')
    const { addItem, error } = useShoppingList()

    await addItem('list_1', 'Test')
    
    expect(error.value).toBeTruthy()
  })

  it('handles database errors when deleting lists', async () => {
    const db = await getMockDatabaseModule()
    db.hardDeleteDoc.mockRejectedValueOnce(new Error('Delete failed'))

    const { useShoppingList } = await import('../useShoppingList.js')
    const { deleteList, error } = useShoppingList()

    await deleteList({ _id: 'list_1' })
    
    expect(error.value).toBeTruthy()
  })

  it('sets error when generateShareCode fails', async () => {
    const db = await getMockDatabaseModule()
    db.updateDoc.mockRejectedValueOnce(new Error('Update failed'))

    const { useShoppingList } = await import('../useShoppingList.js')
    const { generateShareCode, error } = useShoppingList()

    const code = await generateShareCode('list_1')
    
    expect(code).toBeNull()
    expect(error.value).toBeTruthy()
  })
})
