# Synchronisation und Konfliktmanagement – Vollständige, Schritt-für-Schritt-Erklärung

## Ziel dieser Doku
Diese Dokumentation erklärt die Synchronisation und Konfliktbehandlung so detailliert, dass auch Personen ohne Programmierkenntnisse den Ablauf und die Logik nachvollziehen können. Jeder Schritt, jede Entscheidung und jeder Spezialfall wird erläutert – von der ersten Änderung bis zur endgültigen Synchronisation zwischen mehreren Geräten und Benutzern.

---

## 1. Was ist Synchronisation in diesem Projekt?

Synchronisation bedeutet, dass alle Änderungen, die ein Benutzer an seiner Einkaufsliste macht (z.B. Artikel hinzufügen, abhaken, löschen), automatisch auf allen anderen Geräten und bei allen anderen Benutzern erscheinen – egal, ob sie gerade online oder offline sind.

Die Daten werden lokal im Browser gespeichert (**IndexedDB**) und regelmäßig mit einer zentralen Datenbank im Internet (**CouchDB**) abgeglichen. Das System ist **Offline-First**: Alle Änderungen sind sofort sichtbar, auch ohne Internetverbindung.

---

## 2. Wie werden Daten gespeichert?

### 2.1 Lokale Datenbank (IndexedDB)

- **Name:** `einkaufsliste_db`, Version `6`
- **Object Store:** `documents` (Primärschlüssel: `_id`)
- **Indizes:** `type`, `deleted`
- Speichert alle Einkaufslisten und Artikel, auch komplett offline

### 2.2 Zentrale Datenbank (CouchDB)

- **URL:** `http://localhost:5984/einkaufsliste` (konfigurierbar über Umgebungsvariablen)
- **Authentifizierung:** HTTP Basic Auth
- **Setup:** Docker Compose (`docker-compose.yml`) mit automatischer Initialisierung via `init-scripts/init-couchdb.sh`
- Sammelt alle Daten aller Benutzer; erreichbar über das Internet

### 2.3 Dokumentstruktur

Jedes Dokument (Liste oder Artikel) hat folgende Felder:

**Einkaufsliste (type: "list"):**
```json
{
  "_id": "list_1700000000000_abc12",
  "_rev": "3-xyz",
  "type": "list",
  "name": "Wocheneinkauf",
  "owner": "Max",
  "deleted": false,
  "shareCode": "ABC123",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "updatedAt": "2025-01-02T12:00:00.000Z",
  "fieldTimestamps": { "name": "2025-01-02T12:00:00.000Z" }
}
```

**Artikel (type: "item"):**
```json
{
  "_id": "item_1700000000001_def34",
  "_rev": "2-abc",
  "type": "item",
  "list_id": "list_1700000000000_abc12",
  "name": "Milch",
  "checked": false,
  "markedDeleted": false,
  "lastModifiedBy": "Max",
  "createdAt": "2025-01-01T10:05:00.000Z",
  "updatedAt": "2025-01-01T10:05:00.000Z",
  "fieldTimestamps": { "checked": "2025-01-01T10:05:00.000Z", "name": "2025-01-01T10:00:00.000Z" }
}
```

**Interne Felder (werden VOR dem Upload zu CouchDB entfernt, siehe `prepareForUpload()` in `database.js:313`):**

| Feld | Bedeutung |
|------|-----------|
| `_dirty` | Lokal geändert, noch nicht synchronisiert |
| `_remoteChanged` | Zentrale Änderung eingegangen, Benutzer soll informiert werden |
| `_changeTimestamp` | Zeitstempel der letzten Remote-Änderungs-Benachrichtigung |
| `_pendingDelete` | Benutzername, der remote gelöscht hat – wartet auf Benutzerentscheidung |

---

## 3. Was passiert, wenn ein Benutzer etwas ändert?

