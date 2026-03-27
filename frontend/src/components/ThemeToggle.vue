<script setup>
import { useTheme } from '@/composables/useTheme';
import { onMounted } from 'vue';

const { isDark, toggleTheme, initTheme } = useTheme();

onMounted(() => {
  initTheme();
});
</script>

<template>
  <button class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Helles Design' : 'Dunkles Design'">
    <span class="icon">{{ isDark ? '☀️' : '🌙' }}</span>
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
  font-size: 1.25rem;
  padding: 0;
  overflow: hidden;
}

.theme-toggle:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--accent-color);
  background: var(--item-hover-bg);
}

.theme-toggle:active {
  transform: translateY(0);
}

.icon {
  display: inline-block;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-toggle:hover .icon {
  transform: rotate(15deg) scale(1.1);
}
</style>
