# User Stories

## Legende

- **SP** Ein Storypoint entspricht einer Pomodoro Einheit von 40 Minuten.
- **HEAD** Die Verantwortung einer Userstory wird von dieser Person übernommen. Die Tests sollten von einem anderen Teammitglied überprüft werden.
- **Prio** Es muss jeweils mindestens eine *Must Have (MH)*, *Should Have (SH)* und *Nice to have (N2H)* Userstory geben.
- **Status** Der Status wird durch die Abarbeitung der Tasks in z.B. GitHub Issues abgebildet. Hier ist nur die Verlinkung dorthin.

## Auflistung

| ID | Description | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Entwickler will ich die Entwicklungsumgebung und das Git-Repository einrichten, um eine gemeinsame Arbeitsbasis zu haben. | 3 | DEV3 | MH | [Status](#issue-1) |
| 2 | Als Technical Architect will ich die Systemarchitektur (Sync & Datenmodell) in der TechDoc definieren, um Planungsfehler zu vermeiden. | 5 | DEV3 | MH | [Status](#issue-2) |
| 3 | Als Technical Architect will ich die Datenbank (CouchDB) via Docker bereitstellen, um die Persistenzschicht zu sichern. | 5 | LS | MH | [Status](#issue-3) |
| 4 | Als Benutzer will ich mich registrieren und anmelden (Auth), um meine Listen geschützt zu verwalten. | 5 | DEV1 | MH | [Status](#issue-4) |
| 5 | Als Product Owner will ich Einkaufslisten erstellen, umbenennen und löschen, um meine Planung zu strukturieren. | 5 | VW | MH | [Status](#issue-5) |
| 6 | Als Product Owner will ich Artikel hinzufügen und abhaken, um den Status des Einkaufs zu sehen. | 5 | VW | MH | [Status](#issue-6) |
| 7 | Als Technical Architect will ich die Offline-First Logik (lokale DB) implementieren, damit die App ohne Netz funktioniert. | 8 | LS | MH | [Status](#issue-7) |
| 8 | Als Entwickler will ich den Upstream-Sync (Client -> Server) realisieren, damit lokale Änderungen gesichert werden. | 8 | DEV1 | MH | [Status](#issue-8) |
| 9 | Als Entwickler will ich den Downstream-Sync (Server -> Client) realisieren, um Änderungen anderer Geräte zu empfangen. | 8 | DEV2 | MH | [Status](#issue-9) |
| 10 | Als Product Owner will ich Listen per Link teilen ("Sharing"), um kollaborativ einzukaufen. | 5 | DEV2 | MH | [Status](#issue-10) |
| 11 | Als Entwickler will ich Konfliktlösungsstrategien (z.B. Last-Write-Wins) implementieren, um Dateninkonsistenzen zu verhindern. | 8 | DEV2 | SH | [Status](#issue-11) |
| 12 | Als Entwickler will ich End-to-End Tests (Cypress) für die Haupt-Flows schreiben, um Regressionen zu vermeiden. | 8 | DEV3 | SH | [Status](#issue-12) |
| 13 | Als Entwickler will ich Unit-Tests für die Sync-Logik schreiben, um die Stabilität der Übertragung zu gewährleisten. | 5 | DEV1 | SH | [Status](#issue-13) |
| 14 | Als Technical Architect will ich eine CI/CD Pipeline einrichten, die Tests und Linter bei jedem Push ausführt. | 3 | LS | SH | [Status](#issue-14) |
| 15 | Als Product Owner will ich Labels (Kategorien) zu Artikeln hinzufügen, um die Übersichtlichkeit zu steigern. | 3 | VW | N2H | [Status](#issue-15) |
| 16 | Als Product Owner will ich Notizen zu Artikeln erfassen, um Details wie Marken oder Menge festzuhalten. | 2 | VW | SH | [Status](#issue-16) |
| 17 | Als Entwickler will ich ein Einstellungs-Menü (User Profile, Logout) implementieren, um Account-Daten zu verwalten. | 5 | VW | SH | [Status](#issue-17) |
| 18 | Als Entwickler will ich Validierungen und Error-Handling (Toasts/Snackbars) einbauen, um dem User Feedback zu geben. | 3 | DEV2 | SH | [Status](#issue-18) |
| 19 | Als Entwickler will ich das Backend global deployen (z.B. Cloud), damit der Sync weltweit erreichbar ist. | 5 | DEV3 | N2H | [Status](#issue-19) |
| 20 | Als Entwickler will ich eine Backup/Export-Funktion für Listen implementieren (JSON Download), um Datenverlust vorzubeugen. | 5 | LS | N2H | [Status](#issue-20) |
| 21 | Als Technical Architect will ich die API-Dokumentation und Deployment-Guides finalisieren, um die Wartbarkeit zu sichern. | 3 | LS | MH | [Status](#issue-21) |
| 22 | Als Entwickler will ich einen Dark Mode implementieren, um die Barrierefreiheit und Ästhetik zu verbessern. | 3 | DEV1 | N2H | [Status](#issue-22) |
| 23 | Als Entwickler will ich UI-Animationen (Micro-Interactions) einbauen, um die App moderner wirken zu lassen. | 3 | DEV1 | N2H | [Status](#issue-23) |
| 24 | Als Entwickler will ich Accessibility-Checks (a11y) durchführen und fixen, damit die App für alle nutzbar ist. | 3 | DEV3 | N2H | [Status](#issue-24) |
| 25 | Als Product Owner will ich Listen filtern und sortieren (z.B. nach Alphabet oder Status), um schneller Artikel zu finden. | 2 | VW | N2H | [Status](#issue-25) |
| 26 | Als Product Owner will ich eine Suchfunktion innerhalb von Listen bereitstellen, um die Navigation zu beschleunigen. | 2 | VW | N2H | [Status](#issue-26) |

## Zusammenfassung

*Jeder Teilnehmer hat exakt 24 SP und mindestens 2 Must-Haves (MH).*

* **VW (Product Owner):** 24 SP
  * *Must Haves (10 SP):* Listen erstellen (#5), Items hinzufügen (#6).
  * *Tasks:* UI-Logik wie Settings, Labels, Notizen, Filter, Suche.
* **LS (Technical Architect):** 24 SP
  * *Must Haves (16 SP):* DB Setup (#3), Offline-Logik (#7), Doku (#21).
  * *Tasks:* Infrastruktur, CI/CD, Backup-Feature.
* **DEV1:** 24 SP
  * *Must Haves (13 SP):* Auth/Login (#4), Upstream Sync (#8).
  * *Tasks:* Unit Tests, Dark Mode, Animationen.
* **DEV2:** 24 SP
  * *Must Haves (13 SP):* Downstream Sync (#9), Sharing (#10).
  * *Tasks:* Konfliktlösung, Error-Handling & Validierung.
* **DEV3:** 24 SP
  * *Must Haves (8 SP):* Setup (#1), Architektur-Definition (#2).
  * *Tasks:* E2E Tests, Global Deployment, Accessibility.

**Gesamt:** 120 SP
