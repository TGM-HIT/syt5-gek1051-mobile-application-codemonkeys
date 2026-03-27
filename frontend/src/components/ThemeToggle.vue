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
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  font-size: 1.3rem;
  padding: 0;
  position: relative;
  overflow: hidden;
}

.theme-toggle:hover {
  background: var(--bg-item-hover);
  border-color: var(--border-color-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
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