1. Die Änderung wird **sofort lokal** in IndexedDB gespeichert (via `putDoc()` in `database.js:259`).
2. Das Dokument wird mit `_dirty: true` markiert.
3. Das Feld `fieldTimestamps[feldname]` wird mit dem aktuellen Zeitstempel gesetzt – so weiß das System später, welches Feld wann zuletzt geändert wurde.
4. Das Feld `lastModifiedBy` wird auf den Benutzernamen der aktuellen Session gesetzt.
5. Die Änderung ist **sofort in der Benutzeroberfläche** sichtbar, ohne auf den Server zu warten.
6. Im Hintergrund läuft alle **5 Sekunden** ein Sync-Prozess, der die Änderung hochlädt.

---

## 4. Wie läuft die Synchronisation ab? (Schritt für Schritt)

Zentrale Datei: `frontend/src/composables/database.js`

```
┌─────────────────────────────────────────────┐
│             Browser (Client)                │
│  Vue 3 Komponenten                          │
│       ↓ ↑                                   │
│  useShoppingList.js  (Business-Logik)       │
│       ↓ ↑                                   │
│  database.js         (Sync-Logik)           │
│       ↓ ↑                                   │
│  IndexedDB           (lokale Datenbank)     │
└─────────────────────────────────────────────┘
              ↓ ↑  HTTP/REST
     ┌─────────────────────┐
     │      CouchDB        │
     │  (Port 5984, Docker)│
     └─────────────────────┘
```

### 4.1 Initialisierung (`checkAndInitialSync()`, `database.js:79`)

- Beim ersten App-Start wird geprüft, ob IndexedDB leer ist.
- Falls **leer**: Vollständige Erstbefüllung aus CouchDB via `syncFromRemote()`.
- Falls **nicht leer**: Initialer Sync wird übersprungen, der periodische Sync übernimmt.

### 4.2 Periodischer Sync (alle 5 Sekunden)

Die Funktion `startSync()` (`database.js:50`) startet einen Timer. Alle 5 Sekunden ruft `syncInBackground()` (`database.js:91`) folgendes auf:

1. **Push-Phase:** `pushDirtyDocs()` (`database.js:198`) – lokale Änderungen hochladen
2. **Pull-Phase:** `syncFromRemote()` (`database.js:124`) – zentrale Änderungen herunterladen
3. **UI-Update:** Status-Callback aktualisiert `isOnline` und `syncActive` in der Benutzeroberfläche

### 4.3 Push-Phase: Lokale Änderungen hochladen (`pushDirtyDocs()`, `database.js:198`)

1. Alle Dokumente mit `_dirty: true` aus IndexedDB laden.
2. Für jedes Dokument `syncToRemote()` aufrufen.
3. Interne Felder via `prepareForUpload()` entfernen (kein `_dirty`, `_remoteChanged` etc. in CouchDB).
4. HTTP `PUT` an CouchDB senden.
5. **Erfolg (HTTP 200/201):** `_dirty` entfernen, `_rev` aktualisieren.
6. **Konflikt (HTTP 409):** `resolveConflict()` aufrufen (siehe Abschnitt 6).

### 4.4 Pull-Phase: Zentrale Änderungen herunterladen (`syncFromRemote()`, `database.js:124`)

1. CouchDB `_changes`-Endpoint abfragen: `GET /_changes?include_docs=true&since=0`
2. Für jeden empfangenen Eintrag:

| Situation | Aktion |
|-----------|--------|
| Dokument in CouchDB gelöscht (Tombstone) | Lokal hart löschen |
| Neues Dokument, lokal nicht vorhanden | Lokal anlegen |
| Lokal `_dirty: true` | Remote-Änderung **ignorieren** – lokale Version gewinnt |
| Lokal `_pendingDelete` gesetzt | Übersprungen – Benutzer muss erst entscheiden |
| Revisionen unterschiedlich (`_rev` mismatch) → Remote als gelöscht markiert | `_pendingDelete` setzen (Konflikttyp 1) |
| Revisionen unterschiedlich → andere Änderung | `_remoteChanged: true` setzen (Konflikttyp 3) |

---

## 5. Was ist ein Konflikt und wie wird er erkannt?

Ein Konflikt entsteht, wenn zwei oder mehr Benutzer **gleichzeitig** (oder im Offline-Modus) dasselbe Dokument ändern.

