import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

// localStorage mock (jsdom provides one but we want full control)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// matchMedia mock (jsdom doesn't implement it)
const createMatchMedia = (prefersDark = false) =>
  vi.fn().mockImplementation((query) => ({
    matches: prefersDark && query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

// Helper: frisch importiertes useTheme (module cache reset)
async function freshUseTheme() {
  vi.resetModules();
  const mod = await import('../useTheme.js');
  return mod.useTheme;
}

beforeEach(() => {
  localStorageMock.clear();
  document.documentElement.removeAttribute('data-theme');
  globalThis.matchMedia = createMatchMedia(false);
});

afterEach(() => {
  vi.resetModules();
});

// ── Tests ──

describe('useTheme – Initialisierung', () => {
  it('verwendet light als Standard wenn kein localStorage-Wert vorhanden', async () => {
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('light');
  });

  it('liest gespeicherten Wert "dark" aus localStorage', async () => {
    localStorageMock.setItem('app-theme', 'dark');
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('dark');
  });

  it('liest gespeicherten Wert "light" aus localStorage', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('light');
  });

  it('ignoriert ungültige localStorage-Werte und fällt auf light zurück', async () => {
    localStorageMock.setItem('app-theme', 'rainbow');
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('light');
  });
});

describe('useTheme – System-Präferenz Fallback', () => {
  it('verwendet dark wenn prefers-color-scheme: dark und kein localStorage-Wert', async () => {
    globalThis.matchMedia = createMatchMedia(true);
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('dark');
  });

  it('localStorage hat Vorrang vor System-Präferenz', async () => {
    globalThis.matchMedia = createMatchMedia(true); // System bevorzugt dark
    localStorageMock.setItem('app-theme', 'light'); // User hat light gespeichert
    const useTheme = await freshUseTheme();
    const { theme } = useTheme();
    expect(theme.value).toBe('light');
  });
});

describe('useTheme – toggleTheme', () => {
  it('wechselt von light zu dark', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { theme, toggleTheme } = useTheme();
    toggleTheme();
    expect(theme.value).toBe('dark');
  });

  it('wechselt von dark zu light', async () => {
    localStorageMock.setItem('app-theme', 'dark');
    const useTheme = await freshUseTheme();
    const { theme, toggleTheme } = useTheme();
    toggleTheme();
    expect(theme.value).toBe('light');
  });

  it('speichert den neuen Wert in localStorage nach Toggle', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { toggleTheme } = useTheme();
    toggleTheme();
    await nextTick();
    expect(localStorageMock.getItem('app-theme')).toBe('dark');
  });

  it('zweimaliges Togglen kehrt zum Ausgangswert zurück', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { theme, toggleTheme } = useTheme();
    toggleTheme();
    await nextTick();
    toggleTheme();
    await nextTick();
    expect(theme.value).toBe('light');
  });

  it('setzt data-theme auf document.documentElement', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { toggleTheme } = useTheme();
    toggleTheme();
    await nextTick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('useTheme – setTheme', () => {
  it('setzt Theme auf dark', async () => {
    const useTheme = await freshUseTheme();
    const { theme, setTheme } = useTheme();
    setTheme('dark');
    expect(theme.value).toBe('dark');
  });

  it('setzt Theme auf light', async () => {
    localStorageMock.setItem('app-theme', 'dark');
    const useTheme = await freshUseTheme();
    const { theme, setTheme } = useTheme();
    setTheme('light');
    expect(theme.value).toBe('light');
  });

  it('ignoriert ungültige Werte und ändert Theme nicht', async () => {
    localStorageMock.setItem('app-theme', 'light');
    const useTheme = await freshUseTheme();
    const { theme, setTheme } = useTheme();
    setTheme('blau');
    expect(theme.value).toBe('light');
  });

  it('speichert den neuen Wert in localStorage', async () => {
    const useTheme = await freshUseTheme();
    const { setTheme } = useTheme();
    setTheme('dark');
    await nextTick();
    expect(localStorageMock.getItem('app-theme')).toBe('dark');
  });
});
