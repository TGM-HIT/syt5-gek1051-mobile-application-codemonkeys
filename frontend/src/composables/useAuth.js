import { ref } from 'vue';

const COUCHDB_URL = import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/einkaufsliste';
const COUCHDB_BASE = COUCHDB_URL.replace(/\/[^/]+$/, '');
const COUCHDB_USER = import.meta.env.VITE_COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = import.meta.env.VITE_COUCHDB_PASSWORD || 'password';
const ADMIN_AUTH_HEADER = `Basic ${btoa(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`)}`;

const SESSION_KEY = 'auth_user';

// Shared reactive state
const currentUser = ref(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'));
const authError = ref(null);
const authLoading = ref(false);

export function useAuth() {
  /**
   * Registriert einen neuen Nutzer über CouchDB _users Datenbank.
   * Das Passwort wird von CouchDB gehasht (PBKDF2) – nie im Klartext gespeichert.
   */
  async function register(username, password) {
    if (!username || !username.trim()) {
      authError.value = 'Benutzername darf nicht leer sein.';
      return { success: false };
    }
    if (!password || password.length < 6) {
      authError.value = 'Passwort muss mindestens 6 Zeichen lang sein.';
      return { success: false };
    }

    authLoading.value = true;
    authError.value = null;

    try {
      const trimmedUsername = username.trim().toLowerCase();
      const response = await fetch(`${COUCHDB_BASE}/_users/org.couchdb.user:${trimmedUsername}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ADMIN_AUTH_HEADER,
        },
        body: JSON.stringify({
          _id: `org.couchdb.user:${trimmedUsername}`,
          name: trimmedUsername,
          password: password,
          roles: [],
          type: 'user',
        }),
      });

      if (response.status === 201) {
        // Direkt nach Registrierung einloggen
        return await login(username, password);
      } else if (response.status === 409) {
        authError.value = 'Benutzername bereits vergeben.';
        return { success: false };
      } else {
        const body = await response.json();
        authError.value = body.reason || 'Registrierung fehlgeschlagen.';
        return { success: false };
      }
    } catch {
      authError.value = 'Verbindung zum Server fehlgeschlagen.';
      return { success: false };
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Meldet einen Nutzer via CouchDB /_session an.
   * CouchDB setzt ein Session-Cookie das nach Page-Refresh erhalten bleibt.
   */
  async function login(username, password) {
    if (!username || !password) {
      authError.value = 'Benutzername und Passwort sind erforderlich.';
      return { success: false };
    }

    authLoading.value = true;
    authError.value = null;

    try {
      const trimmedUsername = username.trim().toLowerCase();
      const response = await fetch(`${COUCHDB_BASE}/_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmedUsername, password }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        const user = { name: data.name, roles: data.roles || [] };
        currentUser.value = user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return { success: true, user };
      } else {
        authError.value = 'Benutzername oder Passwort falsch.';
        return { success: false };
      }
    } catch {
      authError.value = 'Verbindung zum Server fehlgeschlagen.';
      return { success: false };
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Meldet den Nutzer ab und löscht die lokale Session.
   */
  async function logout() {
    try {
      await fetch(`${COUCHDB_BASE}/_session`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Offline logout – trotzdem lokal ausloggen
    }
    currentUser.value = null;
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Ändert das Passwort des aktuell eingeloggten Nutzers.
   * Prüft zuerst das aktuelle Passwort und aktualisiert dann das _users Dokument.
   */
  async function changePassword(currentPassword, newPassword) {
    if (!currentUser.value?.name) {
      authError.value = 'Du musst eingeloggt sein, um dein Passwort zu ändern.';
      return { success: false };
    }
    if (!currentPassword || !newPassword) {
      authError.value = 'Aktuelles und neues Passwort sind erforderlich.';
      return { success: false };
    }
    if (newPassword.length < 6) {
      authError.value = 'Passwort muss mindestens 6 Zeichen lang sein.';
      return { success: false };
    }
    if (currentPassword === newPassword) {
      authError.value = 'Das neue Passwort muss sich vom alten unterscheiden.';
      return { success: false };
    }

    authLoading.value = true;
    authError.value = null;

    const username = currentUser.value.name.trim().toLowerCase();
    const userDocId = `org.couchdb.user:${username}`;
    const userDocUrl = `${COUCHDB_BASE}/_users/${encodeURIComponent(userDocId)}`;

    try {
      const verifyResponse = await fetch(`${COUCHDB_BASE}/_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: username, password: currentPassword }),
      });

      if (!verifyResponse.ok) {
        authError.value = 'Aktuelles Passwort ist falsch.';
        return { success: false };
      }

      const getUserResponse = await fetch(userDocUrl, {
        headers: { Authorization: ADMIN_AUTH_HEADER },
      });

      if (!getUserResponse.ok) {
        const body = await getUserResponse.json();
        authError.value = body.reason || 'Benutzerprofil konnte nicht geladen werden.';
        return { success: false };
      }

      const userDoc = await getUserResponse.json();
      const safeUserDoc = { ...userDoc };
      delete safeUserDoc.derived_key;
      delete safeUserDoc.iterations;
      delete safeUserDoc.password_scheme;
      delete safeUserDoc.salt;
      delete safeUserDoc.password_sha;

      const updateResponse = await fetch(userDocUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ADMIN_AUTH_HEADER,
        },
        body: JSON.stringify({
          ...safeUserDoc,
          _id: userDoc._id,
          _rev: userDoc._rev,
          name: username,
          roles: Array.isArray(userDoc.roles) ? userDoc.roles : [],
          type: userDoc.type || 'user',
          password: newPassword,
        }),
      });

      if (!updateResponse.ok) {
        const body = await updateResponse.json();
        authError.value = body.reason || 'Passwort konnte nicht geändert werden.';
        return { success: false };
      }

      return { success: true };
    } catch {
      authError.value = 'Verbindung zum Server fehlgeschlagen.';
      return { success: false };
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Prüft ob die aktuelle Session noch gültig ist (z.B. nach Page-Refresh).
   * Gibt true zurück wenn der Nutzer noch eingeloggt ist.
   */
  async function checkSession() {
    try {
      const response = await fetch(`${COUCHDB_BASE}/_session`, {
        credentials: 'include',
      });
      if (!response.ok) return false;

      const data = await response.json();
      if (data.userCtx && data.userCtx.name) {
        const user = { name: data.userCtx.name, roles: data.userCtx.roles || [] };
        currentUser.value = user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return true;
      }
      // Session abgelaufen
      currentUser.value = null;
      localStorage.removeItem(SESSION_KEY);
      return false;
    } catch {
      // Offline: lokale Session weiterverwenden falls vorhanden
      return currentUser.value !== null;
    }
  }

  function clearError() {
    authError.value = null;
  }

  return {
    currentUser,
    authError,
    authLoading,
    register,
    login,
    changePassword,
    logout,
    checkSession,
    clearError,
  };
}
