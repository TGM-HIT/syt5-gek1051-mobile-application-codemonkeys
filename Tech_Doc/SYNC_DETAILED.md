# Synchronisation und Konfliktmanagement – Vollständige, Schritt-für-Schritt-Erklärung

## Ziel dieser Doku
Diese Dokumentation erklärt die Synchronisation und Konfliktbehandlung so detailliert, dass auch Personen ohne Programmierkenntnisse den Ablauf und die Logik nachvollziehen können. Jeder Schritt, jede Entscheidung und jeder Spezialfall wird erläutert – von der ersten Änderung bis zur endgültigen Synchronisation zwischen mehreren Geräten und Benutzern.

---

## 1. Was ist Synchronisation in diesem Projekt?

Synchronisation bedeutet, dass alle Änderungen, die ein Benutzer an seiner Einkaufsliste macht (z.B. Artikel hinzufügen, abhaken, löschen), automatisch auf allen anderen Geräten und bei allen anderen Benutzern erscheinen – egal, ob sie gerade online oder offline sind. Die Daten werden lokal im Browser gespeichert (IndexedDB) und regelmäßig mit einer zentralen Datenbank im Internet (CouchDB) abgeglichen.

---

## 2. Wie werden Daten gespeichert?

- **Lokal:** Im Browser jedes Benutzers gibt es eine eigene kleine Datenbank (IndexedDB). Hier werden alle Listen und Artikel gespeichert, auch wenn der Benutzer offline ist.
- **Zentral:** Es gibt eine zentrale Datenbank (CouchDB), die alle Daten von allen Benutzern sammelt. Sie ist über das Internet erreichbar.
- **Jedes Dokument** (also jede Liste und jeder Artikel) hat eine eindeutige ID, einen Typ ("list" oder "item"), eine Session-Zuordnung, die eigentlichen Datenfelder (z.B. Name, erledigt, gelöscht) und ein spezielles Feld `fieldTimestamps`, das für jedes Datenfeld den Zeitpunkt der letzten Änderung speichert.

---

## 3. Was passiert, wenn ein Benutzer etwas ändert?

- Sobald ein Benutzer eine Änderung macht (z.B. einen Artikel abhakt), wird diese Änderung **sofort lokal** gespeichert und das Dokument als "geändert" markiert (`_dirty`).
- Die Änderung ist damit sofort sichtbar, auch wenn der Benutzer offline ist.
- Im Hintergrund läuft regelmäßig (alle 5 Sekunden) ein Prozess, der versucht, alle lokalen Änderungen an die zentrale Datenbank zu senden.

---

## 4. Wie läuft die Synchronisation ab? Schritt für Schritt

### 4.1 Initialisierung
- Beim ersten Start prüft das System, ob die lokale Datenbank leer ist.
- Falls ja, werden alle Daten aus der zentralen Datenbank geladen und lokal gespeichert.

### 4.2 Regelmäßiger Abgleich (alle 5 Sekunden)
1. **Lokale Änderungen hochladen:**
   - Alle als `_dirty` markierten Dokumente werden an die zentrale Datenbank gesendet.
   - Nach erfolgreichem Upload wird `_dirty` entfernt.
   - Falls es einen Konflikt gibt (z.B. weil ein anderer Benutzer das gleiche Dokument geändert hat), wird die Konfliktbehandlung gestartet (siehe unten).
2. **Zentrale Änderungen herunterladen:**
   - Das System fragt die zentrale Datenbank, ob es neue oder geänderte Dokumente gibt.
   - Neue oder geänderte Dokumente werden lokal gespeichert.
   - Falls es einen Konflikt gibt, wird auch hier die Konfliktbehandlung gestartet.

---

## 5. Was ist ein Konflikt und wie wird er erkannt?

Ein Konflikt entsteht, wenn zwei oder mehr Benutzer **gleichzeitig** (oder im Offline-Modus) das gleiche Dokument ändern. Beispiele:
- Benutzer A markiert einen Artikel als erledigt, während Benutzer B denselben Artikel löscht.
- Benutzer A ändert den Namen einer Liste, während Benutzer B einen Artikel in dieser Liste hinzufügt.

Das System erkennt einen Konflikt, wenn beim Versuch, eine Änderung an die zentrale Datenbank zu senden, die Daten dort bereits anders aussehen als lokal (HTTP-Fehler 409, "Conflict").

---

## 6. Wie werden Konflikte gelöst? (Schritt für Schritt)

### 6.1 Löschkonflikt (z.B. erledigt vs. gelöscht)
- **Fall 1:** Die zentrale Datenbank meldet, dass das Dokument als gelöscht markiert ist, aber lokal ist es noch vorhanden.
  - Das System markiert das lokale Dokument mit `_pendingDelete`.
  - Im Benutzer-Interface erscheint ein Hinweis: "Ein anderer Benutzer hat diesen Artikel gelöscht. Möchtest du die Löschung akzeptieren oder deine Änderung behalten?"
  - Der Benutzer entscheidet:
    - **Akzeptieren:** Das Dokument wird endgültig gelöscht.
    - **Ablehnen:** Die lokale Version wird erneut an die zentrale Datenbank gesendet und überschreibt die Löschung.
- **Fall 2:** Lokal gelöscht, aber zentral nicht.
  - Die lokale Löschung wird an die zentrale Datenbank gesendet und überschreibt die zentrale Version.

