# User Stories (Quality Built-In)

## Legende

- **SP** Ein Storypoint entspricht einer Pomodoro Einheit von 40 Minuten.
- **Inkl. Tests** Bedeutet: Die Story ist erst fertig ("Done"), wenn Code, Unit-Tests und relevante E2E-Tests in der Pipeline grün sind.
- **HEAD** Verantwortliche Person.
- **Status** Verlinkung zu Issues.

## Auflistung

| ID | Description (Feature + Testing) | SP | HEAD | Prio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Als Benutzer möchte ich, dass die App auf einer sauberen Code-Basis entwickelt wird, die zukünftige Erweiterungen zulässt (Setup & Git). | 3 | AY | MH | [Status](#issue-1) |
| 2 | Als Benutzer erwarte ich eine dokumentierte Systemarchitektur, damit die App auch in Zukunft wartbar bleibt (TechDoc). | 5 | AY | MH | [Status](#issue-2) |
| 3 | Als Entwickler-Team benötigen wir eine **CI/CD Pipeline**, damit Tests bei jedem Feature-Push automatisch laufen und Fehler sofort blockiert werden. | 5 | LS | MH | [Status](#issue-3) |
| 4 | Als Benutzer möchte ich, dass meine Daten dauerhaft gespeichert werden (Datenbank-Setup inkl. Integrationstests). | 5 | LS | MH | [Status](#issue-4) |
| 5 | Als Benutzer möchte ich mich registrieren und sicher einloggen, um meine Daten zu schützen (**inkl. Auth-Tests**). | 8 | NS | MH | [Status](#issue-5) |
| 6 | Als Benutzer möchte ich Einkaufslisten erstellen und verwalten, um meinen Einkauf zu strukturieren (**inkl. UI/Logic Tests**). | 8 | VW | MH | [Status](#issue-6) |
| 7 | Als Benutzer möchte ich Artikel hinzufügen und abhaken, damit ich weiß, was fehlt (**inkl. E2E Test Flow**). | 8 | VW | MH | [Status](#issue-7) |
| 8 | Als Benutzer möchte ich die App **offline** nutzen können, ohne Daten zu verlieren (Lokale DB Logic **inkl. Sync-Tests**). | 8 | LS | MH | [Status](#issue-8) |
| 9 | Als Benutzer möchte ich, dass meine lokalen Änderungen automatisch auf den Server hochgeladen werden (Upstream Sync **inkl. Netz-Simulationstests**). | 8 | NS | MH | [Status](#issue-9) |
| 10 | Als Benutzer möchte ich, dass Änderungen von anderen Geräten automatisch bei mir ankommen (Downstream Sync **inkl. Latenz-Tests**). | 8 | MN | MH | [Status](#issue-10) |
| 11 | Als Benutzer möchte ich Listen per Link teilen, um gemeinsam einzukaufen (**inkl. Sharing-Flow Tests**). | 8 | MN | MH | [Status](#issue-11) |
| 12 | Als Benutzer möchte ich, dass gleichzeitige Änderungen (Konflikte) automatisch und logisch gelöst werden (**inkl. Konflikt-Unit-Tests**). | 8 | MN | SH | [Status](#issue-12) |
| 13 | Als Benutzer möchte ich mein Profil verwalten und Einstellungen (z.B. Logout) vornehmen (**inkl. User-Flow Tests**). | 8 | AY | SH | [Status](#issue-13) |
| 14 | Als Benutzer möchte ich Labels (Kategorien/Farben) nutzen, um die Liste visuell zu ordnen (**inkl. UI Tests**). | 3 | VW | N2H | [Status](#issue-14) |
| 15 | Als Benutzer möchte ich Notizen zu Artikeln hinzufügen, um Details festzuhalten (**inkl. Tests**). | 2 | VW | SH | [Status](#issue-15) |
| 16 | Als Benutzer möchte ich Listen filtern und sortieren, um den Überblick zu behalten (**inkl. Filter-Logik Tests**). | 3 | VW | N2H | [Status](#issue-16) |
| 17 | Als Benutzer möchte ich verständliche Fehlermeldungen (Validierung) erhalten, statt Abstürze zu erleben (**inkl. Error-Tests**). | 3 | NS | SH | [Status](#issue-17) |
| 18 | Als Benutzer möchte ich einen Dark Mode für angenehme Nutzung bei Nacht (**inkl. Snapshot Tests**). | 5 | NS | N2H | [Status](#issue-18) |
| 19 | Als reisender Benutzer möchte ich weltweit schnell auf meine Daten zugreifen (Global Deployment **inkl. Smoke Tests**). | 5 | AY | N2H | [Status](#issue-19) |
| 20 | Als Benutzer möchte ich Daten exportieren (Backup), um sie lokal zu sichern (**inkl. Export-Tests**). | 5 | LS | N2H | [Status](#issue-20) |
| 21 | Als Entwickler benötige ich eine finale Deployment-Dokumentation, um den Betrieb zu sichern. | 1 | LS | MH | [Status](#issue-21) |
| 22 | Als Benutzer mit Einschränkungen möchte ich die App barrierefrei nutzen können (Accessibility **inkl. a11y Checks**). | 3 | AY | N2H | [Status](#issue-22) |

## Zusammenfassung der Verantwortlichkeiten

Jeder Teilnehmer trägt **genau 24 Story Points**. Testaufwände sind in die Features integriert.

* **VW (Product Owner) - 24 SP**
    * *Kern-Features (mit Tests):* Listen erstellen (#6), Items verwalten (#7).
    * *UX Features:* Labels (#14), Notizen (#15), Filter/Sort (#16).
* **LS (Technical Architect) - 24 SP**
    * *Infrastruktur:* **CI/CD Pipeline Setup (#3)** (Basis für alle Tests), DB Setup (#4), Deployment Doku (#21).
    * *Logik:* Offline-Modus (#8), Backup (#20).
* **NS (Developer) - 24 SP**
    * *Auth & Sync:* Login (#5), Upstream Sync (#9).
    * *UI Polish:* Validierung (#17), Dark Mode (#18).
* **MN (Developer) - 24 SP**
    * *Sync & Collab:* Downstream Sync (#10), Sharing (#11), Konfliktlösung (#12). (Alle 8 SP, da Sync-Tests aufwendig sind).
* **AY (Developer) - 24 SP**
    * *Basis & Erweiterung:* Setup/Git (#1), Architektur/Doku (#2).
    * *Features:* User Profile/Settings (#13), Global Deployment (#19), Accessibility (#22).

**Gesamt:** 120 SP
