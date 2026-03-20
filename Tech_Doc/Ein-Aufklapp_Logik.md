### Einkaufsliste ab 40 Artikeln einklappen & erweitern
Author: Niklas Strobl
Als Benutzer möchte ich bei langen Einkaufslisten (über 40 Artikel) standardmäßig nur die ersten 40 sehen, um eine bessere Übersichtlichkeit zu behalten. (N2H)

Akzeptanzkriterien:

Listen mit mehr als 40 Artikeln zeigen beim Öffnen initial nur die ersten 40 an.
Unter der Liste erscheint ein "Weitere Artikel anzeigen"-Button, wenn noch Artikel verborgen sind.
Ein Klick auf diesen Button klappt maximal 40 weitere Artikel auf.
Der Button verschwindet automatisch, sobald alle Artikel der Liste sichtbar sind.

**Frontend-Logik (Paginierung):** In der ShoppingList.vue wurde ein reaktiver State eingeführt, der die maximale Anzahl an sichtbaren Artikeln initial auf 40 festlegt. Spezielle Getter (wie getVisibleActiveItems) limitieren die Listen entsprechend, bevor sie im Template gerendert werden.

**UI & Styling:** Es wurde ein dynamischer „Weitere Artikel anzeigen“-Button implementiert. Dieser wird nur eingeblendet, wenn noch verborgene Artikel in der jeweiligen Liste existieren. Ein Klick darauf erhöht das Limit um 40. Der Button wurde in der ShoppingList.css
responsiv und passend zum minimalistischen Design gestylt.

**Komponententest:** Zur Absicherung wurde der Vitest-Integrationstest ShoppingList.pagination.test.js
 erstellt. Dieser mockt präzise eine Liste mit 45 Artikeln, prüft das initiale Rendern von exakt 40 Elementen und verifiziert, dass nach dem Klickereignis alle 45 Artikel sichtbar sind und der Button aus dem DOM verschwindet.