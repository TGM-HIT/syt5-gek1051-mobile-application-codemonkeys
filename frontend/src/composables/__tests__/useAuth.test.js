import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../useAuth';

// localStorage mock
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

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// fetch mock
global.fetch = vi.fn();

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // currentUser zurücksetzen
  const { currentUser } = useAuth();
  currentUser.value = null;
});

describe('useAuth – register', () => {
  it('gibt Fehler zurück bei leerem Benutzernamen', async () => {
    const { register } = useAuth();
    const result = await register('', 'passwort123');
    expect(result.success).toBe(false);
  });

  it('gibt Fehler zurück bei zu kurzem Passwort', async () => {
    const { register } = useAuth();
    const result = await register('user', '123');
    expect(result.success).toBe(false);
  });

  it('gibt Fehler zurück bei bereits vergebenem Benutzernamen', async () => {
    global.fetch.mockResolvedValueOnce({ status: 409, ok: false, json: async () => ({}) });
    const { register, authError } = useAuth();
    const result = await register('existinguser', 'passwort123');
    expect(result.success).toBe(false);
    expect(authError.value).toContain('vergeben');
  });

  it('loggt nach erfolgreicher Registrierung automatisch ein', async () => {
    // PUT /_users → 201
    global.fetch.mockResolvedValueOnce({ status: 201, ok: true, json: async () => ({}) });
    // POST /_session → ok
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, name: 'newuser', roles: [] }),
    });

    const { register, currentUser } = useAuth();
    const result = await register('newuser', 'passwort123');
    expect(result.success).toBe(true);
    expect(currentUser.value?.name).toBe('newuser');
  });

  it('gibt Fehler zurück bei Netzwerkproblem', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const { register, authError } = useAuth();
    const result = await register('user', 'passwort123');
    expect(result.success).toBe(false);
    expect(authError.value).toContain('Verbindung');
  });
});

describe('useAuth – login', () => {
  it('gibt Fehler zurück bei fehlenden Feldern', async () => {
    const { login } = useAuth();
    const result = await login('', '');
    expect(result.success).toBe(false);
  });

  it('setzt currentUser bei erfolgreichem Login', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, name: 'testuser', roles: [] }),
    });

    const { login, currentUser } = useAuth();
    const result = await login('testuser', 'passwort123');
    expect(result.success).toBe(true);
    expect(currentUser.value?.name).toBe('testuser');
    expect(localStorage.getItem('auth_user')).not.toBeNull();
  });

  it('gibt Fehler zurück bei falschen Credentials', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'unauthorized' }),
    });

    const { login, authError } = useAuth();
    const result = await login('wronguser', 'wrongpass');
    expect(result.success).toBe(false);
    expect(authError.value).toContain('falsch');
  });

  it('speichert User in localStorage', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, name: 'testuser', roles: ['admin'] }),
    });

    const { login } = useAuth();
    await login('testuser', 'passwort123');
    const stored = JSON.parse(localStorage.getItem('auth_user'));
    expect(stored.name).toBe('testuser');
    expect(stored.roles).toContain('admin');
  });
});

describe('useAuth – logout', () => {
  it('löscht currentUser und localStorage', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { logout, currentUser } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };
    localStorage.setItem('auth_user', JSON.stringify({ name: 'testuser' }));

    await logout();
    expect(currentUser.value).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('loggt trotzdem aus wenn Server nicht erreichbar (offline)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { logout, currentUser } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };

    await logout();
    expect(currentUser.value).toBeNull();
  });
});

describe('useAuth – changePassword', () => {
  it('ändert das Passwort bei gültigen Eingaben', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _id: 'org.couchdb.user:testuser',
          _rev: '1-abc',
          name: 'testuser',
          roles: [],
          type: 'user',
          derived_key: 'old-hash',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const { changePassword, currentUser, authError } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };

    const result = await changePassword('altespasswort', 'neuespasswort');

    expect(result.success).toBe(true);
    expect(authError.value).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    const updateCall = global.fetch.mock.calls[2];
    expect(updateCall[0]).toContain('/_users/org.couchdb.user%3Atestuser');
    const expectedAdminAuth = `Basic ${btoa('admin:password')}`;
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(expectedAdminAuth);
    expect(updateCall[1].headers.Authorization).toBe(expectedAdminAuth);

    const payload = JSON.parse(updateCall[1].body);
    expect(payload.password).toBe('neuespasswort');
    expect(payload._rev).toBe('1-abc');
    expect(payload.derived_key).toBeUndefined();
  });

  it('fällt bei 403 auf User-Auth für _users zurück', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ reason: 'forbidden' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          _id: 'org.couchdb.user:testuser',
          _rev: '1-fallback',
          name: 'testuser',
          roles: [],
          type: 'user',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const { changePassword, currentUser, authError } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };

    const result = await changePassword('altespasswort', 'neuespasswort');

    expect(result.success).toBe(true);
    expect(authError.value).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(4);

    const expectedUserAuth = `Basic ${btoa('testuser:altespasswort')}`;
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe(expectedUserAuth);
    expect(global.fetch.mock.calls[3][1].headers.Authorization).toBe(expectedUserAuth);
  });

  it('gibt Fehler zurück wenn Nutzer nicht eingeloggt ist', async () => {
    const { changePassword, authError } = useAuth();
    const result = await changePassword('altespasswort', 'neuespasswort');

    expect(result.success).toBe(false);
    expect(authError.value).toContain('eingeloggt');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gibt Fehler zurück bei falschem aktuellem Passwort', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const { changePassword, currentUser, authError } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };

    const result = await changePassword('falsch', 'neuespasswort');

    expect(result.success).toBe(false);
    expect(authError.value).toContain('Aktuelles Passwort');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('gibt Fehler zurück bei zu kurzem neuem Passwort', async () => {
    const { changePassword, currentUser, authError } = useAuth();
    currentUser.value = { name: 'testuser', roles: [] };

    const result = await changePassword('altespasswort', '123');

    expect(result.success).toBe(false);
    expect(authError.value).toContain('mindestens 6 Zeichen');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('useAuth – checkSession', () => {
  it('gibt true zurück und setzt User wenn Session gültig', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userCtx: { name: 'testuser', roles: [] } }),
    });

    const { checkSession, currentUser } = useAuth();
    const result = await checkSession();
    expect(result).toBe(true);
    expect(currentUser.value?.name).toBe('testuser');
  });

  it('gibt false zurück wenn Session abgelaufen', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userCtx: { name: null, roles: [] } }),
    });

    const { checkSession, currentUser } = useAuth();
    currentUser.value = null;
    const result = await checkSession();
    expect(result).toBe(false);
    expect(currentUser.value).toBeNull();
  });

  it('verwendet lokale Session als Fallback wenn offline', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { checkSession, currentUser } = useAuth();
    currentUser.value = { name: 'offlineuser', roles: [] };
    const result = await checkSession();
    expect(result).toBe(true);
  });
});

describe('useAuth – clearError', () => {
  it('setzt authError zurück', async () => {
    const { login, authError, clearError } = useAuth();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'unauthorized' }),
    });
    await login('wronguser', 'wrongpass');
    expect(authError.value).not.toBe(null);
    clearError();
    expect(authError.value).toBeNull();
  });
});