**Beispiele:**
- Benutzer A markiert einen Artikel als erledigt, während Benutzer B denselben Artikel löscht.
- Benutzer A ändert den Namen eines Artikels, während Benutzer B denselben Artikel umbenennt.
- Benutzer A arbeitet offline und lädt seine Änderung hoch, aber das Dokument wurde auf dem Server inzwischen geändert.

Das System erkennt Konflikte auf zwei Wegen:
1. **Beim Hochladen:** CouchDB antwortet mit **HTTP 409 (Conflict)** – das `_rev`-Feld stimmt nicht mehr überein.
2. **Beim Herunterladen:** `syncFromRemote()` stellt fest, dass die `_rev` des lokalen Dokuments von der Remote-Version abweicht.

---

## 6. Wie werden Konflikte gelöst? (Schritt für Schritt)

Zentrale Funktion: `resolveConflict(localDoc, remoteDoc)` in `database.js:385`

### 6.1 Konflikttyp 1: Löschkonflikt (`_pendingDelete`)

**Szenario:** Das Dokument wurde remote mit `markedDeleted: true` markiert, ist lokal aber noch aktiv – oder umgekehrt.

**Erkennung:** `resolveConflict()` (`database.js:394`) prüft das Feld `markedDeleted`.

#### Fall A: Remote gelöscht, lokal nicht

1. Das lokale Dokument bekommt `_pendingDelete: "Benutzername"` (Name des letzten Remote-Bearbeiters).
2. In der Benutzeroberfläche erscheint ein **Konflikt-Banner** (`ShoppingList.vue:443`):
   ```
   🗑️ [Benutzername] hat diesen Artikel gelöscht.
   [Ja]  [Nein]
   ```
3. Benutzer klickt **"Ja"** → `acceptDelete()` (`useShoppingList.js:386`):
   - `markedDeleted` wird auf `true` gesetzt
   - Dokument wird als `_dirty` markiert und hochgeladen
4. Benutzer klickt **"Nein"** → `rejectDelete()` (`useShoppingList.js:407`):
   - `markedDeleted` bleibt `false`
   - `_pendingDelete` wird entfernt
   - Lokale Version wird mit aktualisiertem Timestamp hochgeladen

#### Fall B: Lokal gelöscht, remote nicht

- Lokale Löschung gewinnt sofort.
- Die lokale `markedDeleted: true`-Version wird an CouchDB gesendet.
- Kein Benutzereingriff nötig.

### 6.2 Konflikttyp 2: Feldkonflikt – Last-Write-Wins pro Feld

**Szenario:** Zwei Benutzer haben verschiedene Felder desselben Dokuments geändert (z.B. A ändert `name`, B ändert `checked`).

**Erkennung:** HTTP 409 beim Upload → `syncToRemote()` ruft `resolveConflict()` auf.

**Merge-Algorithmus** (`database.js:428`):

```
Für jedes Feld im lokalen Dokument:
  Falls nur lokal Timestamp vorhanden → lokalen Wert nehmen
  Falls Remote-Timestamp neuer als lokaler → Remote-Wert nehmen
  Falls lokaler Timestamp neuer als Remote → lokalen Wert nehmen
  Falls nur Remote-Timestamp vorhanden → Remote-Wert nehmen
```

Das Ergebnis ist ein **gemischtes Dokument**, das das jeweils neueste Feld aus beiden Versionen enthält. Dieses Merge-Dokument wird als `_dirty` markiert und beim nächsten Sync hochgeladen.

**Beispiel:**
- Remote: `name: "Milch 3,5%"` (Timestamp 5000), `checked: false` (Timestamp 1000)
- Lokal: `name: "Milch"` (Timestamp 2000), `checked: true` (Timestamp 6000)
- Ergebnis: `name: "Milch 3,5%"` (Remote gewinnt), `checked: true` (Lokal gewinnt)

### 6.3 Konflikttyp 3: Remote-Änderungs-Hinweis (`_remoteChanged`)

**Szenario:** Ein Dokument wurde remote geändert (kein Löschkonflikt), und lokal gibt es eine andere Version.

**Erkennung:** `syncFromRemote()` (`database.js:175`) stellt `_rev`-Unterschied fest.

