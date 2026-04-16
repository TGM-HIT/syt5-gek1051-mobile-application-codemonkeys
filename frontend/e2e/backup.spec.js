/**
 * E2E-Tests für U12: JSON-Backup
 *  - U12.1: Backup-Button (💾) ist pro Liste sichtbar
 *  - U12.2: Download wird ausgelöst, Dateiname & JSON-Struktur sind korrekt
 *  - U12.3: Import-Button im Profil-Dialog; gültiges Backup wiederherstellen;
 *           ungültige Datei zeigt Fehlermeldung
 */

import { test, expect } from '@playwright/test';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function setupSession(page, name = 'BackupUser') {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 10000 });

  await page.evaluate((username) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('auth_user', JSON.stringify({ name: username, roles: [] }));
  }, name);

  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      try {
        const req = indexedDB.deleteDatabase('einkaufsliste_db');
        req.onsuccess = req.onerror = req.onblocked = () => { clearTimeout(timeout); resolve(); };
      } catch { clearTimeout(timeout); resolve(); }
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.add-list-form', { timeout: 10000 });
}

/** Erstellt eine Liste und gibt den Locator der neuen Liste zurück */
async function createList(page, name) {
  await page.fill('.add-list-form .add-input', name);
  await page.click('.add-list-form .add-btn');
  const listLocator = page.locator('.list').filter({ has: page.locator('h2', { hasText: name }) });
  await listLocator.waitFor({ timeout: 5000 });
  return listLocator;
}

/** Öffnet das Profil-Modal */
async function openProfile(page) {
  await page.click('.settings-btn');
  await page.waitForSelector('.profile-modal', { timeout: 5000 });
}

// ── U12.1: Backup-Button pro Liste ───────────────────────────────────────────

test.describe('U12.1: Backup-Button in der Listen-Übersicht', () => {
  test('zeigt den Backup-Button (💾) für jede Liste an', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'TesteinkaufBackup');
    await expect(list.locator('.backup-list-btn')).toBeVisible();
  });

  test('zeigt den Backup-Button für mehrere neu erstellte Listen', async ({ page }) => {
    await setupSession(page);
    const listA = await createList(page, 'BackupListeX');
    const listB = await createList(page, 'BackupListeY');
    await expect(listA.locator('.backup-list-btn')).toBeVisible();
    await expect(listB.locator('.backup-list-btn')).toBeVisible();
  });

  test('Backup-Button hat den richtigen Titel-Tooltip', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'TooltipBackupTest');
    await expect(list.locator('.backup-list-btn')).toHaveAttribute('title', 'Backup erstellen');
  });
});

// ── U12.2: Download ───────────────────────────────────────────────────────────

test.describe('U12.2: Backup-Download', () => {
  test('löst beim Klick auf 💾 einen Datei-Download aus', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'DownloadTestBackup');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      list.locator('.backup-list-btn').click(),
    ]);

    expect(download).toBeTruthy();
  });

  test('Dateiname beginnt mit "backup-" und endet auf ".json"', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'DateinameTestBackup');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      list.locator('.backup-list-btn').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^backup-/);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('Dateiname enthält den Listennamen (sanitized)', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'Sanitizedlist');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      list.locator('.backup-list-btn').click(),
    ]);

    expect(download.suggestedFilename().toLowerCase()).toContain('sanitizedlist');
  });

  test('heruntergeladene JSON-Datei hat gültige Struktur', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'StrukturTestBackup');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      list.locator('.backup-list-btn').click(),
    ]);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const json = JSON.parse(Buffer.concat(chunks).toString());

    expect(json).toHaveProperty('exportedAt');
    expect(json).toHaveProperty('exportedBy');
    expect(json).toHaveProperty('list');
    expect(json.list).toHaveProperty('name', 'StrukturTestBackup');
    expect(json.list).toHaveProperty('items');
    expect(Array.isArray(json.list.items)).toBe(true);
  });

  test('exportierte Items enthalten name und checked', async ({ page }) => {
    await setupSession(page);
    const list = await createList(page, 'ItemsTestBackup');

    // Artikel hinzufügen und warten bis er erscheint
    await list.locator('.add-item-form .add-input').fill('Brot');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.item-name', { hasText: 'Brot' }).waitFor({ timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      list.locator('.backup-list-btn').click(),
    ]);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const json = JSON.parse(Buffer.concat(chunks).toString());

    const item = json.list.items.find((i) => i.name === 'Brot');
    expect(item).toBeDefined();
    expect(item).toHaveProperty('checked');
  });
});

// ── U12.3: Import / Wiederherstellen ─────────────────────────────────────────

test.describe('U12.3: Backup-Import im Profil-Dialog', () => {
  test('zeigt den "📂 Backup laden"-Button im Profil-Dialog', async ({ page }) => {
    await setupSession(page);
    await openProfile(page);
    await expect(page.locator('.profile-backup-btn')).toBeVisible();
    await expect(page.locator('.profile-backup-btn')).toContainText('Backup laden');
  });

  test('importiert ein gültiges Backup und zeigt die wiederhergestellte Liste', async ({ page }) => {
    await setupSession(page);

    const backupPayload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      exportedBy: 'BackupUser',
      list: {
        name: 'WiederhergestelltBackup',
        owner: 'BackupUser',
        createdAt: new Date().toISOString(),
        items: [
          { name: 'Aepfel', checked: false, note: null, label: null, markedDeleted: false },
          { name: 'Orangen', checked: true, note: 'Bio', label: 'green', markedDeleted: false },
        ],
      },
    });

    await openProfile(page);
    await page.locator('.profile-backup-btn input[type="file"]').setInputFiles({
      name: 'backup-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupPayload),
    });

    await expect(page.locator('.profile-success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.profile-success')).toContainText('WiederhergestelltBackup');

    await page.locator('.modal-btn-cancel').click();
    await expect(
      page.locator('.list h2').filter({ hasText: 'WiederhergestelltBackup (Backup)' })
    ).toBeVisible({ timeout: 5000 });
  });

  test('importierte Liste enthält die Artikel aus dem Backup', async ({ page }) => {
    await setupSession(page);

    const backupPayload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      exportedBy: 'BackupUser',
      list: {
        name: 'MitArtikelnBackup',
        owner: 'BackupUser',
        items: [
          { name: 'Kaffee', checked: false, note: null, label: null, markedDeleted: false },
        ],
      },
    });

    await openProfile(page);
    await page.locator('.profile-backup-btn input[type="file"]').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupPayload),
    });

    await page.locator('.modal-btn-cancel').click();

    const list = page.locator('.list').filter({ has: page.locator('h2', { hasText: 'MitArtikelnBackup (Backup)' }) });
    await expect(list.locator('.item-name', { hasText: 'Kaffee' })).toBeVisible({ timeout: 5000 });
  });

  test('zeigt Fehlermeldung bei ungültiger JSON-Datei', async ({ page }) => {
    await setupSession(page);
    await openProfile(page);

    await page.locator('.profile-backup-btn input[type="file"]').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('das ist kein json {{{'),
    });

    await expect(page.locator('.profile-error')).toBeVisible({ timeout: 5000 });
  });

  test('zeigt Fehlermeldung bei JSON ohne list-Feld', async ({ page }) => {
    await setupSession(page);
    await openProfile(page);

    await page.locator('.profile-backup-btn input[type="file"]').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ exportedAt: '2026-01-01', data: [] })),
    });

    await expect(page.locator('.profile-error')).toBeVisible({ timeout: 5000 });
  });
});
