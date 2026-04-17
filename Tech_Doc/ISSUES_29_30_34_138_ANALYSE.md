# Detaillierte Code-Analyse zu Issues #29, #30, #34, #138

Diese Analyse basiert auf dem aktuellen Repository-Stand und der Zuordnung in [`STORIES.md`](../STORIES.md#L30-L44):
- [#29 – U7 Endgültiges Löschen](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/29)
- [#30 – U8 Konfliktlösung](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/30)
- [#34 – U12 Backup & Export](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/34)
- [#138 – U16 PWA & Push-Benachrichtigungen](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/138)

---

## Issue #29 / U7 – Endgültiges Löschen (Papierkorb)

## Ist-Stand
**Weitgehend umgesetzt für Artikel, eingeschränkt für Listen.**

1. **Soft-Delete für Artikel**: Artikel werden zuerst nur als `markedDeleted: true` markiert.
2. **Papierkorb-Tab pro Liste**: Gelöschte Artikel werden separat angezeigt, inkl. Restore.
3. **Endgültiges Löschen**: Button "Alle endgültig löschen" löscht alle `markedDeleted`-Artikel physisch.
4. **Listenlöschung**: Listen werden **hart gelöscht**, aber nur wenn sie keine Artikel mehr enthalten.

## Technischer Ablauf im Code
1. Artikel löschen in UI triggert Soft-Delete (`markItemDeleted`).
2. Im "Gelöscht"-Tab kann der User:
   - einzelne Artikel wiederherstellen (`restoreItem`)
   - alle gelöschten Artikel einer Liste endgültig löschen (`permanentlyDeleteAllMarked`)
3. Für jede endgültige Löschung wird `hardDeleteDoc` verwendet (lokal + remote DELETE mit `_rev`).
4. Eine Liste kann nur gelöscht werden, wenn `getItemsForList(list._id).length === 0`; sonst blockiert ein Hinweis.

## Wichtige Code-Referenzen
- Soft-Delete / Restore / Permanent Delete:
  - [`useShoppingList.js#L388-L443`](../frontend/src/composables/useShoppingList.js#L388-L443)
  - [`useShoppingList.js#L419-L425`](../frontend/src/composables/useShoppingList.js#L419-L425)
- Listen hart löschen:
  - [`useShoppingList.js#L143-L151`](../frontend/src/composables/useShoppingList.js#L143-L151)
  - [`database.js#L623-L658`](../frontend/src/composables/database.js#L623-L658)
- UI (Tabs, Restore, "Alle endgültig löschen", Listenlösch-Blockade):
  - [`ShoppingList.vue#L989-L1001`](../frontend/src/components/ShoppingList.vue#L989-L1001)
  - [`ShoppingList.vue#L1212-L1245`](../frontend/src/components/ShoppingList.vue#L1212-L1245)
  - [`ShoppingList.vue#L491-L503`](../frontend/src/components/ShoppingList.vue#L491-L503)

## Testabdeckung
- Unit:
  - [`useShoppingList.test.js#L506-L559`](../frontend/src/composables/__tests__/useShoppingList.test.js#L506-L559)
  - [`useShoppingList.test.js#L458-L469`](../frontend/src/composables/__tests__/useShoppingList.test.js#L458-L469)
- E2E (Listenlösch-Dialog/Flow):
  - [`shopping-list.spec.js#L384-L418`](../frontend/e2e/shopping-list.spec.js#L384-L418)

## Präzise Einschränkung
- Die Formulierung "Listen im Papierkorb" ist im Code so **nicht** umgesetzt: Es gibt einen Papierkorb-Tab für **Artikel**, nicht für Listen.  
  Listen werden direkt hart gelöscht, nachdem sie leer sind.

---

## Issue #30 / U8 – Konfliktlösung

## Ist-Stand
**Teilweise umgesetzt.**

1. **Lösch-Konflikt mit Benutzerentscheidung (Banner):** umgesetzt.
2. **Auto-Merge für andere Konflikte:** vorhanden, aber Logik entspricht **nicht vollständig** "pro Feld gewinnt letzter Schreiber anhand Timestamp".

## Konfliktlogik im Detail
Bei 409 im Sync (`syncToRemote`) wird `resolveConflict()` aufgerufen:

1. **Fall 1**: Remote hat `markedDeleted=true`, lokal nicht  
   → lokal wird nicht überschrieben, stattdessen `_pendingDelete` gesetzt (Banner in UI).
2. **Fall 2**: Lokal `markedDeleted=true`, remote nicht  
   → lokale Löschung wird mit aktueller Remote-`_rev` hochgeladen.
3. **Fall 3**: Sonstige Konflikte  
   → Startet mit `currentRemote`, übernimmt lokale Felder nur wenn `localTimestamps[key]` gesetzt **und** `remoteTimestamps[key]` fehlt.

## Wichtige Code-Referenzen
- 409-Handling / Resolve-Aufruf:
  - [`database.js#L331-L389`](../frontend/src/composables/database.js#L331-L389)
- Konfliktfälle 1–3:
  - [`database.js#L395-L485`](../frontend/src/composables/database.js#L395-L485)
- `_pendingDelete` auch beim Pull aus `_changes`:
  - [`database.js#L180-L199`](../frontend/src/composables/database.js#L180-L199)
- User-Entscheidung (Ja/Nein) im Composable:
  - [`useShoppingList.js#L609-L647`](../frontend/src/composables/useShoppingList.js#L609-L647)
- Banner-UI:
  - [`ShoppingList.vue#L1186-L1206`](../frontend/src/components/ShoppingList.vue#L1186-L1206)

## Testabdeckung
- Konfliktfälle in DB-Tests:
  - [`database.test.js#L664-L803`](../frontend/src/composables/__tests__/database.test.js#L664-L803)
- Accept/Reject-Flow:
  - [`useShoppingList.test.js#L584-L617`](../frontend/src/composables/__tests__/useShoppingList.test.js#L584-L617)

## Präzise Abweichung zur Story-Beschreibung
- In der Story steht "letzter Schreiber pro Feld anhand Timestamps".  
  In der aktuellen Implementierung fehlt der direkte Timestamp-Vergleich `local > remote`.  
  Der Code übernimmt lokal nur, wenn remote für das Feld **keinen** Timestamp hat (`!remoteTimestamps[key]`), siehe [`database.js#L454-L459`](../frontend/src/composables/database.js#L454-L459).

---

## Issue #34 / U12 – Backup & Export

## Ist-Stand
**Umgesetzt (Export + Import).**

1. Pro Liste gibt es einen Backup-Button (💾) für JSON-Export.
2. Export enthält Metadaten (`exportedAt`, `exportedBy`) + Liste + gefilterte Listen-Items.
3. Import im Profildialog lädt JSON, erstellt neue Liste `"(Backup)"` und importiert Items.
4. Fehlerhafte JSON/Struktur wird abgefangen und als UI-Fehler angezeigt.

## Technischer Ablauf
1. Klick auf 💾 ruft `exportBackup(listId)` auf.
2. Es wird ein JSON-Payload gebaut und per Blob/Anchor als Datei heruntergeladen.
3. Import (`handleImportFile`) liest Datei, parsed JSON, ruft `importBackup(payload)`.
4. `importBackup` validiert Basisstruktur, erstellt neue Liste und dann zugehörige Item-Dokumente.

## Wichtige Code-Referenzen
- Export/Import Logik:
  - [`useShoppingList.js#L714-L778`](../frontend/src/composables/useShoppingList.js#L714-L778)
- Export-Button in Listenansicht:
  - [`ShoppingList.vue#L933-L940`](../frontend/src/components/ShoppingList.vue#L933-L940)
- Import-Handler:
  - [`ShoppingList.vue#L392-L405`](../frontend/src/components/ShoppingList.vue#L392-L405)
- Datei-Input im Profildialog:
  - [`ShoppingList.vue#L1405-L1416`](../frontend/src/components/ShoppingList.vue#L1405-L1416)

## Testabdeckung
- Unit (Export + JSON-Inhalt + Import + Fehlerfälle):
  - [`backup.test.js#L105-L170`](../frontend/src/composables/__tests__/backup.test.js#L105-L170)
  - [`backup.test.js#L189-L265`](../frontend/src/composables/__tests__/backup.test.js#L189-L265)
  - [`backup.test.js#L272-L362`](../frontend/src/composables/__tests__/backup.test.js#L272-L362)
- E2E:
  - [`backup.spec.js#L64-L171`](../frontend/e2e/backup.spec.js#L64-L171)
  - [`backup.spec.js#L175-L271`](../frontend/e2e/backup.spec.js#L175-L271)

## Wichtige Detailbeobachtung
- Export enthält bewusst **keine internen DB-Felder** wie `_id`, `_rev`, `type`, `list_id` (durch Mapping beim Export), siehe [`useShoppingList.js#L725-L733`](../frontend/src/composables/useShoppingList.js#L725-L733).

---

## Issue #138 / U16 – PWA & Push-Benachrichtigungen

## Ist-Stand
**Teilweise umgesetzt (PWA + lokale/System-Notifications), echter Web-Push-Hintergrundbetrieb nicht vollständig umgesetzt.**

### Umgesetzt
1. **PWA-Basis**: Manifest + Workbox-Konfiguration via `vite-plugin-pwa`.
2. **Install-Flow in UI**: `beforeinstallprompt`, Install-Button, `appinstalled` Handling.
3. **Notification Permission + Toggle** in der App.
4. **Systemnachrichten bei Sync-Änderungen** über `serviceWorker.ready.showNotification(...)` mit Fallback auf `new Notification(...)`.
5. **In-App Notification-Gruppierung** nach Liste/Kategorie (`added`, `modified`, `deleted`) inkl. Dedup.

### Wichtige Einschränkung (für "auch im Hintergrund")
- Die Notification-Erzeugung hängt am laufenden App-Sync-Callback (`initSync` → `generateNotifications`).  
- Es gibt im Source keine Web-Push-Subscription-Verwaltung (`PushManager`/Subscription-Flow) und keinen Push-Event-Handler-Code in einer eigenen SW-Datei.  
- Damit ist "immer Benachrichtigungen bei komplett geschlossener App" im klassischen Web-Push-Sinn aktuell nicht nachweisbar umgesetzt.

## Wichtige Code-Referenzen
- PWA-Konfiguration:
  - [`vite.config.js#L15-L69`](../frontend/vite.config.js#L15-L69)
- Install-Events + Install-Button:
  - [`ShoppingList.vue#L78-L101`](../frontend/src/components/ShoppingList.vue#L78-L101)
  - [`ShoppingList.vue#L673-L683`](../frontend/src/components/ShoppingList.vue#L673-L683)
- Permission / Toggle UI:
  - [`ShoppingList.vue#L642-L672`](../frontend/src/components/ShoppingList.vue#L642-L672)
- Notification-API, OS-Notification, Gruppierung:
  - [`useShoppingList.js#L472-L579`](../frontend/src/composables/useShoppingList.js#L472-L579)
- Trigger bei Sync-Datenänderung:
  - [`useShoppingList.js#L240-L259`](../frontend/src/composables/useShoppingList.js#L240-L259)

## Testabdeckung
- Notification-Toggle/Verhalten:
  - [`notifications-toggle.test.js#L91-L156`](../frontend/src/composables/__tests__/notifications-toggle.test.js#L91-L156)
- PWA-/Notification-Logik (Unit):
  - [`pwa-notifications.test.js#L159-L248`](../frontend/src/composables/__tests__/pwa-notifications.test.js#L159-L248)
  - [`pwa-notifications.test.js#L349-L412`](../frontend/src/composables/__tests__/pwa-notifications.test.js#L349-L412)
  - [`pwa-notifications.test.js#L417-L520`](../frontend/src/composables/__tests__/pwa-notifications.test.js#L417-L520)
- Header/PWA-UI (E2E):
  - [`notifications.spec.js#L99-L195`](../frontend/e2e/notifications.spec.js#L99-L195)

