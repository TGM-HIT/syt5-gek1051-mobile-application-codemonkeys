import { ref, watchEffect } from 'vue';

const STORAGE_KEY = 'app-theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

const theme = ref(getInitialTheme());

// Apply theme immediately (before any component renders) to avoid flash
document.documentElement.setAttribute('data-theme', theme.value);

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', theme.value);
  localStorage.setItem(STORAGE_KEY, theme.value);
});

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function setTheme(value) {
    if (value === 'dark' || value === 'light') {
      theme.value = value;
    }
  }

  return {
    theme,
    toggleTheme,
    setTheme,
  };
}