### 6.2 Andere Konflikte (z.B. zwei Benutzer ändern verschiedene Felder)
- Das System vergleicht für jedes Datenfeld den Zeitpunkt der letzten Änderung (`fieldTimestamps`).
- Felder, die nur lokal geändert wurden, werden übernommen.
- Felder, die nur zentral geändert wurden, werden übernommen.
- Gibt es Felder, die sowohl lokal als auch zentral geändert wurden, entscheidet der jeweils neuere Zeitstempel.
- Das Ergebnis ist ein "gemischtes" Dokument, das die neuesten Änderungen aus beiden Versionen enthält.

### 6.3 Remote-Änderungen
- Wenn ein Dokument zentral geändert wurde und lokal eine andere Änderung existiert, wird das Dokument mit `_remoteChanged` markiert.
- Im Benutzer-Interface erscheint ein Hinweis: "Ein anderer Benutzer hat dieses Dokument geändert. Möchtest du die Änderung übernehmen oder deine Version behalten?"
- Der Benutzer entscheidet, welche Version übernommen wird.

---

## 7. Beispiel: Drei Personen, ein Artikel (detailliert)

### Ausgangslage
- Artikel: `done: false`, `markedDeleted: false`, Timestamps: `done: 1000`, `markedDeleted: 1000`

### Aktionen
- **Benutzer A (offline):** Markiert Artikel als erledigt (`done: true`, Timestamp: 2000)
- **Benutzer B (online):** Löscht Artikel (`markedDeleted: true`, Timestamp: 3000)
- **Benutzer C (online):** Ändert den Namen (`name: "Milch 3,5%"`, Timestamp: 4000)

### Synchronisation
1. Benutzer B und C synchronisieren sofort mit der zentralen Datenbank. CouchDB enthält jetzt:
   - `markedDeleted: true` (3000)
   - `name: "Milch 3,5%"` (4000)
2. Benutzer A kommt online, synchronisiert:
   - Beim Versuch, seine Änderung hochzuladen, erkennt das System einen Konflikt (409).
   - Die Funktion `resolveConflict` prüft:
     - Ist das Dokument zentral gelöscht, aber lokal nicht? → Das lokale Dokument wird mit `_pendingDelete` markiert. Benutzer A muss im UI entscheiden!
     - Ist das Dokument lokal gelöscht, aber zentral nicht? → Die lokale Löschung wird an die zentrale Datenbank gesendet.
     - Sonst: Felder, die nur lokal existieren, werden übernommen.
3. Benutzer A sieht einen Hinweis und muss entscheiden, ob er die Löschung akzeptiert oder seine Änderung durchsetzen will.
4. Erst nach der Entscheidung wird synchronisiert.

---

## 8. Was passiert bei Löschungen und Wiederherstellung?
- Löschungen sind "soft": Das Dokument bleibt erhalten, aber das Feld `markedDeleted` wird auf `true` gesetzt.
- Wird eine Löschung abgelehnt, wird das Feld `markedDeleted` wieder auf `false` gesetzt und der Zeitstempel aktualisiert.
- Die Wiederherstellung wird wie jede andere Änderung synchronisiert.

---

## 9. Technische Besonderheiten und Fehlerbehandlung
- **Offline-Fähigkeit:** Alle Änderungen werden lokal gespeichert und bei nächster Gelegenheit synchronisiert.
- **Session-Handling:** Jede Liste/Artikel ist einer Session zugeordnet. Die Session-ID steuert, welche Daten synchronisiert werden.
- **Export/Import:** Listen können als JSON exportiert/importiert werden. Auch hier werden Timestamps und Konfliktlogik beachtet.
- **Fehlerbehandlung:** Bei Netzwerkfehlern oder Auth-Problemen werden Sync-Versuche wiederholt. Das System gibt dem Benutzer Rückmeldung, ob es online oder offline ist.

---

## 10. Zusammenfassung (für Nicht-Programmierer)
- Jede Änderung wird sofort lokal gespeichert und regelmäßig mit der zentralen Datenbank abgeglichen.
- Konflikte werden automatisch erkannt und – wenn nötig – dem Benutzer zur Entscheidung vorgelegt.
- Das System sorgt dafür, dass keine Änderung verloren geht und alle Benutzer immer den aktuellen Stand sehen, sobald sie online sind.
- Die gesamte Logik ist in `frontend/src/composables/database.js` implementiert.

---

## 11. Weiterführende Hinweise
- Für Details siehe die Funktionen `resolveConflict`, `pushDirtyDocs`, `syncFromRemote`, `applyConflictResolution` in `database.js`.
- Die genaue UI-Interaktion bei Konflikten ist in den Komponenten (z.B. `ShoppingList.vue`) umgesetzt.
- Die Authentifizierung und Session-Verwaltung erfolgt über die Composables `useSession.js` und `useShoppingList.js`.

---

## 12. Glossar (Begriffe einfach erklärt)
- **IndexedDB:** Die lokale Datenbank im Browser, speichert alle Daten offline.
- **CouchDB:** Die zentrale Datenbank im Internet, sammelt alle Daten von allen Benutzern.
- **Session:** Ein gemeinsamer Arbeitsbereich (z.B. eine Einkaufsliste), den mehrere Benutzer teilen können.
- **_dirty:** Markiert ein Dokument als lokal geändert, aber noch nicht synchronisiert.
- **_pendingDelete:** Markiert ein Dokument, bei dem ein Löschkonflikt besteht und der Benutzer entscheiden muss.
- **fieldTimestamps:** Speichert für jedes Feld, wann es zuletzt geändert wurde.
- **Konflikt:** Zwei Benutzer ändern gleichzeitig das gleiche Dokument.
- **Merge:** Das Zusammenführen von Änderungen aus mehreren Versionen eines Dokuments.
- **Soft Delete:** Das Dokument bleibt erhalten, wird aber als gelöscht markiert.
