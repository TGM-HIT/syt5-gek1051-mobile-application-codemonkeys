import { test, expect } from '@playwright/test';

async function setupSession(page, name = 'ShareUser') {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.evaluate((username) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('auth_user', JSON.stringify({ name: username, roles: [] }));
  }, name);

  // Delete IndexedDB with timeout
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

test.describe('Liste teilen', () => {
  test('öffnet den Share-Dialog', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Geteilte Liste');
    await page.click('.add-list-form .add-btn');
    await page.click('.share-list-btn');
    await expect(page.locator('.share-modal')).toBeVisible();
    await expect(page.getByText('Liste teilen')).toBeVisible();
  });

  test('generiert einen 6-stelligen Share-Code', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Code Liste');
    await page.click('.add-list-form .add-btn');
    await page.click('.share-list-btn');
    await page.waitForSelector('.share-code', { timeout: 5000 });
    const code = await page.locator('.share-code').textContent();
    expect(code?.trim().length).toBe(6);
    expect(code?.trim()).toMatch(/^[A-Z2-9]{6}$/);
  });

  test('schließt den Share-Dialog', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Modal Test');
    await page.click('.add-list-form .add-btn');
    await page.click('.share-list-btn');
    await expect(page.locator('.share-modal')).toBeVisible();
    await page.locator('.modal-btn-cancel').click();
    await expect(page.locator('.share-modal')).not.toBeVisible();
  });

  test('zeigt Join-Input-Feld', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.join-input')).toBeVisible();
    await expect(page.locator('.join-btn')).toBeVisible();
  });

  test('zeigt Fehler bei leerem Code', async ({ page }) => {
    await setupSession(page);
    await page.locator('.join-btn').first().click();
    await expect(page.locator('.join-message').first()).toBeVisible();
    await expect(page.locator('.join-message').first()).toHaveClass(/error/);
  });

  test('zeigt Fehler bei nicht gefundenem Code', async ({ page }) => {
    await setupSession(page);
    await page.fill('.join-input', 'XXXYYY');
    await page.click('.join-btn');
    await expect(page.locator('.join-message')).toBeVisible();
    await expect(page.locator('.join-message')).toHaveClass(/error/);
  });

  test('zeigt Fehler wenn Liste bereits vorhanden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Eigene Liste');
    await page.click('.add-list-form .add-btn');
    await page.click('.share-list-btn');
    await page.waitForSelector('.share-code', { timeout: 5000 });
    const code = await page.locator('.share-code').textContent();
    await page.locator('.modal-btn-cancel').click();
    await page.fill('.join-input', code?.trim() || '');
    await page.click('.join-btn');
    await expect(page.locator('.join-message')).toHaveClass(/error/);
  });
});
