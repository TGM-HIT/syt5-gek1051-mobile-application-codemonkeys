import { test, expect } from '@playwright/test';

// Hilfsfunktion: localStorage leeren und zur Login-Seite navigieren
async function goToLogin(page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe('Login & Registrierung', () => {
  test.beforeEach(async ({ page }) => {
    await goToLogin(page);
  });

  test('leitet unauthentifizierte Nutzer auf /login weiter', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('zeigt die Login-Seite mit allen Feldern', async ({ page }) => {
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test('Login-Button ist deaktiviert solange Felder leer sind', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.fill('#username', 'testuser');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.fill('#password', 'passwort123');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('zeigt Fehlermeldung bei falschen Credentials', async ({ page }) => {
    await page.fill('#username', 'nichtexistent');
    await page.fill('#password', 'falschespasswort');
    await page.click('button[type="submit"]');
    await expect(page.locator('.auth-error')).toBeVisible();
  });

  test('Passwort-Toggle zeigt/versteckt das Passwort', async ({ page }) => {
    await page.fill('#password', 'meinpasswort');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.click('.toggle-password');
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.click('.toggle-password');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('Link zur Registrierungsseite funktioniert', async ({ page }) => {
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL('/register');
  });
});

test.describe('Registrierung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('zeigt die Registrierungsseite mit allen Feldern', async ({ page }) => {
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#password-confirm')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Registrierungs-Button ist deaktiviert solange Felder leer sind', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.fill('#username', 'neuernutzer');
    await page.fill('#password', 'passwort123');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.fill('#password-confirm', 'passwort123');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('zeigt Fehler wenn Passwörter nicht übereinstimmen', async ({ page }) => {
    await page.fill('#username', 'neuernutzer');
    await page.fill('#password', 'passwort123');
    await page.fill('#password-confirm', 'anderes456');
    await page.click('button[type="submit"]');
    await expect(page.locator('.auth-error')).toBeVisible();
    await expect(page.locator('.auth-error')).toContainText('überein');
  });

  test('Link zur Login-Seite funktioniert', async ({ page }) => {
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Session-Persistenz', () => {
  test('eingeloggter Nutzer bleibt nach Reload eingeloggt', async ({ page }) => {
    // Auth-User in localStorage simulieren
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('auth_user', JSON.stringify({ name: 'testuser', roles: [] }));
    });
    await page.goto('/');
    // Sollte NICHT auf /login redirecten (localStorage-Fallback greift)
    await expect(page).not.toHaveURL('/login');
  });

  test('nicht eingeloggter Nutzer wird zu /login geleitet', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('auth_user'));
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('eingeloggter Nutzer wird von /login zu / weitergeleitet', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('auth_user', JSON.stringify({ name: 'testuser', roles: [] }));
    });
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});
