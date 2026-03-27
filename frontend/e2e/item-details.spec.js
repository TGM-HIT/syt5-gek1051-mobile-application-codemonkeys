/**
 * item-details.spec.js – E2E Tests für U10: Details & Labels
 *
 * Testet das Hinzufügen von Notizen und das Vergeben von Labels/Farben
 * für Einkaufsartikel (User Story U10).
 *
 * Voraussetzung: App läuft unter http://localhost:5173 mit CouchDB-Backend.
 * Für lokale Tests ohne Backend wird localStorage/PouchDB offline verwendet.
 */

import { test, expect } from '@playwright/test';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Setzt den App-State zurück (localStorage + IndexedDB) und simuliert
 * einen eingeloggten User direkt via localStorage (für schnelle Tests).
 */
async function setupAuthSession(page, username = 'E2EUser') {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.evaluate((name) => {
    localStorage.clear();
    sessionStorage.clear();
    // Auth-Session simulieren
    localStorage.setItem('auth_user', JSON.stringify({ name, roles: [] }));
  }, username);

  // IndexedDB zurücksetzen
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 2000);
      try {
        const req = indexedDB.deleteDatabase('einkaufsliste_db');
        req.onsuccess = () => {
          clearTimeout(timeout);
          resolve();
        };
        req.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
        req.onblocked = () => {
          clearTimeout(timeout);
          resolve();
        };
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

/**
 * Erstellt eine Liste und fügt einen Artikel hinzu.
 * Gibt den Artikel-Locator zurück.
 */
async function createListAndItem(page, listName = 'Testliste', itemName = 'Milch') {
  // Liste erstellen
  await page.fill('.add-list-form .add-input', listName);
  await page.click('.add-list-form .add-btn');
  await page.waitForTimeout(300);

  // Artikel hinzufügen
  await page.fill('.add-item-form .add-input', itemName);
  await page.click('.add-item-form .add-btn');
  await page.waitForTimeout(300);

  // Artikel-Element zurückgeben
  return page.locator('.item').filter({ hasText: itemName }).first();
}

// ── Test Suite: Detail-Panel öffnen/schließen ─────────────────────────────────

test.describe('U10: Detail-Panel öffnen und schließen', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthSession(page);
  });

  test('⋯-Button ist für jeden Artikel sichtbar', async ({ page }) => {
    const item = await createListAndItem(page);
    await expect(item.locator('.item-detail-btn')).toBeVisible();
  });

  test('Detail-Panel ist standardmäßig geschlossen', async ({ page }) => {
    await createListAndItem(page);
    await expect(page.locator('.item-detail-panel')).not.toBeVisible();
  });

  test('Klick auf ⋯ öffnet das Detail-Panel', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.item-detail-panel')).toBeVisible();
  });

  test('Detail-Panel zeigt Notiz-Textarea', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.detail-textarea')).toBeVisible();
  });

  test('Detail-Panel zeigt Farb-Picker mit 7 Optionen', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    // 6 Farben + 1 "Kein Label" Button
    const colorOptions = page.locator('.color-option');
    await expect(colorOptions).toHaveCount(7);
  });

  test('Detail-Panel zeigt Speichern- und Abbrechen-Button', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.detail-save-btn')).toBeVisible();
    await expect(page.locator('.detail-cancel-btn')).toBeVisible();
  });

  test('Abbrechen schließt das Panel ohne Änderungen', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Diese Notiz wird verworfen');
    await page.locator('.detail-cancel-btn').click();
    await expect(page.locator('.item-detail-panel')).not.toBeVisible();
  });

  test('Zweimaliger Klick auf ⋯ schließt das Panel', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.item-detail-panel')).toBeVisible();
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.item-detail-panel')).not.toBeVisible();
  });

  test('⋯-Button hat active-Klasse wenn Panel offen ist', async ({ page }) => {
    const item = await createListAndItem(page);
    const btn = item.locator('.item-detail-btn');
    await btn.click();
    await expect(btn).toHaveClass(/active/);
  });

  test('⋯-Button hat keine active-Klasse wenn Panel geschlossen', async ({ page }) => {
    const item = await createListAndItem(page);
    const btn = item.locator('.item-detail-btn');
    await expect(btn).not.toHaveClass(/active/);
  });
});

// ── Test Suite: Notizen ───────────────────────────────────────────────────────

test.describe('U10: Notizen hinzufügen und anzeigen', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthSession(page);
  });

  test('Notiz kann eingegeben werden', async ({ page }) => {
    const item = await createListAndItem(page, 'Einkauf', 'Brot');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Bitte Vollkornbrot kaufen');
    await expect(page.locator('.detail-textarea')).toHaveValue('Bitte Vollkornbrot kaufen');
  });

  test('Notiz wird nach Speichern in der Vorschau angezeigt', async ({ page }) => {
    const item = await createListAndItem(page, 'Einkauf', 'Butter');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Deutsche Markenbutter');
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-note-preview')).toBeVisible();
    await expect(item.locator('.item-note-preview')).toHaveText('Deutsche Markenbutter');
  });

  test('📝-Icon erscheint nach dem Speichern einer Notiz', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Käse');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Gouda');
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-note-icon')).toBeVisible();
  });

  test('kein 📝-Icon wenn keine Notiz vorhanden', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Mehl');
    await expect(item.locator('.item-note-icon')).not.toBeVisible();
  });

  test('Notiz wird beim erneuten Öffnen des Panels angezeigt', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Zucker');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Rohrzucker bevorzugt');
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Panel erneut öffnen
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.detail-textarea')).toHaveValue('Rohrzucker bevorzugt');
  });

  test('Notiz kann gelöscht werden (leeres Textfeld speichern)', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Salz');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Meeressalz');
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Notiz löschen
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', '');
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-note-preview')).not.toBeVisible();
    await expect(item.locator('.item-note-icon')).not.toBeVisible();
  });

  test('Notiz-Textarea ist mehrzeilig (rows=2)', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    const rows = await page.locator('.detail-textarea').getAttribute('rows');
    expect(rows).toBe('2');
  });

  test('Notiz-Textarea hat Placeholder-Text', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    const placeholder = await page.locator('.detail-textarea').getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });
});

