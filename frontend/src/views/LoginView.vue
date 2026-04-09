<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { login, authError, authLoading, clearError } = useAuth();

const username = ref('');
const password = ref('');
const showPassword = ref(false);

async function handleLogin() {
  clearError();
  const result = await login(username.value, password.value);
  if (result.success) {
    router.push('/');
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-icon">🛒</div>
      <h1 class="auth-title">Einkaufsliste</h1>
      <p class="auth-subtitle">Melde dich an, um deine Listen zu sehen.</p>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="username">Benutzername</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="dein-name"
            autocomplete="username"
            autofocus
            :disabled="authLoading"
            :aria-invalid="Boolean(authError)"
            :aria-describedby="authError ? 'login-auth-error' : undefined"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Passwort</label>
          <div class="password-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              :disabled="authLoading"
              :aria-invalid="Boolean(authError)"
              :aria-describedby="authError ? 'login-auth-error' : undefined"
              required
            />
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
              :disabled="authLoading"
              :aria-label="showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'"
              :aria-pressed="showPassword"
              aria-controls="password"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <p
          v-if="authError"
          id="login-auth-error"
          class="auth-error"
          role="alert"
          aria-live="assertive"
        >
          {{ authError }}
        </p>

        <button type="submit" class="auth-btn" :disabled="authLoading || !username || !password">
          <span v-if="authLoading">Bitte warten…</span>
          <span v-else>Anmelden</span>
        </button>
      </form>

      <p class="auth-switch">
        Noch kein Konto?
        <router-link to="/register">Jetzt registrieren</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  padding: 1rem;
}

.auth-card {
  background: white;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  text-align: center;
}

.auth-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 0.25rem;
}

.auth-subtitle {
  color: #6b7280;
  font-size: 0.95rem;
  margin: 0 0 2rem;
}

.auth-form {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #ff0000;
}

.form-group input:focus-visible {
  outline: 3px solid rgba(255, 0, 0, 0.28);
  outline-offset: 1px;
  box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.12);
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
  border-radius: 6px;
  transition: background 0.15s;
}

.toggle-password:focus-visible {
  outline: 3px solid #ff0000;
  outline-offset: 2px;
  background: rgba(255, 0, 0, 0.08);
}

.auth-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  padding: 0.625rem 0.875rem;
  margin: 0;
}

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
    transform 0.1s,
    box-shadow 0.2s;
  margin-top: 0.25rem;
}

.auth-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.auth-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.auth-btn:focus-visible {
  outline: 3px solid #b91c1c;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.2);
}

.auth-switch {
  margin: 1.5rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.auth-switch a {
  color: #cc0000;
  font-weight: 600;
  text-decoration: none;
}

.auth-switch a:hover {
  text-decoration: underline;
}

.auth-switch a:focus-visible {
  outline: 3px solid #ff0000;
  outline-offset: 2px;
  border-radius: 4px;
  text-decoration: underline;
}
</style>
