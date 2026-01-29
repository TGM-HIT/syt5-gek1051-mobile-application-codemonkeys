# User Stories

## Legende

- **SP** Ein Storypoint entspricht einer Pomodoro Einheit von 40 Minuten.
- **HEAD** Die Verantwortung einer Userstory wird von dieser Person übernommen. Die Tests sollten von einem anderen Teammitglied überprüft werden.
- **Prio** Es muss jeweils mindestens eine *Must Have (MH)*, *Should Have (SH)* und *Nice to have (N2H)* Userstory geben.
- **Status** Der Status wird durch die Abarbeitung der Tasks in z.B. GitHub Issues abgebildet. Hier ist nur die Verlinkung dorthin.

## Auflistung

| ID | Description | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Entwickler will ich die Entwicklungsumgebung (Flutter/Vue & Backend) aufsetzen und das Git-Repo einrichten, um mit der Arbeit beginnen zu können. | 3 | DEV1 | MH | [Status](#issue-1) |
| 2 | Als Architekt will ich die technische Dokumentation (TechDoc.md) initialisieren und die Architektur (Sync-Strategie) definieren, um eine saubere Planungsgrundlage zu haben. | 5 | DEV2 | MH | [Status](#issue-2) |
| 3 | Als Entwickler will ich die Datenbank (z.B. CouchDB/PouchDB) konfigurieren und via Docker bereitstellen, damit Daten persistiert werden können. | 5 | DEV3 | MH | [Status](#issue-3) |
| 4 | Als Benutzer will ich mich registrieren und anmelden können, damit meine Listen sicher meinem Account zugeordnet sind. | 5 | DEV4 | MH | [Status](#issue-4) |
| 5 | Als Benutzer will ich Einkaufslisten erstellen, umbenennen und löschen, um meine Einkäufe zu strukturieren. | 5 | DEV1 | MH | [Status](#issue-5) |
| 6 | Als Benutzer will ich Artikel zu einer Liste hinzufügen, abhaken und löschen, um den Einkaufstatus zu verfolgen. | 5 | DEV2 | MH | [Status](#issue-6) |
| 7 | Als mobiler Benutzer will ich meine Daten lokal (offline) speichern, damit ich die App auch ohne Internetverbindung im Supermarkt nutzen kann (Offline-First). | 8 | DEV3 | MH | [Status](#issue-7) |
| 8 | Als System will ich lokale Änderungen automatisch an den Server senden (Upstream Sync), sobald eine Verbindung besteht, um Datenverlust zu vermeiden. | 8 | DEV4 | MH | [Status](#issue-8) |
| 9 | Als System will ich Änderungen vom Server empfangen (Replikation/Downstream), um den Stand anderer Geräte zu erhalten. | 8 | DEV1 | MH | [Status](#issue-9) |
| 10 | Als Benutzer will ich eine Liste mittels ID/Link mit anderen teilen, um gemeinsam an einer Liste zu arbeiten. | 5 | DEV2 | MH | [Status](#issue-10) |
| 11 | Als System will ich Synchronisationskonflikte erkennen und lösen (z.B. "Last Write Wins"), um Dateninkonsistenzen bei gleichzeitiger Bearbeitung zu verhindern. | 8 | DEV3 | SH | [Status](#issue-11) |
| 12 | Als Entwickler will ich End-to-End Tests (z.B. mit Cypress/Maestro) schreiben, um den Registrierungs- und Listen-Flow automatisiert zu prüfen. | 8 | DEV4 | SH | [Status](#issue-12) |
| 13 | Als Entwickler will ich Unit-Tests für die Synchronisationslogik implementieren, um die Stabilität der Datenübertragung zu gewährleisten. | 5 | DEV1 | SH | [Status](#issue-13) |
| 14 | Als DevOps-Engineer will ich eine CI/CD Pipeline einrichten, um bei jedem Push Tests auszuführen und Linter zu prüfen. | 5 | DEV2 | SH | [Status](#issue-14) |
| 15 | Als Benutzer will ich Artikeln farbige Labels (z.B. "Lebensmittel", "Drogerie") zuweisen, um die Übersichtlichkeit zu erhöhen. | 3 | DEV3 | N2H | [Status](#issue-15) |
| 16 | Als Benutzer will ich Notizen zu Artikeln hinzufügen, um Details wie Marken oder Mengen festzuhalten. | 2 | DEV4 | SH | [Status](#issue-16) |
| 17 | Als Benutzer will ich ein ansprechendes UI mit Feedback-Animationen nutzen, um die Bedienung angenehmer zu gestalten. | 3 | DEV1 | N2H | [Status](#issue-17) |
| 18 | Als Benutzer will ich meine Listen nach erledigten und offenen Artikeln filtern, um den Fokus auf fehlende Dinge zu legen. | 2 | DEV2 | N2H | [Status](#issue-18) |
| 19 | Als Administrator will ich das Backend-System global verfügbar deployen (z.B. Cloud), damit der Sync ortsunabhängig funktioniert. | 4 | DEV3 | N2H | [Status](#issue-19) |
| 20 | Als Benutzer will ich nach Artikeln innerhalb einer Liste suchen, um große Listen schneller zu verwalten. | 2 | DEV4 | N2H | [Status](#issue-20) |

## Zusammenfassung

*Arbeitsverteilung basierend auf 96 Gesamt-SPs:*

* **DEV1:** 24 SP (Schwerpunkt: Frontend & Sync Integration)
* **DEV2:** 22 SP (Schwerpunkt: Architektur, CI/CD, Sharing)
* **DEV3:** 25 SP (Schwerpunkt: Backend, Offline-DB, Konfliktlösung)
* **DEV4:** 25 SP (Schwerpunkt: Auth, Upstream Sync, Testing)

**Gesamt:** 96 SP
