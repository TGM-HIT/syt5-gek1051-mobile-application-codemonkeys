#!/bin/sh
set -e

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Konfiguration
DB_NAME="einkaufsliste"
AUTH="${COUCHDB_USER}:${COUCHDB_PASSWORD}"
BASE_URL="http://${COUCHDB_HOST}:${COUCHDB_PORT}"
CURL_CMD="curl -s -o /dev/null -w %{http_code} -u ${AUTH} -H Content-Type:application/json"

echo "${GREEN}=== CouchDB Setup (Optimiert) ===${NC}"

# 1. Warten auf CouchDB
echo "${YELLOW}Warte auf Verbindung...${NC}"
until curl -s http://${COUCHDB_HOST}:${COUCHDB_PORT}/_up > /dev/null 2>&1; do
  sleep 2
done

# 2. Datenbank erstellen
echo "${YELLOW}Checke DB '${DB_NAME}'...${NC}"
STATUS=$($CURL_CMD -X PUT "${BASE_URL}/${DB_NAME}")
if [ "$STATUS" = "201" ]; then echo "  -> Erstellt"; else echo "  -> Existiert bereits"; fi

# 3. Das "Master" Design Document (Die wichtigste Änderung!)
# Wir nutzen eine "Collation View". Damit sortieren wir Listen und Items zusammen.
# Trick: Listen bekommen Index 0, Items Index 1.
# Query: startkey=["listen_id"] & endkey=["listen_id", 2] -> Holt Liste + Items in EINEM Call.
echo "${YELLOW}Erstelle Master-View...${NC}"

$CURL_CMD -X PUT "${BASE_URL}/${DB_NAME}/_design/main" -d '{
  "views": {
    "full_list": {
      "map": "function(doc) { 
        if (doc.deleted) return;
        if (doc.type === \"list\") { 
          emit([doc._id, 0], null); 
        } else if (doc.type === \"item\") { 
          emit([doc.list_id, 1], null); 
        }
      }"
    },
    "by_owner": {
      "map": "function(doc) { 
        if (doc.type === \"list\" && !doc.deleted) { 
          emit(doc.owner, null); 
        }
      }"
    }
  }
}' > /dev/null

# 4. Mango Index für die Suche (U13)
# Nur EIN Index für Suche nach Namen ist nötig.
echo "${YELLOW}Erstelle Such-Index...${NC}"
$CURL_CMD -X POST "${BASE_URL}/${DB_NAME}/_index" -d '{
  "index": { "fields": ["type", "name"] },
  "name": "search-index",
  "type": "json"
}' > /dev/null

# 5. Minimale Demo-Daten
echo "${YELLOW}Erstelle Demo-Daten...${NC}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Liste
$CURL_CMD -X POST "${BASE_URL}/${DB_NAME}" -d '{
  "_id": "list_demo",
  "type": "list",
  "name": "Wocheneinkauf",
  "owner": "demo_user",
  "deleted": false,
  "createdAt": "'$TIMESTAMP'"
}' > /dev/null

# Item 1
$CURL_CMD -X POST "${BASE_URL}/${DB_NAME}" -d '{
  "_id": "item_001",
  "type": "item",
  "list_id": "list_demo",
  "name": "Milch",
  "checked": false,
  "deleted": false
}' > /dev/null

# Item 2
$CURL_CMD -X POST "${BASE_URL}/${DB_NAME}" -d '{
  "_id": "item_002",
  "type": "item",
  "list_id": "list_demo",
  "name": "Brot",
  "checked": true,
  "deleted": false
}' > /dev/null

echo ""
echo "${GREEN}✓ Fertig!${NC}"
echo "Test URL (Liste + Items): ${BASE_URL}/${DB_NAME}/_design/main/_view/full_list?startkey=[\"list_demo\"]&endkey=[\"list_demo\",2]&include_docs=true"