**Ablauf:**
1. Das lokale Dokument bekommt `_remoteChanged: true` und `_changeTimestamp: Date.now()`.
2. In der Benutzeroberfläche erscheint ein **Hinweis-Banner** (`ShoppingList.vue:424`):
   ```
   ✏️ Geändert von [Benutzername]
   ```
3. Am Listenkopf erscheint ein Button **"Änderungen ansehen"** (`hasChangedItems()`, `useShoppingList.js:364`).
4. Benutzer klickt **"✓ Gesehen"** → `clearListChanges()` (`useShoppingList.js:372`) entfernt alle `_remoteChanged`-Flags der Liste.

> **Wichtig:** `_remoteChanged` ist nur eine **Benachrichtigung** – die Remote-Änderung wurde bereits automatisch übernommen. Der Benutzer bestätigt nur, dass er die Änderung zur Kenntnis genommen hat.

---

## 7. Beispiel: Vier Personen, ein Artikel (2 online / 2 offline)

### Ausgangslage
- Artikel: `name: "Milch"`, `checked: false`, `markedDeleted: false`
- `fieldTimestamps`: `name: 1000`, `checked: 1000`, `markedDeleted: 1000`

### Aktionen
- **Benutzer A (offline):** Hakt Artikel ab → `checked: true`, Timestamp: 2000
- **Benutzer D (offline):** Ergänzt eine Notiz → `note: "laktosefrei"`, Timestamp: 2500
- **Benutzer C (online):** Ändert Namen → `name: "Milch 3,5%"`, Timestamp: 3000
- **Benutzer B (online):** Markiert als gelöscht → `markedDeleted: true`, Timestamp: 4000

### Synchronisation

1. **Benutzer B und C** synchronisieren sofort. CouchDB enthält jetzt u.a.:
   - `markedDeleted: true` (Timestamp 4000)
   - `name: "Milch 3,5%"` (Timestamp 3000)
   - `checked: false` (Timestamp 1000)
   - `_rev: "3-xyz"`

2. **Benutzer A und D** kommen später online und versuchen ihre lokale Version hochzuladen:
   - CouchDB antwortet jeweils mit **HTTP 409** (veraltete `_rev`)
   - `resolveConflict()` sieht: Remote hat `markedDeleted: true`, lokal `markedDeleted: false`
   - → **Konflikttyp 1:** Für beide wird `_pendingDelete` gesetzt (mit `lastModifiedBy`, z.B. "Benutzer B")

3. **Benutzer A und D** sehen lokal das Konflikt-Banner:  
   *"Benutzer B hat diesen Artikel gelöscht. Ja/Nein?"*

4. **Entscheidungen (pro offline Benutzer einzeln):**
   - **"Ja":** `acceptDelete()` setzt lokal `markedDeleted: true` und synchronisiert diese Version.
   - **"Nein":** `rejectDelete()` setzt lokal `markedDeleted: false` und synchronisiert diese Version.

5. **Wichtig für dieses 4-User-Szenario:**  
   In diesem `_pendingDelete`-Pfad gibt es **keinen automatischen Feld-Merge** zwischen A und D.  
   Wer zuletzt synchronisiert, bestimmt den finalen Zustand des Dokuments auf CouchDB (inklusive seiner lokalen Feldwerte).

---

## 8. Was passiert bei Löschungen und Wiederherstellung?

- **Soft Delete:** `markedDeleted` wird auf `true` gesetzt – das Dokument bleibt erhalten (`markItemDeleted()`, `useShoppingList.js:340`).
- **Wiederherstellung:** `markedDeleted` wird auf `false` zurückgesetzt (`restoreItem()`, `useShoppingList.js:305`).
- **Endgültiges Löschen:** `hardDeleteDoc()` (`database.js:607`) löscht das Dokument aus IndexedDB **und** aus CouchDB (HTTP DELETE).
- **Alle markierten Artikel löschen:** `permanentlyDeleteAllMarked()` (`useShoppingList.js:328`) ruft `hardDeleteDoc()` für jeden `markedDeleted: true`-Artikel auf.

---

