import { ref, watch, onMounted } from 'vue';

const THEME_KEY = 'shopping-list-theme';

export function useTheme() {
  const theme = ref(localStorage.getItem(THEME_KEY) || 'light');

  const updateDOM = (newTheme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  };

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, theme.value);
  };

  // Watch for changes and update DOM
  watch(theme, (newTheme) => {
    updateDOM(newTheme);
  });

  onMounted(() => {
    // Check system preference if no saved theme
    if (!localStorage.getItem(THEME_KEY)) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme.value = prefersDark ? 'dark' : 'light';
    }
    updateDOM(theme.value);
  });

  return {
    theme,
    toggleTheme,
    isDark: theme.value === 'dark',
  };
}
