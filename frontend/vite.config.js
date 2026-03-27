import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '..'), // Lade .env aus dem übergeordneten Verzeichnis
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service-Worker auch im Dev-Modus aktivieren (für Tests)
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Einkaufsliste',
        short_name: 'Einkauf',
        description: 'Offline-fähige, synchronisierte Einkaufslisten-App',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'de',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // SPA-Fallback: alle Navigation-Requests auf index.html leiten
        navigateFallback: '/index.html',
        // Precache-Pattern
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // CouchDB-API-Calls NICHT cachen (immer Network-First)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.port === '5984',
            handler: 'NetworkOnly',
            options: {
              cacheName: 'couchdb-api',
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/composables/__tests__/setup.js'],
    exclude: ['node_modules', 'dist', 'e2e', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'json'],
      include: ['src/composables/**/*.js'],
      thresholds: {
        lines: 80,
        functions: 77,
        branches: 70,
        statements: 80,
      },
    },
  },
});
