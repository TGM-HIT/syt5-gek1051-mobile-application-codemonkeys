<script setup>
import { useTheme } from '../composables/useTheme';

const { theme, toggleTheme } = useTheme();
</script>

<template>
  <button 
    class="theme-toggle" 
    @click="toggleTheme" 
    :title="theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'"
    :aria-label="theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'"
  >
    <span v-if="theme === 'light'" class="icon">🌙</span>
    <span v-else class="icon">☀️</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  background: var(--bg-card);
  border: 1.5px solid var(--border-color);
  color: var(--text-primary);
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px var(--shadow-color);
  font-size: 1.2rem;
  padding: 0;
}

.theme-toggle:hover {
  background: var(--bg-item-hover);
  border-color: var(--border-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--shadow-color);
}

.theme-toggle:active {
  transform: translateY(0);
}

.icon {
  line-height: 1;
  display: inline-block;
  transition: transform 0.3s ease;
}

.theme-toggle:hover .icon {
  transform: rotate(12deg) scale(1.1);
}
</style>
