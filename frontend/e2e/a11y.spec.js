import { test, expect } from '@playwright/test';

async function resetAppState(page, authUserName = null) {
  // Wait for the login form to render so the async checkSession() in
  // the router guard has fully completed and can no longer overwrite
  // localStorage.
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 10000 });

  await page.evaluate(async (name) => {
    localStorage.clear();
    sessionStorage.clear();

    if (name) {
      localStorage.setItem('auth_user', JSON.stringify({ name, roles: [] }));
    }

    await new Promise((resolve) => {
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
  }, authUserName);
}

async function setupGuestPage(page, path = '/login') {
  await resetAppState(page, null);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

async function setupAuthenticatedPage(page, username = 'A11yUser') {
  await resetAppState(page, username);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.add-list-form', { timeout: 10000 });
}

async function createList(page, listName) {
  await page.getByLabel('Name für neue Liste').fill(listName);
  await page.getByRole('button', { name: 'Liste erstellen' }).click();

  const list = page.locator('.list').filter({
    has: page.getByRole('heading', { name: listName }),
  });
  await expect(list).toBeVisible();
  return list;
}

async function addItemToList(page, listName, itemName) {
  await page.getByLabel(`Neuen Artikel zu Liste ${listName} hinzufügen`).fill(itemName);
  await page.getByRole('button', { name: `Artikel zu Liste ${listName} hinzufügen` }).click();
  await expect(page.locator('.item').filter({ hasText: itemName }).first()).toBeVisible();
}

test.describe('A11y: Auth Views', () => {
  test('Login controls are reachable by role and accessible name', async ({ page }) => {
    await setupGuestPage(page, '/login');

    await expect(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();
    await expect(page.getByLabel('Benutzername')).toBeVisible();
    await expect(page.getByLabel('Passwort', { exact: true })).toBeVisible();

    const showPasswordButton = page.getByRole('button', { name: 'Passwort anzeigen' });
    await expect(showPasswordButton).toBeVisible();

    await showPasswordButton.click();
    await expect(page.getByRole('button', { name: 'Passwort verbergen' })).toBeVisible();
  });

  test('Register validation feedback is exposed as alert', async ({ page }) => {
    await setupGuestPage(page, '/register');

    await page.getByLabel('Benutzername').fill('a11yuser');
    await page.getByLabel('Passwort', { exact: true }).fill('passwort123');
    await page.getByLabel('Passwort bestätigen').fill('anderespasswort');
    await page.getByRole('button', { name: 'Registrieren' }).click();

    await expect(page.getByRole('alert')).toContainText('Passwörter stimmen nicht überein');
  });
});

test.describe('A11y: Shopping List Views', () => {
  test('Header and list controls expose semantic roles/names', async ({ page }) => {
    await setupAuthenticatedPage(page);
    const listName = `A11y-Liste-${Date.now()}`;
    const list = await createList(page, listName);

    await expect(page.getByRole('switch', { name: /Mode ist aktiv/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Nur geänderte Artikel anzeigen/i }),
    ).toBeVisible();
    await expect(list.getByRole('button', { name: `Liste ${listName} teilen` })).toBeVisible();
    await expect(list.getByRole('button', { name: `Liste ${listName} löschen` })).toBeVisible();
  });

  test('Confirm dialog traps focus and restores focus on close', async ({ page }) => {
    await setupAuthenticatedPage(page);
    const listName = `A11y-Dialog-${Date.now()}`;
    const list = await createList(page, listName);
    const deleteButton = list.getByRole('button', { name: `Liste ${listName} löschen` });

    await deleteButton.focus();
    await deleteButton.press('Enter');

    const dialog = page.getByRole('dialog', { name: /Liste löschen\?/i });
    const cancelButton = dialog.getByRole('button', { name: 'Abbrechen' });
    const continueButton = dialog.getByRole('button', { name: 'Weiter' });

    await expect(dialog).toBeVisible();
    await expect(cancelButton).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(continueButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(cancelButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(deleteButton).toBeFocused();
  });

  test('Share dialog closes with Escape', async ({ page }) => {
    await setupAuthenticatedPage(page);
    const listName = `A11y-Share-${Date.now()}`;
    const list = await createList(page, listName);
    const shareButton = list.getByRole('button', { name: `Liste ${listName} teilen` });

    await shareButton.focus();
    await shareButton.press('Enter');

    const dialog = page.getByRole('dialog', { name: /Liste teilen/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(shareButton).toBeVisible();
  });

  test('Item keyboard flow keeps semantic names and non-color label cue', async ({ page }) => {
    await setupAuthenticatedPage(page);
    const listName = `A11y-Items-${Date.now()}`;
    const itemName = 'Milch';
    const list = await createList(page, listName);
    await addItemToList(page, listName, itemName);

    const itemCheckbox = list.getByRole('checkbox', {
      name: `Artikel ${itemName} als erledigt markieren`,
    });
    await itemCheckbox.focus();
    await page.keyboard.press('Space');

    await expect(list.locator('.item').filter({ hasText: itemName })).toHaveClass(/checked/);
    await expect(
      list.getByRole('checkbox', { name: `Artikel ${itemName} als offen markieren` }),
    ).toBeVisible();

    const detailsButton = list.getByRole('button', { name: `Details für ${itemName} öffnen` });
    await detailsButton.press('Enter');
    await expect(page.getByLabel(`Notiz für Artikel ${itemName}`)).toBeVisible();

    await page.getByRole('button', { name: 'Label Rot auswählen' }).click();
    await expect(page.locator('.detail-label-selected')).toContainText('Rot');

    await page.getByRole('button', { name: `Details für Artikel ${itemName} speichern` }).click();
    await expect(
      list.locator('.item').filter({ hasText: itemName }).locator('.item-label-text'),
    ).toHaveText('Rot');
  });
});
