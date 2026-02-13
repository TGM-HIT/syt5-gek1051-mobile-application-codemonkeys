# Technologie-Stack Begründung

## Überblick

Für die Entwicklung der Einkaufslisten-App wurde bewusst ein Technologie-Stack gewählt, der die Kernforderungen **Offline-First**, **bidirektionale Synchronisation** und **Konfliktlösung** optimal unterstützt. Die Kombination aus **CouchDB**, **PouchDB** und **Vue 3** bildet eine zukunftssichere und wartbare Basis.


## CouchDB (Backend-Datenbank)

### Warum CouchDB?

**1. Native Replikation & Synchronisation**  
CouchDB wurde von Grund auf für verteilte Systeme entwickelt. Die eingebaute bidirektionale Replikation ermöglicht es, Datenänderungen automatisch zwischen Server und Client zu synchronisieren – ohne zusätzliche Middleware oder komplexe Sync-Logik selbst implementieren zu müssen.

**2. Konfliktlösung auf Datenbankebene**  
CouchDB verwaltet Konflikte auf Dokumentenebene durch ein Revision-System (MVCC). Bei gleichzeitigen Änderungen werden beide Versionen gespeichert, was eine manuelle oder automatische Konfliktauflösung ermöglicht – kritisch für User Story U8 (Konfliktlösung bei Mehrbenutzer-Zugriff).

**3. Schema-lose Flexibilität**  
Als dokumentenorientierte Datenbank erlaubt CouchDB flexibles Arbeiten ohne starre Schemas. Features wie Labels (U10) oder Notizen können ohne Migrations-Overhead nachträglich hinzugefügt werden.

**4. HTTP-basiertes RESTful API**  
Alle Operationen erfolgen über HTTP/JSON, was die Integration mit Frontend-Technologien vereinfacht und Debugging erleichtert.

**5. Bewährte Zuverlässigkeit**  
CouchDB ist seit über 15 Jahren im Produktivbetrieb und wird für kritische Offline-First-Anwendungen weltweit eingesetzt.


## PouchDB (Frontend-Datenbank)

### Warum PouchDB?

**1. Perfekte CouchDB-Kompatibilität**  
PouchDB ist eine JavaScript-Implementierung, die das CouchDB-Protokoll vollständig nachbildet. Dadurch ist nahtlose Synchronisation zwischen lokaler Browser-Datenbank und CouchDB garantiert.

**2. Echte Offline-Fähigkeit**  
PouchDB nutzt IndexedDB (oder WebSQL als Fallback), um Daten persistent im Browser zu speichern. Die App funktioniert vollständig offline (U3) – alle CRUD-Operationen werden lokal ausgeführt und beim nächsten Online-Zustand automatisch synchronisiert.

**3. Automatische Hintergrund-Synchronisation**  
Die `sync()`-Methode von PouchDB ermöglicht kontinuierliche bidirektionale Synchronisation (U4). Changes werden in Echtzeit erkannt und übertragen, sobald eine Internetverbindung besteht.

**4. Änderungs-Streams (Change Feed)**  
PouchDB bietet einen reaktiven Change Feed, mit dem die UI automatisch auf Datenänderungen reagieren kann – ideal für Echtzeit-Updates bei geteilten Listen (U5).

**5. Leichtgewichtig & Browser-nativ**  
PouchDB hat keine Backend-Abhängigkeiten und läuft direkt im Browser. Kein zusätzlicher Server-Code für Offline-Logik notwendig.


## Vue 3 (Frontend-Framework)

### Warum Vue 3?

**1. Reaktive Composition API**  
Vue 3's Composition API ermöglicht saubere, wiederverwendbare Logik für komplexe Features wie Sync-Status, Offline-Detection oder Konflikt-Handling. Die Reaktivität passt perfekt zu PouchDB's Change Feed.

**2. Performance & Effizienz**  
Der virtuelle DOM und optimierte Reactivity-System von Vue 3 sorgen für schnelle Rendering-Zyklen – wichtig bei Listen mit vielen Artikeln.

**3. Gentle Learning Curve**  
Vue ist bekannt für seine klare, verständliche API. Die Einarbeitungszeit ist geringer als bei React oder Angular, was die Wartbarkeit (D2, D4) verbessert.

**4. Ökosystem & Tooling**  
- **Vue Router**: Für Navigation (Listen, Login, Settings)
- **Pinia**: State Management für User-Authentifizierung und globalen App-State
- **Vite**: Ultraschneller Build-Tool mit Hot Module Replacement
- **Vitest**: Testing-Framework mit nativer Vue-Unterstützung

**5. TypeScript-Support**  
Vue 3 wurde mit TypeScript neu geschrieben und bietet exzellente Typsicherheit – reduziert Fehler und verbessert die Codequalität für CI/CD (D5).

**6. Community & Langlebigkeit**  
Vue wird aktiv weiterentwickelt, hat eine große Community und wird in Produktivumgebungen weltweit eingesetzt.


## Synergien des Stacks

### CouchDB + PouchDB = Offline-First by Design

Die Kombination löst die Kern-Herausforderungen automatisch:

- **Sync-Logik**: Eingebaut, keine eigene Implementierung nötig
- **Konfliktlösung**: Auf DB-Ebene gelöst (U8)
- **Offline-Nutzung**: PouchDB arbeitet lokal, Sync erfolgt automatisch (U3, U4)
- **Soft Delete**: Dokumente mit `deleted: true` Flag speichern, Replikation behält Historie (U1, U2, U7)

