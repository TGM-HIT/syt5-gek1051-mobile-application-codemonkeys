# User Stories

## Legende
- **SP (Story Points):** Aufwandsschätzung inkl. Implementierung, Tests und Dokumentation (1 SP ≈ 40 Min).
- **Definition of Done:** Eine Story ist erst fertig, wenn der Code funktionstüchtig ist **und** die entsprechenden Tests (Unit/E2E) in der CI-Pipeline bestanden haben.
- **Prio:** Must Have (MH), Should Have (SH), Nice to Have (N2H).

## Auflistung

| ID | Description (User Value) | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Benutzer möchte ich, dass die App auf einer sauberen, erweiterbaren Code-Basis entwickelt wird, damit zukünftige Features schnell und fehlerfrei integriert werden können. | 3 | AY | MH | [Status](#issue-1) |
| 2 | Als Benutzer erwarte ich eine dokumentierte Systemarchitektur, damit die App langfristig wartbar bleibt und Fehler auch in Zukunft schnell behoben werden können. | 5 | AY | MH | [Status](#issue-2) |
| 3 | Als Entwickler-Team benötigen wir eine CI/CD Pipeline, um die Qualitätssicherung zu automatisieren und Fehler vor dem Release zu blockieren. | 5 | LS | MH | [Status](#issue-3) |
| 4 | Als Benutzer möchte ich, dass meine Daten dauerhaft in einer Datenbank gespeichert werden, damit sie auch nach einem Neustart erhalten bleiben. | 5 | LS | MH | [Status](#issue-4) |
| 5 | Als Benutzer möchte ich mich registrieren und sicher einloggen, um unbefugten Zugriff auf meine privaten Listen zu verhindern. | 8 | NS | MH | [Status](#issue-5) |
| 6 | Als Benutzer möchte ich Einkaufslisten erstellen, umbenennen und verwalten, um meinen Einkauf strukturiert zu planen. | 8 | VW | MH | [Status](#issue-6) |
| 7 | Als Benutzer möchte ich Artikel zu einer Liste hinzufügen und als "erledigt" markieren, um den Überblick im Supermarkt zu behalten. | 8 | VW | MH | [Status](#issue-7) |
| 8 | Als Benutzer möchte ich die App auch ohne Internetverbindung (Offline) voll nutzen können, ohne dass Daten verloren gehen. | 8 | LS | MH | [Status](#issue-8) |
| 9 | Als Benutzer möchte ich, dass meine lokal erstellten Daten automatisch an den Server gesendet werden, sobald ich online bin (Upstream Sync). | 9 | NS | MH | [Status](#issue-9) |
| 10 | Als Benutzer möchte ich, dass Änderungen von anderen Geräten automatisch auf meinem Smartphone erscheinen (Downstream Sync). | 8 | MN | MH | [Status](#issue-10) |
| 11 | Als Benutzer möchte ich eine Liste per Link mit anderen Personen teilen, um den Einkauf gemeinsam zu erledigen. | 8 | MN | MH | [Status](#issue-11) |
| 12 | Als Benutzer möchte ich, dass bei gleichzeitiger Bearbeitung keine Daten überschrieben werden oder verloren gehen (Konfliktlösung). | 8 | MN | SH | [Status](#issue-12) |
| 13 | Als Benutzer möchte ich mein Profil verwalten und persönliche Einstellungen (z.B. Passwort ändern, Logout) vornehmen können. | 8 | AY | SH | [Status](#issue-13) |
| 14 | Als Benutzer möchte ich Artikeln farbige Labels oder Kategorien zuweisen, um die Liste visuell besser zu erfassen. | 3 | VW | N2H | [Status](#issue-14) |
| 15 | Als Benutzer möchte ich Notizen zu Artikeln hinzufügen, um Details wie Marken oder Mengenangaben festzuhalten. | 2 | VW | SH | [Status](#issue-15) |
| 16 | Als Benutzer möchte ich meine Listen filtern und sortieren, um erledigte Einträge auszublenden oder wichtige Dinge oben zu sehen. | 3 | VW | N2H | [Status](#issue-16) |
| 17 | Als Benutzer möchte ich verständliche Fehlermeldungen erhalten, statt kryptischer Codes oder Abstürze, wenn eine Aktion fehlschlägt. | 5 | NS | SH | [Status](#issue-17) |
| 18 | Als Benutzer möchte ich einen Dark Mode aktivieren können, um die App auch bei schlechten Lichtverhältnissen angenehm zu nutzen. | 2 | NS | N2H | [Status](#issue-18) |
| 19 | Als reisender Benutzer möchte ich von überall auf der Welt schnell und sicher auf meine Daten zugreifen können (Global Deployment). | 5 | AY | N2H | [Status](#issue-19) |
| 20 | Als vorsichtiger Benutzer möchte ich meine Listen als Datei exportieren (Backup), um eine lokale Kopie meiner Daten zu besitzen. | 5 | LS | N2H | [Status](#issue-20) |
| 21 | Als Entwickler benötige ich eine vollständige Deployment-Dokumentation, um den Betrieb der App langfristig sicherzustellen. | 1 | LS | MH | [Status](#issue-21) |
| 22 | Als Benutzer mit Einschränkungen möchte ich die App barrierefrei (z.B. via Screenreader) bedienen können. | 3 | AY | N2H | [Status](#issue-22) |

## Zusammenfassung der Verantwortlichkeiten

Jeder Teilnehmer trägt **genau 24 Story Points**. Die Test-Erstellung ist implizit in den Story Points enthalten.

* **VW (Product Owner) - 24 SP**
    * *Kern-Features:* Listenverwaltung (#6), Artikelverwaltung (#7).
    * *UX-Erweiterungen:* Labels (#14), Notizen (#15), Sortierung/Filter (#16).
* **LS (Technical Architect) - 24 SP**
    * *Infrastruktur:* CI/CD (#3), DB Setup (#4), Doku (#21).
    * *Robustheit:* Offline-Modus (#8), Backup (#20).
* **NS (Developer) - 24 SP**
    * *Zugang & Sync:* Login/Auth (#5), Upstream Sync (#9).
    * *User Interface:* Fehlermeldungen/Feedback (#17), Dark Mode (#18).
* **MN (Developer) - 24 SP**
    * *Kollaboration:* Downstream Sync (#10), Sharing (#11), Konfliktlösung (#12).
    * *Hinweis:* Hohe SP-Werte hier, da Synchronisation und Konfliktmanagement sehr testintensive Bereiche sind.
* **AY (Developer) - 24 SP**
    * *Fundament:* Setup/Git (#1), Architektur (#2).
    * *Qualität & Reichweite:* User Profile (#13), Global Deployment (#19), Barrierefreiheit (#22).

**Gesamt:** 120 SP
