<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { currentUser, changePassword, logout, authError, authLoading, clearError } = useAuth();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrentPw = ref(false);
const showNewPw = ref(false);
const showConfirmPw = ref(false);
const successMessage = ref('');

async function handleChangePassword() {
  clearError();
  successMessage.value = '';
  const result = await changePassword(
    currentPassword.value,
    newPassword.value,
    confirmPassword.value,
  );
  if (result.success) {
    successMessage.value = 'Passwort wurde erfolgreich geändert.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  }
}

async function handleLogout() {
  await logout();
  router.push('/login');
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-card">
      <!-- Header -->
      <div class="profile-header">
        <div class="profile-avatar">👤</div>
        <h1 class="profile-title">Mein Profil</h1>
        <p class="profile-username">{{ currentUser?.name }}</p>
      </div>

      <!-- Passwort ändern -->
      <section class="profile-section" aria-labelledby="pw-section-title">
        <h2 id="pw-section-title" class="section-title">Passwort ändern</h2>

        <form @submit.prevent="handleChangePassword" class="auth-form" id="change-password-form" novalidate>
          <!-- Aktuelles Passwort -->
          <div class="form-group">
            <label for="current-password">Aktuelles Passwort</label>
            <div class="password-wrapper">
              <input
                id="current-password"
                v-model="currentPassword"
                :type="showCurrentPw ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                :disabled="authLoading"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showCurrentPw = !showCurrentPw"
                tabindex="-1"
                :aria-label="showCurrentPw ? 'Passwort verstecken' : 'Passwort anzeigen'"
              >
                {{ showCurrentPw ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Neues Passwort -->
          <div class="form-group">
            <label for="new-password">Neues Passwort</label>
            <div class="password-wrapper">
              <input
                id="new-password"
                v-model="newPassword"
                :type="showNewPw ? 'text' : 'password'"
                placeholder="Mindestens 6 Zeichen"
                autocomplete="new-password"
                :disabled="authLoading"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showNewPw = !showNewPw"
                tabindex="-1"
                :aria-label="showNewPw ? 'Passwort verstecken' : 'Passwort anzeigen'"
              >
                {{ showNewPw ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Passwort bestätigen -->
          <div class="form-group">
            <label for="confirm-password">Neues Passwort bestätigen</label>
            <div class="password-wrapper">
              <input
                id="confirm-password"
                v-model="confirmPassword"
                :type="showConfirmPw ? 'text' : 'password'"
                placeholder="Passwort wiederholen"
                autocomplete="new-password"
                :disabled="authLoading"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showConfirmPw = !showConfirmPw"
                tabindex="-1"
                :aria-label="showConfirmPw ? 'Passwort verstecken' : 'Passwort anzeigen'"
              >
                {{ showConfirmPw ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Fehlermeldung -->
          <p v-if="authError" class="auth-error" role="alert">{{ authError }}</p>

          <!-- Erfolgsmeldung -->
          <p v-if="successMessage" class="auth-success" role="status">{{ successMessage }}</p>

          <button
            id="submit-change-password"
            type="submit"
            class="auth-btn"
            :disabled="authLoading || !currentPassword || !newPassword || !confirmPassword"
          >
            <span v-if="authLoading">Bitte warten…</span>
            <span v-else>Passwort ändern</span>
          </button>
        </form>
      </section>

      <!-- Trennlinie -->
      <hr class="divider" />

      <!-- Abmelden -->
      <section class="profile-section">
        <h2 class="section-title">Konto</h2>
        <p class="logout-hint">Du wirst auf die Anmeldeseite weitergeleitet.</p>
        <button id="logout-btn" class="logout-btn" @click="handleLogout" :disabled="authLoading">
          🚪 Abmelden
        </button>
      </section>

      <!-- Zurück-Link -->
      <p class="back-link">
        <router-link to="/">← Zurück zu den Listen</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  padding: 1.5rem 1rem;
}

.profile-card {
  background: white;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
}

/* Header */
.profile-header {
  text-align: center;
  margin-bottom: 2rem;
}

.profile-avatar {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.profile-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 0.25rem;
}

.profile-username {
  color: #6b7280;
  font-size: 0.95rem;
  margin: 0;
  font-weight: 500;
}

/* Sections */
.profile-section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #374151;
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.8rem;
}

.divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5rem 0;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.form-group input {
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
  /* Browser-eigene Validierungsränder deaktivieren */
  box-shadow: none;
}

.form-group input:focus {
  border-color: #ff0000;
}

/* Browser :invalid Stile neutralisieren – wir machen eigene Validierung */
.form-group input:invalid {
  border-color: #e5e7eb;
  box-shadow: none;
}

.form-group input:focus:invalid {
  border-color: #ff0000;
}

.form-group input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 3rem;
}

.toggle-password {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}

/* Messages */
.auth-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  padding: 0.625rem 0.875rem;
  margin: 0;
}

.auth-success {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  color: #16a34a;
  font-size: 0.875rem;
  padding: 0.625rem 0.875rem;
  margin: 0;
}

/* Buttons */
.auth-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #ff0000 0%, #ffde00 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.1s;
}

.auth-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.auth-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Logout */
.logout-hint {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 0.75rem;
}

.logout-btn {
  width: 100%;
  padding: 0.875rem;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  color: #374151;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.1s;
}

.logout-btn:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
  transform: translateY(-1px);
}

.logout-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Back link */
.back-link {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
}

.back-link a {
  color: #cc0000;
  font-weight: 600;
  text-decoration: none;
}

.back-link a:hover {
  text-decoration: underline;
}
</style>