// ── Test Suite: Labels / Farben ───────────────────────────────────────────────

test.describe('U10: Labels und Farben vergeben', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthSession(page);
  });

  test('kein Farb-Dot sichtbar wenn kein Label vergeben', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Apfel');
    await expect(item.locator('.item-label-dot')).not.toBeVisible();
  });

  test('Farb-Picker enthält "Kein Label" Button', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.color-none')).toBeVisible();
  });

  test('Farb-Picker enthält 6 Farb-Buttons', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    // Alle color-option minus color-none = 6
    const colorBtns = page.locator('.color-option:not(.color-none)');
    await expect(colorBtns).toHaveCount(6);
  });

  test('Farbe kann ausgewählt werden', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Banane');
    await item.locator('.item-detail-btn').click();
    // Ersten Farb-Button klicken (rot)
    await page.locator('.color-option:not(.color-none)').first().click();
    await expect(page.locator('.color-option:not(.color-none)').first()).toHaveClass(/active/);
  });

  test('Label-Dot erscheint nach Speichern eines Labels', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Orange');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-label-dot')).toBeVisible();
  });

  test('Item-Zeile hat farbigen linken Rand nach Label-Zuweisung', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Kiwi');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    const borderStyle = await item.evaluate((el) => window.getComputedStyle(el).borderLeftStyle);
    expect(borderStyle).toBe('solid');
  });

  test('Label wird beim erneuten Öffnen vorausgewählt angezeigt', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Pflaume');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').nth(2).click(); // 3. Farbe
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.color-option:not(.color-none)').nth(2)).toHaveClass(/active/);
  });

  test('"Kein Label" Button ist standardmäßig aktiv', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.color-none')).toHaveClass(/active/);
  });

  test('Label kann entfernt werden mit "Kein Label" Button', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Mango');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Label entfernen
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-none').click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-label-dot')).not.toBeVisible();
  });

  test('Nur eine Farbe kann gleichzeitig aktiv sein', async ({ page }) => {
    const item = await createListAndItem(page);
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.color-option:not(.color-none)').nth(2).click();

    const activeCount = await page.locator('.color-option.active').count();
    expect(activeCount).toBe(1);
  });
});

// ── Test Suite: LabelFilterBar ────────────────────────────────────────────────

test.describe('U10: Label-Filter-Leiste', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthSession(page);
  });

  test('Label-Filterleiste ist nicht sichtbar wenn keine Labels vergeben', async ({ page }) => {
    await createListAndItem(page, 'Liste', 'Artikel ohne Label');
    await expect(page.locator('.label-filter-bar')).not.toBeVisible();
  });

  test('Label-Filterleiste erscheint wenn ein Label vergeben wird', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Artikel mit Label');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.label-filter-bar')).toBeVisible();
  });

  test('"Alle"-Button ist in der Filterleiste sichtbar', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Artikel');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.label-filter-all')).toBeVisible();
  });

  test('Filterleiste zeigt nur Labels mit mindestens einem Artikel', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Artikel');
    await item.locator('.item-detail-btn').click();
    // Erste Farbe (rot) auswählen
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Nur 1 Label-Button + "Alle"-Button = 2
    const filterBtns = page.locator('.label-filter-btn');
    await expect(filterBtns).toHaveCount(2);
  });
});

// ── Test Suite: Kombinierte Tests ─────────────────────────────────────────────

test.describe('U10: Notiz und Label kombiniert', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthSession(page);
  });

  test('Notiz und Label können gleichzeitig gespeichert werden', async ({ page }) => {
    const item = await createListAndItem(page, 'Wocheneinkauf', 'Tomaten');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Kirsch-Tomaten bevorzugt');
    await page.locator('.color-option:not(.color-none)').nth(0).click(); // rot
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await expect(item.locator('.item-note-preview')).toBeVisible();
    await expect(item.locator('.item-label-dot')).toBeVisible();
    await expect(item.locator('.item-note-icon')).toBeVisible();
  });

  test('Detail-Panel zeigt korrekte Werte nach zweitem Öffnen', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Gurken');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Bio-Gurken');
    await page.locator('.color-option:not(.color-none)').nth(3).click(); // blau
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    await item.locator('.item-detail-btn').click();
    await expect(page.locator('.detail-textarea')).toHaveValue('Bio-Gurken');
    await expect(page.locator('.color-option:not(.color-none)').nth(3)).toHaveClass(/active/);
  });

  test('Artikel mit Label und Notiz behält Checkbox-Funktion', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Zitrone');
    await item.locator('.item-detail-btn').click();
    await page.fill('.detail-textarea', 'Unbehandelt');
    await page.locator('.color-option:not(.color-none)').nth(2).click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Checkbox togglen
    await item.locator('.checkbox').click();
    await expect(item).toHaveClass(/checked/);
  });

  test('Artikel mit Label kann weiterhin gelöscht werden', async ({ page }) => {
    const item = await createListAndItem(page, 'Liste', 'Paprika');
    await item.locator('.item-detail-btn').click();
    await page.locator('.color-option:not(.color-none)').first().click();
    await page.locator('.detail-save-btn').click();
    await page.waitForTimeout(300);

    // Soft-Delete
    await item.locator('.delete-item-btn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.item').filter({ hasText: 'Paprika' })).not.toBeVisible();
  });
});
