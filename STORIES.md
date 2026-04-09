# User Stories & Developer Stories

## Legende
- **SP (Story Points):** Aufwandsschätzung (Min 3, Max 13).
- **Definition of Done:** Eine Story ist erst fertig, wenn der Code funktionstüchtig ist **und** die entsprechenden Tests (Unit/E2E) in der CI-Pipeline bestanden haben.
- **Prio:** Must Have (MH) -> Should Have (SH) -> Nice to Have (N2H).
- **HEAD:** Verantwortliche Person.

## 1. Developer Stories (Technische Basis)

| ID | Description | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D1** | **Projekt-Setup & Git:** Als Entwickler will ich eine saubere Code-Basis inkl. Linter und Git-Workflow aufsetzen, um kollisionsfrei arbeiten zu können. | 3 | AY | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/17) |
| **D2** | **Architektur-Dokumentation:** Als Architekt will ich die Systemarchitektur (Datenmodell, Sync-Logik) dokumentieren, um eine wartbare Basis für zukünftige Features zu haben. | 5 | AY | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/18) |
| **D3** | **Datenbank-Setup:** Als Entwickler will ich die Datenbank (z.B. CouchDB/PouchDB) inkl. Docker-Container bereitstellen, um Daten persistent zu speichern. | 5 | LS | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/19) |
| **D4** | **Deployment-Dokumentation:** Als Entwickler benötige ich eine vollständige Anleitung zum Deployen und Betreiben des Backends, um die Wartbarkeit zu sichern. | 3 | LS | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/20) |
| **D5** | **CI/CD Pipeline:** Als Team wollen wir eine schlanke Pipeline haben, die bei Pushes automatisch baut und testet, um die Qualität zu sichern. | 3 | LS | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/21) |
| **D6** | **Global Deployment:** Als Entwickler will ich das Backend auf einem Cloud-Service hosten, um weltweiten Zugriff zu gewährleisten. | 5 | AY | N2H | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/22) |

## 2. User Stories (Features)

| ID | Description (User Value) | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **U1** | **Listen verwalten (Soft Delete):** Als Benutzer möchte ich Listen erstellen, umbenennen und so löschen, dass sie nur aus der Ansicht entfernt (markiert als gelöscht) werden, damit ich sie bei Bedarf wiederherstellen kann. | 8 | VW | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/23) |
| **U2** | **Artikel verwalten (Soft Delete):** Als Benutzer möchte ich Artikel hinzufügen, abhaken und aus der Liste entfernen (als gelöscht markieren), um sie bei versehentlichem Löschen wiederherstellen zu können. | 8 | VW | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/24) |
| **U3** | **Offline-Nutzung:** Als Benutzer möchte ich die App vollumfänglich ohne Internet nutzen können (lokale DB), ohne dass Fehlermeldungen den Flow stören. | 8 | LS | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/25) |
| **U4** | **Bidirektionale Synchronisation (Up/Down):** Als Benutzer möchte ich, dass meine Daten automatisch im Hintergrund gesendet und empfangen werden, sobald eine Verbindung besteht. | 13 | MN | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/26) |
| **U5** | **Listen Teilen (Sharing):** Als Benutzer möchte ich eine Einkaufsliste per Link/Code mit anderen teilen, um gemeinsam darauf zuzugreifen. | 8 | MN | MH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/27) |
| **U6** | **Login & Registrierung:** Als Benutzer möchte ich mich registrieren und anmelden, um meine privaten Listen vor Fremdzugriff zu schützen. | 8 | MN | SH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/28) |
| **U7** | **Endgültiges Löschen (Papierkorb):** Als Benutzer möchte ich als gelöscht markierte Listen und Artikel endgültig entfernen, um Speicherplatz freizugeben und die Übersicht zu bereinigen. | 5 | NS | SH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/29) |
| **U8** | **Konfliktlösung:** Als Benutzer möchte ich, dass bei gleichzeitiger Bearbeitung Konflikte automatisch per Field-Level Merge gelöst werden (pro Feld gewinnt der letzte Schreiber anhand von Timestamps). Bei Lösch-Konflikten wird der Benutzer per Banner gefragt, ob er die Löschung akzeptieren oder ablehnen möchte. | 3 | MN | SH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/30) |
| **U9** | **User Profil & Einstellungen:** Als Benutzer möchte ich mein Passwort ändern und mich ausloggen können. | 5 | AY | SH | [🟢 Open](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/31) |
| **U10** | **Details & Labels:** Als Benutzer möchte ich Notizen hinzufügen und Artikel mittels Labels/Farben kategorisieren. | 5 | VW | SH | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/32) |
| **U11** | **Modernes UI & Fehler-Feedback:** Als Benutzer möchte ich ein ansprechendes Design (Dark/Light Mode) nutzen und verständliche Fehlermeldungen erhalten, wenn etwas schiefgeht. | 8 | NS | N2H | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/33) |
| **U12** | **Backup & Export:** Als Benutzer möchte ich meine Listen als JSON-Datei exportieren, um eine lokale Sicherung zu haben. | 5 | LS | N2H | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/34) |
| **U13** | **Suche:** Als Benutzer möchte ich in meinen Listen nach spezifischen Artikeln suchen, um Zeit zu sparen. | 3 | NS | N2H | [🔴 Closed](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/35) |
| **U14** | **Filter & Sortierung:** Als Benutzer möchte ich Listen nach Status (offen/erledigt) filtern oder sortieren. | 3 | VW | N2H | [🟢 Open](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/36) |
| **U15** | **Barrierefreiheit (A11y):** Als Benutzer mit Einschränkungen möchte ich die App via Screenreader bedienen können. | 6 | AY | N2H | [🟢 Open](https://github.com/TGM-HIT/syt5-gek1051-mobile-application-codemonkeys/issues/37) |

## Zusammenfassung der Verantwortlichkeiten

Jeder Teilnehmer hat exakt **24 Story Points**.

* **AY (Developer) - 24 SP**
    * *Dev:* Setup (3), Architektur (5), Global Deploy (5).
    * *User:* Profil (8), A11y (3).
* **LS (Technical Architect) - 24 SP**
    * *Dev:* DB Setup (5), Doku (3), CI/CD (3).
    * *User:* Offline Mode (8), Backup (5).
* **VW (Product Owner) - 24 SP**
    * *User:* Listen Mgmt (8), Items Mgmt (8), Details/Labels (5), Filter (3).
* **MN (Developer) - 24 SP**
    * *User:* Full Sync (13), Sharing (8), Konfliktlösung (3).
* **NS (Developer) - 24 SP**
    * *User:* Login/Auth (8), Endgültiges Löschen (5), UI/Error/Darkmode (8), Suche (3).

**Gesamt:** 120 SP
