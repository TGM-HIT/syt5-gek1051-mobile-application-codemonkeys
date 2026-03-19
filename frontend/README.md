# Frontend - Einkaufsliste

Vue.js Frontend mit PouchDB für Offline-First Synchronisation.

## Voraussetzungen

- Node.js >= 24.11.0
- npm
- CouchDB läuft auf `http://localhost:5984`

## Installation

```bash
# Dependencies installieren
npm install

# PouchDB für Offline-Sync
npm install pouchdb
```

## Entwicklung

```bash
# Dev-Server starten (Hot-Reload)
npm run dev
```

App läuft auf: `http://localhost:5173`

## Build

```bash
# Production Build
npm run build

# Preview vom Build
npm run preview
```

## Technologie-Stack

- **Vue 3** - Frontend Framework
- **Vite** - Build Tool & Dev Server
- **PouchDB** - Lokale Datenbank (IndexedDB) mit automatischer CouchDB-Sync
- **Offline-First** - App funktioniert auch ohne Internet

## Datenbank-Verbindung

CouchDB: `http://localhost:5984/einkaufsliste`

- User: `admin`
- Passwort: `passwort`
