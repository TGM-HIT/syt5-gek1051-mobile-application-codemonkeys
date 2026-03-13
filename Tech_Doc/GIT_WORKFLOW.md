# Git Branching & Workflow

## Branch-Struktur

```
main
 └── dev
      ├── feature_xy     (ein Branch pro Feature/Aufgabe)
      ├── feature_abc
      └── fix_irgendwas
```

| Branch | Zweck |
|--------|-------|
| `main` | Stabiler, produktionsreifer Code – wird nur vor Kundenterminen aktualisiert |
| `dev` | Integrationsbranch – hier fließen alle fertigen Features zusammen |
| `feature_*` / `fix_*` | Kurzlebige Arbeitsbranches – ein Branch pro Aufgabe/Person |

---

## Ablauf

### 1. Neuen Feature-Branch anlegen

Jeder Entwickler legt für seine Aufgabe einen eigenen Branch von `dev` ab:

```bash
git checkout dev
git pull origin dev
git checkout -b feature_mein-feature
```

> Niemals direkt auf `dev` oder `main` arbeiten.

---

### 2. Entwickeln & lokal committen

Änderungen werden in kleinen, logischen Commits gesichert:

```bash
git add .
git commit -m "Kurze Beschreibung der Änderung"
```

---

### 3. Feature-Branch auf `dev` mergen

Ist das Feature fertig, wird es in `dev` integriert:

```bash
git checkout dev
git pull origin dev
git merge feature_mein-feature
git push origin dev
```

Der CI-Workflow läuft automatisch und führt alle Unit-Tests aus.  
Nur wenn die Tests grün sind, gilt der Merge als akzeptiert.

---

### 4. Release auf `main` vor Kundentermin

Bevor ein Gespräch mit dem **Kunden (Professor)** stattfindet, wird der stabile Stand aus `dev` auf `main` gemergt:

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

**Voraussetzungen für den Merge auf `main`:**
- Alle Unit-Tests auf `dev` sind grün (CI bestanden)
- Die App läuft lokal ohne Fehler
- Alle geplanten Features für den Kundentermin sind fertig

> `main` repräsentiert immer den Stand, den der **Kunde (Professor)** zu sehen bekommt.



---

## CI/CD Integration

Bei jedem Push und bei jedem Merge auf `dev` oder `main` wird automatisch der GitHub Actions Workflow ausgeführt (`.github/workflows/ci.yml`):

1. Abhängigkeiten installieren (`npm install`)
2. Unit-Tests ausführen (`npm test`)

Schlägt der Workflow fehl → der Code darf **nicht** auf `main` gemergt werden.
