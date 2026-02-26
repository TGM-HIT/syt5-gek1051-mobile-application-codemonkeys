# API & Komponenten Dokumentation

## Architekturübersicht

```
ShoppingList.vue / SessionSetup.vue   ← Vue-Komponenten (UI)
        │
        ▼
useShoppingList.js / useSession.js    ← Composables (Business-Logik)
        │
        ▼
database.js                           ← Datenbankschicht (IndexedDB + CouchDB)
        │
        ├── IndexedDB (lokal, offline-fähig)
        └── CouchDB REST API (remote, http://localhost:5984)
```

---

## CouchDB REST API

Basis-URL: `http://localhost:5984/einkaufsliste`  
Authentifizierung: HTTP Basic Auth (`COUCHDB_USER` / `COUCHDB_PASSWORD`)

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `GET` | `/_changes?include_docs=true&since=0` | Alle Änderungen seit Beginn abrufen (Pull-Sync) |
| `GET` | `/{docId}` | Einzelnes Dokument abrufen |
| `PUT` | `/{docId}` | Dokument anlegen oder aktualisieren (braucht aktuelle `_rev`) |
| `DELETE` | `/{docId}?rev={_rev}` | Dokument löschen (Hard-Delete) |

### Datenmodell

**Liste** (`type: "list"`)
```json
{
  "_id": "list_1700000000000_abc12",
  "_rev": "3-xyz",
  "type": "list",
  "name": "Wocheneinkauf",
  "owner": "Max",
  "deleted": false,
  "createdAt": "2025-01-01T10:00:00.000Z",
  "updatedAt": "2025-01-02T12:00:00.000Z"
}
```

