import { test, expect } from '@playwright/test';

test.describe('Session Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('zeigt das Session-Modal beim ersten Besuch', async ({ page }) => {
    await expect(page.locator('.session-overlay')).toBeVisible();
    await expect(page.locator('.session-modal h2')).toContainText('Willkommen');
    await expect(page.locator('.session-input')).toBeVisible();
  });

  test('Button ist deaktiviert solange kein Name eingegeben ist', async ({ page }) => {
    await expect(page.locator('.session-btn')).toBeDisabled();
    await page.fill('.session-input', '   ');
    await expect(page.locator('.session-btn')).toBeDisabled();
  });

  test('öffnet die App nach Namenseingabe', async ({ page }) => {
    await page.fill('.session-input', 'TestUser');
    await page.click('.session-btn');
    await expect(page.locator('.session-overlay')).not.toBeVisible();
    const sessionName = await page.evaluate(() =>
      localStorage.getItem('einkaufsliste_session_name'),
    );
    expect(sessionName).toBe('TestUser');
  });

  test('akzeptiert Enter zum Bestätigen', async ({ page }) => {
    await page.fill('.session-input', 'EnterUser');
    await page.press('.session-input', 'Enter');
    await expect(page.locator('.session-overlay')).not.toBeVisible();
  });

  test('trimmt Whitespace vom Namen', async ({ page }) => {
    await page.fill('.session-input', '  TrimUser  ');
    await page.click('.session-btn');
    const sessionName = await page.evaluate(() =>
      localStorage.getItem('einkaufsliste_session_name'),
    );
    expect(sessionName).toBe('TrimUser');
  });

  test('Session bleibt nach Reload erhalten', async ({ page }) => {
    await page.fill('.session-input', 'PersistUser');
    await page.click('.session-btn');
    await page.reload();
    await expect(page.locator('.session-overlay')).not.toBeVisible();
  });

  test('hält maxlength von 30 Zeichen ein', async ({ page }) => {
    await page.fill('.session-input', 'A'.repeat(50));
    const value = await page.inputValue('.session-input');
    expect(value.length).toBeLessThanOrEqual(30);
  });
});