## 9. Listen teilen (Share Codes)

- **Share Code generieren:** `generateShareCode()` (`useShoppingList.js:188`) erstellt einen zufälligen 6-stelligen alphanumerischen Code, speichert ihn im `shareCode`-Feld der Liste.
- **Liste beitreten:** `joinListByCode()` (`useShoppingList.js:219`) fragt CouchDB via `findListByShareCode()` (`database.js:644`) nach der Liste, importiert die Liste und alle zugehörigen Artikel lokal.
- Codes werden **direkt in CouchDB gespeichert** und sind für alle Benutzer sichtbar.

---

## 10. Technische Besonderheiten und Fehlerbehandlung

- **Offline-Fähigkeit:** Alle Änderungen werden lokal gespeichert (`_dirty: true`) und beim nächsten erfolgreichen Sync hochgeladen. Die App ist voll funktionsfähig ohne Internetverbindung.
- **Online/Offline-Erkennung:** `window.addEventListener('online'/'offline')` (`useShoppingList.js:267`) aktualisiert den `isOnline`-Status in der UI.
- **Sync-Status in der UI:** `isOnline` und `syncActive` (`useShoppingList.js:154`) steuern den Statusindikator im App-Header.
- **Benutzer-Session:** Der Benutzername wird in `localStorage` unter `einkaufsliste_session_name` gespeichert (`useSession.js`). Er wird als `lastModifiedBy` in Dokumenten gesetzt und in Konflikt-Bannern angezeigt.
- **Fehlermeldungen:** Bei Netzwerk- oder Auth-Fehlern wird `error.value` gesetzt und nach 3 Sekunden automatisch gelöscht.
- **`_rev`-Verwaltung:** Nach jedem erfolgreichen Upload aktualisiert das System die `_rev` lokal – das ist CouchDB's Mechanismus zur Konflikterkennung (MVCC).

---

## 11. Zusammenfassung (für Nicht-Programmierer)

- Jede Änderung wird **sofort lokal** gespeichert und alle 5 Sekunden mit der zentralen Datenbank abgeglichen.
- **Keine Änderung geht verloren** – auch bei Offline-Nutzung.
- Konflikte werden **automatisch** auf Feldebene gelöst (neuester Timestamp gewinnt).
- Bei **Löschkonflikten** wird der Benutzer gefragt und entscheidet selbst.
- **Remote-Änderungen** werden automatisch übernommen und dem Benutzer als Information angezeigt.
- Alle Sync- und Konfliktlogik befindet sich in `frontend/src/composables/database.js`.

---

## 12. Funktionsübersicht (Technische Referenz)

### `database.js`

| Funktion | Zeile | Zweck |
|----------|-------|-------|
| `openDB()` | 14 | Öffnet/erstellt IndexedDB-Verbindung |
| `startSync(onStatus, onConflict, onDataChange)` | 50 | Startet 5-Sekunden-Sync-Loop |
| `stopSync()` | 117 | Stoppt den Sync-Loop |
| `checkAndInitialSync()` | 79 | Erstbefüllung falls IndexedDB leer |
| `syncInBackground()` | 91 | Push + Pull alle 5 Sekunden |
| `syncFromRemote()` | 124 | Zieht Änderungen von CouchDB |
| `pushDirtyDocs()` | 198 | Lädt alle `_dirty`-Dokumente hoch |
| `syncToRemote(doc)` | 323 | Lädt ein Dokument hoch, behandelt 409 |
| `resolveConflict(localDoc, remoteDoc)` | 385 | Haupt-Konfliktlösung (Merge oder Pending) |
| `applyConflictResolution(docId, chosenDoc)` | 475 | Benutzer-gewählte Version → Server |
| `restoreLocalVersion(docId, localVersion)` | 519 | Lokale Version erzwingen |
| `prepareForUpload(doc)` | 313 | Entfernt interne Felder vor CouchDB-Upload |
| `putDoc(doc)` | 259 | Speichert Dokument lokal mit Timestamps |
| `getDoc(id)` | 242 | Lädt ein Dokument aus IndexedDB |
| `getAllDocs()` | 225 | Lädt alle Dokumente aus IndexedDB |
| `hardDeleteDoc(id)` | 607 | Löscht aus IndexedDB + CouchDB |
| `clearRemoteChangedFlag(docId)` | 573 | Entfernt `_remoteChanged`-Flag |
| `clearPendingDeleteFlag(docId)` | 537 | Entfernt `_pendingDelete`-Flag |
| `findListByShareCode(code)` | 644 | Sucht Liste nach Share-Code in CouchDB |
| `fetchItemsForListFromRemote(listId)` | 675 | Lädt Artikel einer Liste von CouchDB |

