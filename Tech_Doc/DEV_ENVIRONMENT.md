# Einrichtung der Entwicklungsumgebung

## Voraussetzungen

| Tool | Version | Zweck |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | ≥ 22.12.0 | JavaScript-Runtime für das Frontend |
| [npm](https://www.npmjs.com/) | ≥ 10 | Paketverwaltung |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | aktuell | CouchDB-Datenbankserver lokal betreiben |
| [Git](https://git-scm.com/) | aktuell | Versionskontrolle |

Empfohlene IDE: **IntelliJ IDEA**.

### Empfohlene Plugins für IntelliJ IDEA

Folgende Plugins erleichtern die Entwicklung an diesem Projekt erheblich:

- **Vue.js** – Syntax-Highlighting, Code-Completion und Navigation für `.vue`-Dateien.
- **Prettier** – Automatische Code-Formatierung passend zu den Projektvorgaben.
- **ESLint** – Statische Code-Analyse zur Erkennung von Fehlern und Style-Problemen in JavaScript/TypeScript.
- **Docker** – Verwaltung und Monitoring von Docker-Containern direkt aus der IDE heraus; praktisch für den CouchDB-Container.
- **EnvFile** – Unterstützung für `.env`-Dateien mit Syntax-Highlighting und einfachem Laden von Umgebungsvariablen.

### KI-Unterstützung

Zur Steigerung der Produktivität wird der Einsatz eines KI-Assistenten empfohlen. Zwei bewährte Optionen für IntelliJ IDEA:

- **[GitHub Copilot](https://github.com/features/copilot)** – KI-gestützte Code-Vervollständigung und Chat-Funktion direkt in der IDE; unterstützt Vue, JavaScript und TypeScript sehr gut.
- **[Antigravity](https://antigravity.google/)** – Leichtgewichtiger KI-Assistent als IntelliJ-Plugin, der ohne GitHub-Account auskommt und ebenfalls Inline-Vorschläge liefert.

Beide Tools integrieren sich nahtlos in den Entwicklungsworkflow und helfen besonders bei repetitivem Code sowie beim Verstehen unbekannter APIs.

---

## Projekt klonen

```bash
git clone https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys.git
cd syt5-gek1051-mobile-application-codemonkeys
```

---

## Backend – CouchDB mit Docker

Die Datenbank läuft als Docker-Container. Zuerst die Umgebungsvariablen konfigurieren:

```
# CouchDB Admin Credentials
COUCHDB_USER="dein User"
COUCHDB_PASSWORD="dein Passwort"

#Datenbank Namen
DB_NAME=einkaufsliste
```

Dann den Container starten:

```bash
docker compose up -d
```

CouchDB ist danach erreichbar unter: `http://localhost:5984`  
Die Datenbank `einkaufsliste` wird automatisch durch den Init-Container (`init-scripts/init-couchdb.sh`) angelegt.

---

## Frontend – Vue 3 + Vite

```bash
cd frontend
npm install
npm run dev
```

Die App läuft danach unter: `http://localhost:5173`

### Verwendete Technologien

| Technologie | Version | Zweck |
|-------------|---------|-------|
| [Vue 3](https://vuejs.org/) | ^3.5 | Reaktives UI-Framework |
| [Vite](https://vitejs.dev/) | ^7 | Build-Tool & Dev-Server (Hot Module Replacement) |
| IndexedDB (nativ) | – | Lokale Offline-Datenspeicherung im Browser |
| [PouchDB](https://pouchdb.com/) | ^9 | Sync-Schicht zwischen IndexedDB und CouchDB |

---

## Test-Tools

### Framework: Vitest

[Vitest](https://vitest.dev/) ist das Unit-Test-Framework – direkt in Vite integriert, kein separater Build-Schritt nötig.

| Paket | Zweck |
|-------|-------|
| `vitest` | Test-Runner & Assertion-Library |
| `@vue/test-utils` | Vue-Komponenten mounten & testen |
| `jsdom` | Browser-DOM-Simulation in Node.js |
| `@vitest/coverage-v8` | Code-Coverage via V8 |

### Tests ausführen

```bash
cd frontend

# Einmalig ausführen
npm test

# Im Watch-Modus (bei Dateiänderungen automatisch neu)
npm run test:watch

# Mit Coverage-Bericht
npm run test:coverage
```

### Coverage-Schwellenwerte

In `vite.config.js` sind folgende Mindestwerte konfiguriert:

| Metrik | Minimum |
|--------|---------|
| Lines | 80 % |
| Statements | 80 % |
| Functions | 77 % |
| Branches | 70 % |

### Teststruktur

Tests liegen in `src/composables/__tests__/`:

```
src/composables/__tests__/
├── setup.js               # Globales Test-Setup (Console-Mocks)
├── database.test.js       # Tests für IndexedDB/CouchDB-Zugriff
├── useSession.test.js     # Tests für Session-Management
└── useShoppingList.test.js # Tests für Einkaufslisten-Logik
```

Alle externen Abhängigkeiten (IndexedDB, PouchDB, Vue lifecycle hooks) werden mit `vi.mock()` gemockt, damit die Tests ohne Browser und ohne laufende Datenbank funktionieren.

---

## CI/CD

GitHub Actions führt die Unit-Tests automatisch aus bei:
- jedem **Push** auf beliebige Branches
- jedem **Pull Request** auf `main` oder `dev`

Workflow-Datei: `.github/workflows/ci.yml`
