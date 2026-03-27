<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { register, authError, authLoading, clearError } = useAuth();

const username = ref('');
const password = ref('');
const passwordConfirm = ref('');
const showPassword = ref(false);
const localError = ref('');

async function handleRegister() {
  clearError();
  localError.value = '';

  if (password.value !== passwordConfirm.value) {
    localError.value = 'Passwörter stimmen nicht überein.';
    return;
  }

  const result = await register(username.value, password.value);
  if (result.success) {
    router.push('/');
  }
}

const errorMessage = () => localError.value || authError.value;
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-icon">🛒</div>
      <h1 class="auth-title">Konto erstellen</h1>
      <p class="auth-subtitle">Erstelle dein Konto und sichere deine Listen.</p>

      <form @submit.prevent="handleRegister" class="auth-form">
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
            maxlength="50"
          />
          <span class="form-hint">Nur Kleinbuchstaben, Zahlen und Bindestriche</span>
        </div>

        <div class="form-group">
          <label for="password">Passwort</label>
          <div class="password-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Mindestens 6 Zeichen"
              autocomplete="new-password"
              :disabled="authLoading"
            />
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
              tabindex="-1"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="password-confirm">Passwort bestätigen</label>
          <input
            id="password-confirm"
            v-model="passwordConfirm"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Passwort wiederholen"
            autocomplete="new-password"
            :disabled="authLoading"
          />
        </div>

        <p v-if="errorMessage()" class="auth-error">{{ errorMessage() }}</p>

        <button
          type="submit"
          class="auth-btn"
          :disabled="authLoading || !username || !password || !passwordConfirm"
        >
          <span v-if="authLoading">Konto wird erstellt…</span>
          <span v-else>Registrieren</span>
        </button>
      </form>

      <p class="auth-switch">
        Bereits ein Konto?
        <router-link to="/login">Jetzt anmelden</router-link>
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
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
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
  color: #15803d;
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
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #16a34a;
}

.form-group input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}

.form-hint {
  font-size: 0.78rem;
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
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.1s;
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

.auth-switch {
  margin: 1.5rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.auth-switch a {
  color: #16a34a;
  font-weight: 600;
  text-decoration: none;
}

.auth-switch a:hover {
  text-decoration: underline;
}
</style>
