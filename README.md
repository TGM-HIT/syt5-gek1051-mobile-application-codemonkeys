# syt5-gek1051-mobile-application-codemonkeys

Eine mobile Einkaufslisten-App mit Offline-Fähigkeit und bidirektionaler Synchronisation, gebaut mit Vue 3 + PouchDB/CouchDB.

## Team

| Rolle | Person |
| :--- | :--- |
| Product Owner (PO) | Vincent Weinzinger |
| Technical Architect (TA) | Lukas Schrenk |
| Developer (Ameise) | Niklas Strobl |
| Developer (Bmeise) | Maged Negm |
| Developer (Cmeise) | Aran Yildirim |

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Projekt-Setup](#projekt-setup)
- [Verfügbare Scripts](#verfügbare-scripts)
- [Projektstruktur](#projektstruktur)
- [Branch-Strategie](#branch-strategie)
- [Code-Qualität](#code-qualität)
- [Stories und Tasks](#stories-und-tasks)

## Voraussetzungen

Folgende Tools müssen installiert sein:

- **Node.js** `^20.19.0` oder `>=22.12.0`
- **npm** (kommt mit Node.js)
- **Docker** & **Docker Compose** (für das Backend / CouchDB)
- **Git**

## Projekt-Setup

### 1. Repository klonen

```bash
git clone https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys.git
cd syt5-gek1051-mobile-application-codemonkeys
```

### 2. Frontend-Dependencies installieren

```bash
cd frontend
npm install
```

### 3. Backend starten (CouchDB via Docker)

```bash
# Im Root-Verzeichnis des Projekts
docker compose up -d
```

CouchDB ist danach erreichbar unter: `http://localhost:5984`

### 4. Frontend starten

```bash
cd frontend
npm run dev
```

Die App ist dann unter `http://localhost:5173` erreichbar.

## Verfügbare Scripts

Alle Scripts werden im `frontend/`-Verzeichnis ausgeführt:

| Script | Beschreibung |
| :--- | :--- |
| `npm run dev` | Startet den Vite-Entwicklungsserver mit Hot-Reload |
| `npm run build` | Erstellt einen Production-Build im `dist/`-Ordner |
| `npm run preview` | Vorschau des Production-Builds lokal |
| `npm run lint` | ESLint prüft alle `.js`, `.mjs`, `.cjs` und `.vue`-Dateien |
| `npm run format` | Prettier formatiert alle Dateien automatisch |
| `npm test` | Führt alle Unit-Tests einmalig aus (Vitest) |
| `npm run test:watch` | Führt Tests im Watch-Modus aus |
| `npm run test:coverage` | Erstellt einen Coverage-Report |

## Projektstruktur

```
syt5-gek1051-mobile-application-codemonkeys/
├── .github/
│   └── workflows/
│       └── ci.yml          # CI-Pipeline (Lint + Tests)
├── frontend/               # Vue 3 Frontend-App
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── App.vue
│   │   └── main.js
│   ├── public/
│   ├── eslint.config.js    # ESLint-Konfiguration (mit Prettier)
│   ├── .prettierrc         # Prettier-Konfiguration
│   ├── vite.config.js
│   └── package.json
├── init-scripts/           # CouchDB-Initialisierungsscripte
├── docker-compose.yml      # Docker-Setup für CouchDB
├── STORIES.md              # User & Developer Stories
└── README.md
```

## Branch-Strategie

- **`main`**: Stabiler Produktionsbranch — nur über Pull Requests befüllbar
- **`dev`**: Integrations-Branch — Features werden hier zusammengeführt
- **`feature/<name>`**: Neue Features oder Bugfixes

**Branch Protection Rules für `main`:**
- Direktes Pushen ist gesperrt
- Pull Requests erfordern mindestens 1 Approval
- CI-Pipeline (Lint + Tests) muss vor dem Merge grün sein

Workflow:
```
feature-branch → dev (PR) → main (PR)
```

## Code-Qualität

Das Projekt verwendet **ESLint** und **Prettier** zur Sicherstellung einheitlichen Codes.

### Konfiguration

- **ESLint** (`eslint.config.js`): Vue 3 + JS-Regeln mit Prettier-Integration
- **Prettier** (`.prettierrc`): Single Quotes, Semikolons, max. 100 Zeichen Zeilenbreite

### Vor einem Commit empfohlen

```bash
# Code formatieren
npm run format

# Lint-Fehler prüfen
npm run lint
```

### CI-Pipeline

Bei jedem Push und jedem Pull Request auf `main` oder `dev` werden automatisch ausgeführt:

1. **Lint-Job**: ESLint prüft den gesamten Code
2. **Test-Job**: Vitest führt alle Unit-Tests aus

## Stories und Tasks

Details zu allen User Stories und Developer Stories sind in [STORIES.md](STORIES.md) zu finden.

Der Status des aktuellen Sprints ist im [GitHub Projects Board](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues) einsehbar.
