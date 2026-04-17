# On-the-Run Doku: Umsetzung U9 & U15 mit Copilot

Diese Doku beschreibt kompakt den Umsetzungsweg von **U9 (Profil & Einstellungen)** und **U15 (A11y)** im Projekt – inkl. betroffener Dateien, Entscheidungen und Testabdeckung.

## Ausgangslage

- **U9 Ziel:** Benutzer soll Passwort ändern und sich ausloggen können.
- **U15 Ziel:** UI soll per Tastatur/Screenreader nutzbar sein (Labels, Rollen, Fokus-Handling, Alerts).

## U9 – Profil & Einstellungen

### Was umgesetzt wurde

1. **Profil-Dialog in der Hauptansicht**
   - Neuer Profil-Button im Header öffnet den Dialog.
   - Anzeige des eingeloggten Users.
   - Felder für:
     - aktuelles Passwort
     - neues Passwort
     - Passwort-Bestätigung
   - Lokale Validierung auf Gleichheit der neuen Passwörter.
   - Passwort-Änderung erst möglich, wenn Pflichtfelder ausgefüllt sind.
   - Erfolg/Fehler werden sichtbar im Dialog ausgegeben.

2. **Passwort ändern im Auth-Composable**
   - Verifikation des aktuellen Passworts über `/_session`.
   - Laden des User-Dokuments aus `/_users`.
   - Entfernen sensibler abgeleiteter Hash-Felder vor Update.
   - PUT des aktualisierten User-Dokuments mit neuem Passwort.
   - Klare Fehlermeldungen bei ungültiger Session, falschem Passwort, zu kurzem Passwort, Netzwerkproblemen.

3. **Logout im Profil-Dialog**
   - Benutzer kann direkt im Profil-Dialog ausloggen.
   - Danach Redirect auf `/login`.

### Relevante Dateien (U9)

- `frontend/src/components/ShoppingList.vue`
  - Profil-Button, Profil-Modal, Passwort-Form, Logout aus Modal.
- `frontend/src/composables/useAuth.js`
  - `changePassword(...)`, `logout(...)`, Fehler- und Session-Handling.
- `frontend/src/composables/__tests__/useAuth.test.js`
  - Unit-Tests für Passwortänderung (Erfolg + Fehlpfade).

## U15 – Accessibility (A11y)

### Was umgesetzt wurde

1. **Semantische Bedienelemente & Accessible Names**
   - Interaktive Elemente mit klaren `aria-label`/sichtbaren Labels.
   - Statusbereiche mit `role="status"`/`aria-live`.
   - Fehlermeldungen mit `role="alert"` (assertive).

2. **Dialog-A11y & Tastaturbedienung**
   - Dialoge mit `role="dialog"` und `aria-modal="true"`.
   - Fokusfalle (Tab/Shift+Tab bleibt im Dialog).
   - `Escape` schließt Dialoge.
   - Fokus-Rückgabe auf zuvor fokussiertes Element nach Dialog schließen.

3. **Form-A11y in Login/Register**
   - Zugeordnete Labels (`label for=...` + Input IDs).
   - Passwort-Toggle mit `aria-pressed`/`aria-controls`.
   - Fehlertexte screenreader-freundlich eingebunden.

4. **Nicht nur Farbe als Information**
   - Labels werden nicht nur als Farbdot, sondern auch als Text angezeigt.
   - Damit bleibt Bedeutung auch ohne Farbwahrnehmung erkennbar.

### Relevante Dateien (U15)

- `frontend/src/components/ShoppingList.vue`
  - Aria-Labels, Statusregionen, Dialog-Semantik, Fokus-Handling.
- `frontend/src/components/LabelFilterBar.vue`
  - Toolbar-Semantik und bedienbare Filterbuttons.
- `frontend/src/views/LoginView.vue`
  - A11y-freundliches Login-Formular.
- `frontend/src/views/RegisterView.vue`
  - A11y-freundliches Register-Formular mit Alert-Feedback.
- `frontend/e2e/a11y.spec.js`
  - E2E-A11y-Flows (Keyboard, Dialoge, Accessible Names, Alerts).

## On-the-Run Vorgehensweise mit Copilot

1. **Scope klären**
   - U9 auf Passwortwechsel + Logout eingegrenzt.
   - U15 auf zentrale User-Flows (Auth, Listen, Dialoge, Items, Label-Filter) fokussiert.

2. **Codepfade identifizieren**
   - UI-Schicht (`ShoppingList.vue`, Auth-Views).
   - Logikschicht (`useAuth.js`).
   - Testschicht (Unit + E2E).

3. **Schrittweise implementieren**
   - Zuerst U9-Flow (Dialog/Passwortwechsel/Logout),
   - danach A11y-Verbesserungen (ARIA, Fokus, Keyboard, Alerts).

4. **Testen & absichern**
   - Unit-Tests für Auth-Logik (inkl. `changePassword`).
   - E2E-Tests für A11y-Verhalten und Tastatur-Flows.

## Ergebnis

- **U9 funktional umgesetzt** (Passwort ändern + Logout im Profil).
- **U15 substanziell umgesetzt** (A11y in Auth, Dialogen, Listeninteraktion, Label-Filter, Feedback).
- Umsetzungsstand ist in Code + Tests nachvollziehbar dokumentiert.
