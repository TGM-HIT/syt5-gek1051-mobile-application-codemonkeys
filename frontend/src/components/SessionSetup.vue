<script setup>
import { ref } from 'vue'
import { useSession } from '@/composables/useSession'

const { setSessionName } = useSession()
const nameInput = ref('')

function submit() {
  const trimmed = nameInput.value.trim()
  if (trimmed) {
    setSessionName(trimmed)
  }
}
</script>

<template>
  <div class="session-overlay">
    <div class="session-modal">
      <div class="session-icon">🛒</div>
      <h2>Willkommen!</h2>
      <p>Gib deinen Namen ein, damit andere sehen können, wer Änderungen vorgenommen hat.</p>
      <input
        v-model="nameInput"
        @keyup.enter="submit"
        placeholder="Dein Name..."
        class="session-input"
        autofocus
        maxlength="30"
      />
      <button @click="submit" :disabled="!nameInput.trim()" class="session-btn">
        Los geht's →
      </button>
    </div>
  </div>
</template>

<style scoped>
.session-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.session-modal {
  background: white;
  border-radius: 16px;
  padding: 2.5rem 2rem;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.session-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.session-modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
}

.session-modal p {
  color: #666;
  font-size: 0.95rem;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.session-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  margin-bottom: 1rem;
}

.session-input:focus {
  border-color: #e53e3e;
}

.session-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #ff0000 0%, #ffde00 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.session-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.session-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