**Item** (`type: "item"`)
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
  "updatedAt": "2025-01-01T10:05:00.000Z"
}
```

### Interne Felder (werden vor dem Upload entfernt)

| Feld | Bedeutung |
|------|-----------|
| `_dirty` | Lokale Änderung noch nicht gesynct |
| `_remoteChanged` | Remote-Änderung eingetroffen, noch nicht bestätigt |
| `_pendingDelete` | Jemand anderes hat das Item gelöscht – User muss bestätigen |
| `_lastModified` | Timestamp der letzten lokalen Änderung |
| `fieldTimestamps` | Pro-Feld-Timestamps für konfliktfreies Auto-Merge |

---

## Composable: `useShoppingList`

Importpfad: `src/composables/useShoppingList.js`

```javascript
import { useShoppingList } from '@/composables/useShoppingList'
const { lists, items, addItem, toggleItem, /* ... */ } = useShoppingList()
```

### Reaktiver State

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `lists` | `Ref<Array>` | Alle Einkaufslisten (nicht gelöscht) |
| `items` | `Ref<Array>` | Alle Items (nicht gelöscht) |
| `loading` | `Ref<boolean>` | Daten werden geladen |
| `error` | `Ref<string\|null>` | Fehlermeldung (wird nach 3s zurückgesetzt) |
| `isOnline` | `Ref<boolean>` | CouchDB-Server erreichbar |
| `syncActive` | `Ref<boolean>` | Sync läuft gerade |

### Methoden

#### Listen

| Methode | Signatur | Beschreibung |
|---------|----------|--------------|
| `addList` | `(name: string) => Promise` | Neue Liste anlegen |
| `deleteList` | `(list: Object) => Promise` | Liste dauerhaft löschen |

#### Items

| Methode | Signatur | Beschreibung |
|---------|----------|--------------|
| `addItem` | `(listId: string, name: string) => Promise` | Item zu Liste hinzufügen |
| `toggleItem` | `(item: Object) => Promise` | Checked-Status toggeln |
| `markItemDeleted` | `(item: Object) => Promise` | Soft-Delete (sichtbar im Papierkorb) |
| `restoreItem` | `(item: Object) => Promise` | Soft-Delete rückgängig machen |
| `permanentlyDeleteAllMarked` | `(listId: string) => Promise` | Alle Papierkorb-Items endgültig löschen |

#### Abfragen

| Methode | Signatur | Rückgabe |
|---------|----------|----------|
| `getItemsForList` | `(listId: string)` | Alle Items der Liste |
| `getActiveItemsForList` | `(listId: string)` | Items ohne `markedDeleted` |
| `getDeletedItemsForList` | `(listId: string)` | Nur `markedDeleted`-Items |
| `getProgress` | `(listId: string)` | Fortschritt in % (0–100) |
| `hasChangedItems` | `(listId: string)` | `true` wenn Remote-Änderungen vorhanden |

#### Konfliktbehandlung

| Methode | Beschreibung |
|---------|--------------|
| `acceptDelete(item)` | Löschung durch anderen User bestätigen |
| `rejectDelete(item)` | Löschung durch anderen User ablehnen (lokaler Zustand gewinnt) |
| `clearListChanges(listId)` | Alle `_remoteChanged`-Markierungen entfernen |

---

## Composable: `useSession`

Importpfad: `src/composables/useSession.js`

```js
import { useSession } from '@/composables/useSession'
const { sessionName, setSessionName, clearSession } = useSession()
```

| Property/Methode | Beschreibung |
|------------------|--------------|
| `sessionName` | `Ref<string>` – aktueller Benutzername (persisiert in `localStorage`) |
| `setSessionName(name)` | Benutzernamen setzen und in `localStorage` speichern |
| `clearSession()` | Session löschen |

---

## Datenbankschicht: `database.js`

Importpfad: `src/composables/database.js`

Direkte Nutzung nur in `useShoppingList.js`. Folgende Funktionen sind exportiert:

| Funktion | Beschreibung |
|----------|--------------|
| `createDoc(doc)` | Dokument mit generierter `_id` anlegen |
| `getDoc(id)` | Einzelnes Dokument aus IndexedDB lesen |
| `getAllDocs()` | Alle Dokumente aus IndexedDB lesen |
| `updateDoc(id, fn)` | Dokument lesen, per Callback ändern, speichern |
| `hardDeleteDoc(id)` | Dokument aus IndexedDB **und** CouchDB löschen |
| `startSync(onStatus, onConflict, onDataChange)` | Hintergrund-Sync starten (alle 5 Sekunden) |
| `stopSync()` | Hintergrund-Sync stoppen |
| `clearRemoteChangedFlag(docId)` | `_remoteChanged`-Flag entfernen |
| `clearPendingDeleteFlag(docId)` | `_pendingDelete`-Flag entfernen |
| `applyConflictResolution(docId, doc)` | Manuell gewählte Version auf Server pushen |
| `restoreLocalVersion(docId, doc)` | Lokale Version erzwingen |

### Sync-Ablauf

```
startSync()
  ├── checkAndInitialSync()   → bei leerer lokaler DB: einmaliger Pull von Remote
  └── setInterval (5s)
        ├── pushDirtyDocs()   → alle _dirty Docs zu CouchDB hochladen
        └── syncFromRemote()  → _changes feed auswerten, lokale DB aktualisieren
```

---

## Vue-Komponenten

### `SessionSetup.vue`

Wird angezeigt wenn kein `sessionName` gesetzt ist. Ermöglicht dem User, seinen Namen einzugeben. Nutzt `useSession`.

### `ShoppingList.vue`

Hauptkomponente der App. Nutzt `useShoppingList` für alle Daten und Aktionen.

**Funktionen in der UI:**
- Einkaufslisten anzeigen, anlegen, löschen
- Items hinzufügen, abhaken, als gelöscht markieren, wiederherstellen
- Fortschrittsanzeige pro Liste
- Online/Offline-Statusanzeige
- Banner bei `_pendingDelete` (anderer User hat Item gelöscht – Ja/Nein)
- Banner bei `_remoteChanged` (Remote-Änderung eingegangen)

---

## Weiterführende Dokumentation & Tutorials

| Ressource | Link |
|-----------|------|
| CouchDB API Referenz | https://docs.couchdb.org/en/stable/api/index.html |
| CouchDB `_changes` Feed | https://docs.couchdb.org/en/stable/api/database/changes.html |
| Vue 3 Composables | https://vuejs.org/guide/reusability/composables |
| Vue 3 Reactivity | https://vuejs.org/guide/essentials/reactivity-fundamentals |
| Vite Dokumentation | https://vitejs.dev/guide/ |
| Vitest Dokumentation | https://vitest.dev/guide/ |
| IndexedDB API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API |
