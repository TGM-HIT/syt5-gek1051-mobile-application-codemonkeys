# syt5-gek1051-mobile-application-codemonkeys

![CI](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-79%25-green)
![Tests](https://img.shields.io/badge/tests-641%2B-blue)
![E2E](https://img.shields.io/badge/E2E-Pending-blue)

## Projektbeschreibung

Dieses Projekt ist eine mobile Einkaufslisten-App, die den Alltag beim Einkaufen einfacher macht.

Die Idee ist: Du kannst deine Einkaufsliste jederzeit bearbeiten - auch ohne Internet. Sobald wieder eine Verbindung besteht, werden alle Änderungen automatisch mit dem Server abgeglichen.

Das bedeutet in der Praxis:

- Du kannst zu Hause Produkte zur Liste hinzufügen.
- Im Supermarkt kannst du auch ohne Empfang weiter abhaken oder ergänzen.
- Später sind die Daten auf allen Geräten wieder auf demselben Stand.

Die App ist also besonders nützlich für Situationen mit schlechtem Netz und für Personen, die eine verlässliche Liste ohne Datenverlust möchten.

Technisch basiert die Anwendung auf **Vue 3** (Benutzeroberfläche) sowie **PouchDB/CouchDB** (Datenspeicherung und Synchronisation).

Live-Demo: http://51.11.225.25/

## Inhaltsverzeichnis

- [Features](#features)
- [Technologie-Stack](#technologie-stack)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Projekt-Setup](#projekt-setup)
- [Verfügbare Skripte](#verfügbare-skripte)
- [Projektstruktur](#projektstruktur)
- [Team](#team)
- [Branch-Strategie](#branch-strategie)
- [Code-Qualität](#code-qualität)
- [Testing](#testing)
- [Stories und Tasks](#stories-und-tasks)

## Features

- Offline-First Einkaufslistenverwaltung
- Bidirektionale Synchronisation zwischen lokalem Speicher und Backend
- Moderne Vue-3-Frontend-Architektur
- Unit- und E2E-Testabdeckung mit CI-Integration

## Technologie-Stack

- **Frontend:** Vue 3, Vite
- **Datenspeicherung/Sync:** PouchDB, CouchDB
- **Testing:** Vitest, Playwright
- **Qualitätssicherung:** ESLint, Prettier
- **Container:** Docker, Docker Compose

## Voraussetzungen

Folgende Tools müssen installiert sein:

- **Node.js** `^20.19.0` oder `>=22.12.0`
- **npm** (kommt mit Node.js)
- **Docker** & **Docker Compose** (für das Backend / CouchDB)
- **Git**

## Installation

```bash
git clone https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys.git
cd syt5-gek1051-mobile-application-codemonkeys
```

## Projekt-Setup

### 1. Frontend-Dependencies installieren

```bash
cd frontend
npm install
```

### 2. Backend starten (CouchDB via Docker)

```bash
# Im Root-Verzeichnis des Projekts
docker compose up -d
```

CouchDB ist danach erreichbar unter: `http://localhost:5984`

### 3. Frontend starten

```bash
cd frontend
npm run dev
```

Die App ist dann unter `http://localhost:5173` erreichbar.

## Verfügbare Skripte

Alle Skripte werden im Verzeichnis `frontend/` ausgeführt:

| Skript | Beschreibung |
| :--- | :--- |
| `npm run dev` | Startet den Vite-Entwicklungsserver mit Hot-Reload |
| `npm run build` | Erstellt einen Production-Build im `dist/`-Ordner |
| `npm run preview` | Vorschau des Production-Builds lokal |
| `npm run lint` | ESLint prüft alle `.js`, `.mjs`, `.cjs` und `.vue`-Dateien |
| `npm run format` | Prettier formatiert alle Dateien automatisch |
| `npm test` | Führt alle Unit-Tests einmalig aus (Vitest) |
| `npm run test:watch` | Führt Tests im Watch-Modus aus |
| `npm run test:coverage` | Erstellt einen Coverage-Report |
| `npm run test:e2e` | Führt E2E-Tests mit Playwright aus |
| `npm run test:e2e:ui` | Startet Playwright im UI-Modus |
| `npm run test:e2e:headed` | Führt E2E-Tests im sichtbaren Browser aus |
| `npm run test:e2e:debug` | Führt E2E-Tests im Debug-Modus aus |
| `npm run test:all` | Unit-Tests + E2E-Tests zusammen |

## Projektstruktur

```text
syt5-gek1051-mobile-application-codemonkeys/
├── .github/
│   └── workflows/
│       └── ci.yml
├── frontend/
│   ├── src/
│   ├── e2e/
│   ├── public/
│   ├── eslint.config.js
│   ├── playwright.config.js
│   ├── vite.config.js
│   └── package.json
├── init-scripts/
├── docker-compose.yml
├── STORIES.md
├── TESTING.md
└── README.md
```

## Team

| Rolle | Person |
| :--- | :--- |
| Product Owner (PO) | Vincent Weinzinger |
| Technical Architect (TA) | Lukas Schrenk |
| Developer (Ameise) | Niklas Strobl |
| Developer (Bmeise) | Maged Negm |
| Developer (Cmeise) | Aran Yildirim |

## Branch-Strategie

- **`main`**: Stabiler Produktionsbranch - nur über Pull Requests befüllbar
- **`dev`**: Integrations-Branch - Features werden hier zusammengeführt
- **`feature/<name>`**: Neue Features oder Bugfixes

Branch-Protection-Rules für `main`:

- Direktes Pushen ist gesperrt
- Pull Requests erfordern mindestens 1 Approval
- CI-Pipeline (Lint + Tests) muss vor dem Merge grün sein

Workflow:

```text
feature-branch -> dev (PR) -> main (PR)
```

## Code-Qualität

Das Projekt verwendet **ESLint** und **Prettier** zur Sicherstellung einheitlichen Codes.

- **ESLint** (`eslint.config.js`): Vue-3- und JavaScript-Regeln mit Prettier-Integration
- **Prettier** (`.prettierrc`): Einheitliche Formatierung

Vor einem Commit empfohlen:

```bash
npm run format
npm run lint
```

## Testing

```bash
# Unit-Tests
npm test

# E2E-Tests (benötigt laufenden Dev-Server)
npm run test:e2e

# Alle Tests
npm run test:all

# Coverage-Report
npm run test:coverage
```

Weitere Details: [TESTING.md](TESTING.md)

## Stories und Tasks

Details zu allen User Stories und Developer Stories sind in [STORIES.md](STORIES.md) zu finden.

Der Status des aktuellen Sprints ist im [GitHub Projects Board](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues) einsehbar.
