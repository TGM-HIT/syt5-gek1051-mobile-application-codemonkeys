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

## Verbindung zum Server
Nachdem der Server erstellt wurde, kann man sicher entweder über einen SSH Key verbinden oder man kann das Passwort vom User Account nehemn.

Anmelden tut man sich über: 
```bash
ssh <username>@<ip-address>
```
## Installation von Docker und VueJS Frontend

Damit man nicht mühsam das Projekt transfieren muss, kann man zu der Installation von Docker auch git und gh nahemen
```bash
sudo apt update && sudo apt install docker.io docker-compose nginx nodejs npm git -y
sudo systemctl enable docker nginx
sudo usermod -aG docker $USER
sudo apt install gh
```

Danach kann man das Projekt von Github pullen. Wichtig man muss eine .env im Root Verzeichnis erstellen, damit die Datenbank Verbindung funktioniert bzw. Das frontend sich Verbinden kann. 

Beispiel wäre:

```.env
# CouchDB Admin Credentials (für Docker Compose)
COUCHDB_USER=name
COUCHDB_PASSWORD=passwordvonEuch

# Optional: Datenbank Namen
DB_NAME=einkaufsliste

# Frontend Environment Variables (müssen mit VITE_ beginnen)
VITE_COUCHDB_URL=http://IP_VOM_SERVERT:PORT/einkaufsliste
VITE_COUCHDB_USER=name
VITE_COUCHDB_PASSWORD=passwordvonEuch
```

Danach:

``` bash
docker compose up -d
cd frontend
npm install
npm run build  
```

Build nach Nginx verschieben:

```bash
sudo mkdir -p /var/www/vue-app/public
sudo cp -r dist/* /var/www/vue-app/public/
sudo chown -R www-data:www-data /var/www/vue-app/public
```
Nginx Vue SPA Config:
```bash
sudo tee /etc/nginx/sites-available/vue > /dev/null <<EOF
server {
    listen 80;
    root /var/www/vue-app/public;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/vue /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
``` 

```bash
cd frontend &&
npm run build && sudo cp -r dist/* /var/www/vue-app/public/ && 
sudo chown -R www-data:www-data /var/www/vue-app/public/ &&
sudo systemctl reload nginx
````