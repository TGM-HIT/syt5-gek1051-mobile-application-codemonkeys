# Deployment der Applikation

Die Applikation wird auf einem Server gehostet, der über eine stabile Internetverbindung verfügt. Dafür wurde Azure verwendet

## Server Erstellung bei Azure

Zuerst muss man sich bei Azure anmelden und ein Schüler Konto erstellen, damit man Gratis Kredits bekommt.
Danach erstellt man eine neue `Virtuel Machine` und wählt die gewünschte Konfiguration aus.
Für diese Applikation wurde folgendes gewählt:
 - Location: France Central
 - Image: Debian 12 (Eines der billigsten Varianten)
   - Debian kann alles notwendige für die Einkaufsliste ausführen (VueJS Project / Docker). 
 - Size: Standard B2ats v2 (War das billigste welches Microsoft zu Verfügung stellen konnte)
   - vCPUs: 2 
   - RAM: 1 GiB
> Wichig ist dass eine statische IP Adresse ausgewählt wird, damit der Server auch funktinoiert.

 