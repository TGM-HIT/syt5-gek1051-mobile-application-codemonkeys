import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage mock
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useSession', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()

    // Modul-Cache leeren damit SESSION_KEY neu initialisiert wird
    vi.resetModules()
  })

  it('initialisiert sessionName aus localStorage', async () => {
    localStorageMock.getItem.mockReturnValueOnce('TestUser')
    const { useSession } = await import('../useSession.js')
    const { sessionName } = useSession()
    expect(sessionName.value).toBe('TestUser')
  })

  it('initialisiert sessionName als leerer String wenn localStorage leer ist', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { sessionName } = useSession()
    expect(sessionName.value).toBe('')
  })

  it('setSessionName setzt den Namen und speichert ihn in localStorage', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { sessionName, setSessionName } = useSession()

    setSessionName('  Alice  ')
    expect(sessionName.value).toBe('Alice')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('einkaufsliste_session_name', 'Alice')
  })

  it('setSessionName trimmt Whitespace', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    setSessionName('   Bob   ')
    expect(sessionName.value).toBe('Bob')
  })

  it('clearSession setzt sessionName auf leer und entfernt localStorage-Eintrag', async () => {
    localStorageMock.getItem.mockReturnValueOnce('Alice')
    const { useSession } = await import('../useSession.js')
    const { sessionName, clearSession } = useSession()

    clearSession()
    expect(sessionName.value).toBe('')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('einkaufsliste_session_name')
  })

  it('sessionName ist reaktiv zwischen mehreren useSession()-Aufrufen', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const instance1 = useSession()
    const instance2 = useSession()

    instance1.setSessionName('SharedUser')
    expect(instance2.sessionName.value).toBe('SharedUser')
  })

  it('setSessionName mit leerem String nach trim', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    setSessionName('   ')
    expect(sessionName.value).toBe('')
  })

  it('handles undefined as input gracefully', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    setSessionName(undefined)
    expect(sessionName.value).toBe('')
  })

  it('handles null as input gracefully', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    setSessionName(null)
    expect(sessionName.value).toBe('')
  })

  it('handles very long names by storing them', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    const longName = 'A'.repeat(100)
    setSessionName(longName)
    expect(sessionName.value).toBe(longName)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('einkaufsliste_session_name', longName)
  })

  it('clearSession is idempotent', async () => {
    localStorageMock.getItem.mockReturnValueOnce('Alice')
    const { useSession } = await import('../useSession.js')
    const { clearSession, sessionName } = useSession()

    clearSession()
    clearSession()
    clearSession()
    
    expect(sessionName.value).toBe('')
    expect(localStorageMock.removeItem).toHaveBeenCalled()
  })

  it('setSessionName with special characters', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    const { useSession } = await import('../useSession.js')
    const { setSessionName, sessionName } = useSession()

    setSessionName('Alice & Bob 🛒')
    expect(sessionName.value).toBe('Alice & Bob 🛒')
  })
})

