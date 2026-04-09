<script setup>
import { useTheme } from '@/composables/useTheme';

const { theme, toggleTheme } = useTheme();
</script>

<template>
  <button
    type="button"
    role="switch"
    class="theme-toggle-btn"
    :title="theme === 'dark' ? 'Zum Light Mode wechseln' : 'Zum Dark Mode wechseln'"
    :aria-label="
      theme === 'dark'
        ? 'Dark Mode ist aktiv, zu Light Mode wechseln'
        : 'Light Mode ist aktiv, zu Dark Mode wechseln'
    "
    :aria-checked="theme === 'dark'"
    @click="toggleTheme"
  >
    <span class="theme-icon" aria-hidden="true">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  background: var(--color-surface, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.1s;
  color: inherit;
}

.theme-toggle-btn:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.15));
  transform: scale(1.08);
}

.theme-toggle-btn:active {
  transform: scale(0.96);
}

.theme-icon {
  display: block;
  transition: transform 0.3s;
}

.theme-toggle-btn:hover .theme-icon {
  transform: rotate(20deg);
}
</style>
