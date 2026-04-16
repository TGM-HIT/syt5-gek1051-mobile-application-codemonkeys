import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      '**/dev-dist/**',
      'dev-dist/**',
      '**/dist/**',
      'dist/**',
      '**/.vite/**',
      '.vite/**',
      '**/coverage/**',
      'coverage/**',
      '**/playwright-report/**',
      'playwright-report/**',
      '**/test-results/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  pluginVue.configs['flat/essential'],
  configPrettier,
  {
    plugins: { prettier: pluginPrettier },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': [
        'error',
        { caughtErrors: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