### `useShoppingList.js`

| Funktion | Zeile | Zweck |
|----------|-------|-------|
| `loadData()` | 55 | Lädt alle Listen und Artikel aus IndexedDB |
| `addList(name)` | 114 | Erstellt neue Liste (als `_dirty` markiert) |
| `addItem(listId, name)` | 96 | Fügt Artikel hinzu (als `_dirty` markiert) |
| `toggleItem(item)` | 129 | Abhaken mit per-Feld-Timestamp |
| `markItemDeleted(item)` | 340 | Soft-Delete eines Artikels |
| `restoreItem(item)` | 305 | Stellt Soft-Delete rückgängig |
| `permanentlyDeleteAllMarked(listId)` | 328 | Hart-löscht alle `markedDeleted`-Artikel |
| `generateShareCode(listId)` | 188 | Erstellt 6-stelligen Share-Code |
| `joinListByCode(code)` | 219 | Tritt Liste via Share-Code bei |
| `acceptDelete(item)` | 386 | Benutzer akzeptiert Remote-Löschung |
| `rejectDelete(item)` | 407 | Benutzer lehnt Remote-Löschung ab |
| `hasChangedItems(listId)` | 364 | Prüft ob Liste `_remoteChanged`-Artikel hat |
| `clearListChanges(listId)` | 372 | Entfernt alle `_remoteChanged`-Flags |

---

## 13. Glossar (Begriffe einfach erklärt)

| Begriff | Erklärung |
|---------|-----------|
| **IndexedDB** | Die lokale Datenbank im Browser, speichert alle Daten offline. |
| **CouchDB** | Die zentrale Datenbank im Internet, sammelt alle Daten aller Benutzer. |
| **`_id`** | Eindeutige ID eines Dokuments, z.B. `item_1700000000_abc12`. Wird einmal vergeben und nie geändert. |
| **`_rev`** | CouchDB-Revisionsnummer (z.B. `3-xyz`). Ändert sich bei jeder Speicherung. Ermöglicht Konflikterkennung. |
| **`_dirty`** | Markiert ein Dokument als lokal geändert, aber noch nicht synchronisiert. |
| **`_pendingDelete`** | Benutzername, der remote gelöscht hat – Benutzer muss entscheiden. |
| **`_remoteChanged`** | Remote-Änderung wurde automatisch übernommen – Benutzer wird informiert. |
| **`fieldTimestamps`** | Speichert für jedes Feld, wann es zuletzt geändert wurde. Basis für Last-Write-Wins-Merge. |
| **Konflikt** | Zwei Benutzer ändern gleichzeitig dasselbe Dokument. |
| **Merge** | Zusammenführen von Änderungen aus mehreren Versionen eines Dokuments (feldweise). |
| **Soft Delete** | Dokument bleibt erhalten, wird aber mit `markedDeleted: true` als gelöscht markiert. |
| **Hard Delete** | Dokument wird dauerhaft aus IndexedDB und CouchDB gelöscht. |
| **MVCC** | Multi-Version Concurrency Control – CouchDB's Mechanismus zur gleichzeitigen Änderungsverwaltung via `_rev`. |
| **Last-Write-Wins** | Merge-Strategie: Bei Feldern, die beide Seiten geändert haben, gewinnt der neuere Timestamp. |
| **Share Code** | 6-stelliger alphanumerischer Code, mit dem andere Benutzer einer geteilten Liste beitreten können. |
| **Session** | Der Benutzername des aktuell eingeloggten Benutzers (gespeichert in `localStorage`). |