### Vue 3 + PouchDB = Reaktive Offline-Apps

Vue's Reaktivität + PouchDB's Change Feed ergeben eine natürliche Integration:

```javascript
import { ref, onMounted } from 'vue'
import PouchDB from 'pouchdb'

const items = ref([])
const db = new PouchDB('shopping-lists')

db.changes({ live: true, since: 'now', include_docs: true })
  .on('change', change => {
    // Vue reagiert automatisch auf Änderungen
    items.value = updateItemsList(change)
  })
```

## Alternative Betrachtungen

**Warum nicht Firebase/Supabase?**
- Vendor Lock-in
- Weniger Kontrolle über Offline-Verhalten
- CouchDB ist Open Source und selbst-hostbar (D6)

**Warum nicht PostgreSQL + Custom Sync?**
- Sync-Logik müsste komplett selbst implementiert werden
- Konfliktlösung wäre komplex und fehleranfällig
- CouchDB bietet dies out-of-the-box

**Warum nicht React/Angular?**
- React: Mehr Boilerplate, steile Lernkurve
- Angular: Zu komplex für die Anforderungen, längere Build-Zeiten
- Vue bietet die beste Balance aus Einfachheit und Mächtigkeit


# Quellen

### CouchDB (Replikation, MVCC, Schema-los)
- [React Native offline-first mit PouchDB & CouchDB](https://www.yld.io/blog/react-native-offline-1st-build-pouchdb-and-couchdb) [yld](https://www.yld.io/blog/react-native-offline-1st-build-pouchdb-and-couchdb)
- [CouchDB MVCC Guide](https://moldstud.com/articles/p-understanding-couchdb-multi-version-concurrency-control-mvcc-a-comprehensive-guide) [moldstud](https://moldstud.com/articles/p-understanding-couchdb-multi-version-concurrency-control-mvcc-a-comprehensive-guide)
- [CouchDB schemaloses Design](https://www.unrepo.com/couchdb/document-structure-and-schemaless-design-in-couchdb) [unrepo](https://www.unrepo.com/couchdb/document-structure-and-schemaless-design-in-couchdb)
- [CouchDB HTTP/JSON REST API](https://stackoverflow.com/questions/7161465/how-can-i-access-my-couchdb-from-my-node-server-using-rest-json-get-post) [stackoverflow](https://stackoverflow.com/questions/7161465/how-can-i-access-my-couchdb-from-my-node-server-using-rest-json-get-post)
- [CouchDB Offline-First Multi-Master Sync](https://dev.to/animusna/couchdb-offline-first-with-multi-master-synchronization-using-docker-and-docker-compose-293e) [dev](https://dev.to/animusna/couchdb-offline-first-with-multi-master-synchronization-using-docker-and-docker-compose-293e)

### PouchDB (Offline, Sync, Change Feed)
- [PouchDB IndexedDB zu CouchDB Replikation](https://stackoverflow.com/questions/53416865/fail-to-replicate-a-local-indexeddb-to-a-remote-couchdb-using-pouchdb) [stackoverflow](https://stackoverflow.com/questions/53416865/fail-to-replicate-a-local-indexeddb-to-a-remote-couchdb-using-pouchdb)
- [Offline-First Shopping List mit Vue.js und PouchDB](https://morioh.com/a/0a9d3015f93a/offline-first-shopping-list-with-vuejs-and-pouchdb) [morioh](https://morioh.com/a/0a9d3015f93a/offline-first-shopping-list-with-vuejs-and-pouchdb)
- [PouchDB Changes Feed](https://pouchdb.com/guides/changes.html) [pouchdb](https://pouchdb.com/guides/changes.html)
- [PouchDB Replication Docs](https://pouchdb.com/guides/replication.html) [pouchdb](https://pouchdb.com/guides/replication.html)

### Vue 3 (Reaktivität, Ökosystem, Vergleich)
- [Reaktive PouchDB-Bindings für Vue.js](https://morioh.com/a/adde0dad9046/live-and-reactive-pouchdb-bindings-for-vuejs) [morioh](https://morioh.com/a/adde0dad9046/live-and-reactive-pouchdb-bindings-for-vuejs)
- [Vue 3 vs React Vorteile](https://outsourcify.net/vue-3-vs-react-the-quiet-revolution-in-front-end-development/) [outsourcify](https://outsourcify.net/vue-3-vs-react-the-quiet-revolution-in-front-end-development/)
- [Vue 3 mit Vite, Pinia, TypeScript](https://dev.to/maldestor95/building-a-vue-3-app-with-vite-tailwindcss-pinia-vue-router-and-typescript-23bl) [dev](https://dev.to/maldestor95/building-a-vue-3-app-with-vite-tailwindcss-pinia-vue-router-and-typescript-23bl)
- [Angular vs React vs Vue Performance](https://blog.logrocket.com/angular-vs-react-vs-vue-js-performance/) [blog.logrocket](https://blog.logrocket.com/angular-vs-react-vs-vue-js-performance/)

### Synergien & Alternativen
- [Supabase vs Firebase (Vendor Lock-in)](https://lanex.au/blog/supabase-vs-firebase-the-ultimate-guide-2025/) [lanex](https://lanex.au/blog/supabase-vs-firebase-the-ultimate-guide-2025/)
