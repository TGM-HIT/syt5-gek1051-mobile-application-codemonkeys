# User Stories (User-Centric)

## Legende

- **SP** Ein Storypoint entspricht einer Pomodoro Einheit von 40 Minuten.
- **HEAD** Die Verantwortung einer Userstory wird von dieser Person übernommen.
- **Prio** Es muss jeweils mindestens eine *Must Have (MH)*, *Should Have (SH)* und *Nice to have (N2H)* Userstory geben.
- **Status** Verlinkung zu Issues.

## Auflistung

| ID | Description (Feature aus Nutzersicht) | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Entwickler benötige ich eine aufgesetzte Entwicklungsumgebung & Git, um überhaupt an der App arbeiten zu können. | 3 | AY | MH | [Status](#issue-1) |
| 2 | Als Team benötigen wir eine klare Architektur-Dokumentation, um die App stabil und wartbar zu halten. | 5 | AY | MH | [Status](#issue-2) |
| 3 | Als Benutzer möchte ich, dass meine Daten dauerhaft auf dem Server gespeichert werden, damit nichts verloren geht (DB-Setup). | 5 | LS | MH | [Status](#issue-3) |
| 4 | Als Benutzer möchte ich mich registrieren und einloggen, damit nur ich Zugriff auf meine privaten Listen habe. | 5 | NS | MH | [Status](#issue-4) |
| 5 | Als Benutzer möchte ich neue Einkaufslisten erstellen und benennen, um für verschiedene Anlässe (Wochenmarkt, Baumarkt) zu planen. | 5 | VW | MH | [Status](#issue-5) |
| 6 | Als Benutzer möchte ich Artikel auf die Liste setzen und "abhaken", damit ich im Laden weiß, was noch fehlt. | 5 | VW | MH | [Status](#issue-6) |
| 7 | Als Benutzer möchte ich die App auch im Supermarkt ohne Internetempfang (Offline) voll nutzen können. | 8 | LS | MH | [Status](#issue-7) |
| 8 | Als Benutzer möchte ich, dass meine lokal eingetragenen Artikel automatisch in die Cloud hochgeladen werden, sobald ich Internet habe. | 8 | NS | MH | [Status](#issue-8) |
| 9 | Als Benutzer möchte ich, dass Änderungen meines Partners (z.B. neue Artikel) automatisch auf meinem Handy erscheinen. | 8 | MN | MH | [Status](#issue-9) |
| 10 | Als Benutzer möchte ich eine Liste per Link teilen, damit mein Partner oder WG-Mitglied Zugriff darauf hat. | 5 | MN | MH | [Status](#issue-10) |
| 11 | Als Benutzer möchte ich, dass nichts verloren geht, wenn ich und mein Partner gleichzeitig denselben Artikel bearbeiten (Konfliktlösung). | 8 | MN | SH | [Status](#issue-11) |
| 12 | Als Benutzer erwarte ich eine fehlerfreie App, die vor Veröffentlichung durch simulierte Benutzer-Tests (E2E) geprüft wurde. | 8 | AY | SH | [Status](#issue-12) |
| 13 | Als Benutzer erwarte ich, dass der Datenaustausch im Hintergrund stabil läuft und technisch abgesichert ist (Unit Tests). | 5 | NS | SH | [Status](#issue-13) |
| 14 | Als Benutzer möchte ich regelmäßige Updates ohne Abstürze erhalten, gesichert durch automatische Prüfprozesse (CI/CD). | 3 | LS | SH | [Status](#issue-14) |
| 15 | Als Benutzer möchte ich Artikel farblich markieren oder kategorisieren (z.B. "Obst", "Kühlregal"), um schneller einzukaufen. | 3 | VW | N2H | [Status](#issue-15) |
| 16 | Als Benutzer möchte ich Notizen (z.B. "3 Stück", "Bio") zu Artikeln schreiben, um Missverständnisse zu vermeiden. | 2 | VW | SH | [Status](#issue-16) |
| 17 | Als Benutzer möchte ich mein Profil verwalten (z.B. Passwort ändern) und mich ausloggen können. | 5 | VW | SH | [Status](#issue-17) |
| 18 | Als Benutzer möchte ich verständliche Fehlermeldungen sehen, wenn etwas schiefgeht (z.B. "Kein Internet"), statt die App abstürzen zu sehen. | 3 | MN | SH | [Status](#issue-18) |
| 19 | Als reisender Benutzer möchte ich von überall auf der Welt auf meine Listen zugreifen können (Global Deployment). | 5 | AY | N2H | [Status](#issue-19) |
| 20 | Als vorsichtiger Benutzer möchte ich meine Listen als Datei exportieren (Backup), um meine Daten lokal zu sichern. | 5 | LS | N2H | [Status](#issue-20) |
| 21 | Als Entwickler benötige ich eine saubere Dokumentation (Deployment Guide), um die App später warten zu können. | 3 | LS | MH | [Status](#issue-21) |
| 22 | Als Benutzer möchte ich einen Dark Mode nutzen, um die App auch abends augenschonend bedienen zu können. | 3 | NS | N2H | [Status](#issue-22) |
| 23 | Als Benutzer möchte ich durch kleine Animationen Feedback erhalten (z.B. beim Löschen), damit sich die App hochwertig anfühlt. | 3 | NS | N2H | [Status](#issue-23) |
| 24 | Als Benutzer mit Einschränkungen möchte ich die App mittels Screenreader bedienen können (Barrierefreiheit). | 3 | AY | N2H | [Status](#issue-24) |
| 25 | Als Benutzer möchte ich meine Liste sortieren (z.B. erledigte nach unten), um den Überblick zu behalten. | 2 | VW | N2H | [Status](#issue-25) |
| 26 | Als Benutzer möchte ich in sehr langen Listen nach einem bestimmten Artikel suchen können. | 2 | VW | N2H | [Status](#issue-26) |

## Zusammenfassung der Verantwortlichkeiten

Jeder Teilnehmer trägt **genau 24 Story Points**.

* **VW (Product Owner) - 24 SP**
    * *Fokus:* **Kern-Features & UX.** Erstellt die Listen (#5), verwaltet die Items (#6) und sorgt für Komfortfunktionen wie Einstellungen (#17), Labels (#15), Notizen (#16), Suche & Filter.
    * *Key User Story:* "Als Benutzer will ich Listen erstellen..." (Must Have)

* **LS (Technical Architect) - 24 SP**
    * *Fokus:* **Datenintegrität & Offline-Fähigkeit.** Sorgt dafür, dass die App auch im Funkloch funktioniert (#7), die Datenbank läuft (#3) und Backups möglich sind (#20).
    * *Key User Story:* "Als Benutzer will ich die App offline nutzen..." (Must Have)

* **NS (Developer) - 24 SP**
    * *Fokus:* **Zugang & Datenupload.** Kümmert sich um Login/Schutz (#4), das Senden der Daten an den Server (#8) und das visuelle Erlebnis (Dark Mode #22, Animationen #23).
    * *Key User Story:* "Als Benutzer will ich mich einloggen..." (Must Have)

* **MN (Developer) - 24 SP**
    * *Fokus:* **Kollaboration & Synchronität.** Sorgt dafür, dass Daten empfangen werden (#9), Listen geteilt werden können (#10) und Konflikte gelöst werden (#11).
    * *Key User Story:* "Als Benutzer will ich Listen teilen..." (Must Have)

* **AY (Developer) - 24 SP**
    * *Fokus:* **Qualität & Reichweite.** Legt das Fundament (#1, #2), prüft die App auf Herz und Nieren (E2E #12, A11y #24) und bringt sie ins Web (#19).
    * *Key User Story:* "Als Entwickler/Team will ich eine stabile Basis..." (Must Have)
