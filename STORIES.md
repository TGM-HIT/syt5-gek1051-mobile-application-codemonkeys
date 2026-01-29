# User Stories

## Legende

- **SP** Ein Storypoint entspricht einer Pomodoro Einheit von 40 Minuten.
- **HEAD** Die Verantwortung einer Userstory wird von dieser Person übernommen. Die Tests sollten von einem anderen Teammitglied überprüft werden.
- **Prio** Es muss jeweils mindestens eine *Must Have (MH)*, *Should Have (SH)* und *Nice to have (N2H)* Userstory geben.
- **Status** Der Status wird durch die Abarbeitung der Tasks in z.B. GitHub Issues abgebildet. Hier ist nur die Verlinkung dorthin.

## Auflistung

| ID | Description | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Entwickler will ich die Entwicklungsumgebung und das Git-Repo einrichten, um eine gemeinsame Basis für das Team zu schaffen. | 3 | DEV3 | MH | [Status](#issue-1) |
| 2 | Als Technical Architect will ich die Systemarchitektur (Sync-Strategie & Datenmodell) in der TechDoc definieren, um technische Schulden zu vermeiden. | 5 | LS | MH | [Status](#issue-2) |
| 3 | Als Technical Architect will ich die Datenbank (CouchDB/PouchDB) inkl. Docker-Container aufsetzen, um die Persistenzschicht bereitzustellen. | 5 | LS | MH | [Status](#issue-3) |
| 4 | Als Benutzer will ich mich registrieren und anmelden, damit meine Listen sicher und personalisiert gespeichert werden. | 5 | DEV2 | MH | [Status](#issue-4) |
| 5 | Als Product Owner will ich die Funktionalität implementieren, Einkaufslisten zu erstellen und zu verwalten, da dies der Kernnutzen der App ist. | 5 | VW | MH | [Status](#issue-5) |
| 6 | Als Benutzer will ich Artikel zu einer Liste hinzufügen und abhaken, um meinen Einkaufstatus zu verfolgen. | 5 | DEV3 | MH | [Status](#issue-6) |
| 7 | Als Technical Architect will ich die lokale Datenhaltung (Offline-First) implementieren, damit die App auch ohne Netzverbindung nutzbar bleibt. | 8 | LS | MH | [Status](#issue-7) |
| 8 | Als Entwickler will ich den Upstream-Sync (Client zu Server) realisieren, damit lokale Änderungen gesichert werden. | 8 | DEV1 | MH | [Status](#issue-8) |
| 9 | Als Entwickler will ich den Downstream-Sync (Server zu Client) realisieren, damit Änderungen anderer Geräte empfangen werden. | 8 | DEV2 | MH | [Status](#issue-9) |
| 10 | Als Product Owner will ich eine "Teilen"-Funktion (via Link/ID) programmieren, um die virale Verbreitung der App zu fördern. | 5 | VW | MH | [Status](#issue-10) |
| 11 | Als Entwickler will ich Konfliktlösungsstrategien (z.B. Last-Write-Wins) implementieren, um Dateninkonsistenzen zu verhindern. | 8 | DEV3 | SH | [Status](#issue-11) |
| 12 | Als Entwickler will ich End-to-End Tests (Cypress/Maestro) schreiben, um die User-Flows automatisiert zu verifizieren. | 8 | DEV1 | SH | [Status](#issue-12) |
| 13 | Als Entwickler will ich Unit-Tests für die Synchronisationslogik schreiben, um die Stabilität des Datenaustauschs zu sichern. | 5 | DEV2 | SH | [Status](#issue-13) |
| 14 | Als Technical Architect will ich eine CI/CD Pipeline einrichten, die bei jedem Push Linter und Tests ausführt. | 5 | LS | SH | [Status](#issue-14) |
| 15 | Als Product Owner will ich Labels für Artikel (z.B. Farben für Kategorien) implementieren, um die UX zu verbessern. | 3 | VW | N2H | [Status](#issue-15) |
| 16 | Als Product Owner will ich Notizen zu Artikeln hinzufügen können, um den Informationsgehalt der Listen zu erhöhen. | 2 | VW | SH | [Status](#issue-16) |
| 17 | Als Frontend-Entwickler will ich Feedback-Animationen (z.B. beim Abhaken) einbauen, um die App "snappy" wirken zu lassen. | 3 | DEV1 | N2H | [Status](#issue-17) |
| 18 | Als Product Owner will ich Filterfunktionen (erledigt/offen) einbauen, um die Übersichtlichkeit für den User zu steigern. | 2 | VW | N2H | [Status](#issue-18) |
| 19 | Als Entwickler will ich das Backend global deployen (Cloud/Server), damit der Sync weltweit funktioniert. | 4 | DEV3 | N2H | [Status](#issue-19) |
| 20 | Als Product Owner will ich eine Suchfunktion innerhalb der Listen implementieren, um die Usability bei langen Listen zu sichern. | 2 | VW | N2H | [Status](#issue-20) |

## Zusammenfassung

*Arbeitsverteilung basierend auf 96 Gesamt-SPs:*

* **VW (Project Owner):** 19 SP
  * *Fokus:* Business Features & User Experience (Listen-Logik, Sharing, Labels, Suche, Filter).
* **LS (Technical Architect):** 23 SP
  * *Fokus:* Infrastruktur, Core-Architecture & DevOps (Datenbank, Offline-Logik, CI/CD, TechDoc).
* **DEV1:** 19 SP
  * *Fokus:* Sync-Integration & Testing (Upstream Sync, E2E Tests, UI-Animationen).
* **DEV2:** 18 SP
  * *Fokus:* Auth & Data Consistency (Login/Register, Downstream Sync, Unit Tests).
* **DEV3:** 17 SP
  * *Fokus:* Backend & Logic (Items, Setup, Konfliktlösung, Deployment).

**Gesamt:** 96 SP
