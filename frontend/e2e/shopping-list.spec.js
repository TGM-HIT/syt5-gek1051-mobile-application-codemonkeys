import { test, expect } from '@playwright/test';

async function setupSession(page, name = 'E2EUser') {
  // Navigate to /login and wait for the form to render so the async
  // checkSession() in the router guard has fully completed and can no
  // longer overwrite localStorage.
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 10000 });

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

  // Fresh navigation — app reads auth_user from localStorage on init,
  // finds a valid user, skips checkSession(), and renders ShoppingList.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.add-list-form', { timeout: 10000 });
}

test.describe('U1: Listen verwalten', () => {
  test('zeigt Meldung wenn keine Listen vorhanden', async ({ page }) => {
    await setupSession(page);
    await expect(page.getByText('Keine Listen vorhanden')).toBeVisible();
  });

  test('erstellt eine neue Liste', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Einkaufsliste');
    await page.click('.add-list-form .add-btn');
    await expect(page.locator('.list').last().locator('h2')).toContainText('Einkaufsliste');
  });

  test('erstellt eine Liste mit Enter-Taste', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Wocheneinkauf');
    await page.press('.add-list-form .add-input', 'Enter');
    await expect(page.locator('.list').last().locator('h2')).toContainText('Wocheneinkauf');
  });

  test('ignoriert leere Listennamen', async ({ page }) => {
    await setupSession(page);
    await page.click('.add-list-form .add-btn');
    await expect(page.getByText('Keine Listen vorhanden')).toBeVisible();
  });

  test('zeigt den Besitzer der Liste', async ({ page }) => {
    await setupSession(page, 'OwnerUser');
    await page.fill('.add-list-form .add-input', 'Meine Liste');
    await page.click('.add-list-form .add-btn');
    await expect(page.locator('.list').last().locator('.list-meta')).toContainText('OwnerUser');
  });
});

test.describe('U2: Artikel verwalten', () => {
  let listName = '';

  test.beforeEach(async ({ page }) => {
    await setupSession(page);
    listName = `Testliste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await page.fill('.add-list-form .add-input', listName);
    await page.click('.add-list-form .add-btn');
    await expect(
      page.locator('.list').filter({ has: page.getByRole('heading', { name: listName }) }),
    ).toBeVisible();
  });

  test('fügt einen Artikel hinzu', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Milch');
    await list.locator('.add-item-form .add-btn').click();
    await expect(list.locator('.item').filter({ hasText: 'Milch' })).toBeVisible();
  });

  test('fügt Artikel mit Enter hinzu', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Brot');
    await list.locator('.add-item-form .add-input').press('Enter');
    await expect(list.locator('.item').filter({ hasText: 'Brot' })).toBeVisible();
  });

  test('toggelt den Checked-Status', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Eier');
    await list.locator('.add-item-form .add-btn').click();
    const item = list.locator('.item').filter({ hasText: 'Eier' });
    await item.locator('.checkbox').click();
    await expect(item).toHaveClass(/checked/);
  });

  test('markiert Artikel als gelöscht', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Käse');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.item').filter({ hasText: 'Käse' }).locator('.delete-item-btn').click();
    await expect(list.locator('.item').filter({ hasText: 'Käse' })).not.toBeVisible();
  });

  test('zeigt gelöschte Artikel im Gelöscht-Tab', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Joghurt');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.item').filter({ hasText: 'Joghurt' }).locator('.delete-item-btn').click();
    await list.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click();
    await expect(list.locator('.item-deleted').filter({ hasText: 'Joghurt' })).toBeVisible();
  });

  test('stellt gelöschten Artikel wieder her', async ({ page }) => {
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Butter');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.item').filter({ hasText: 'Butter' }).locator('.delete-item-btn').click();
    await list.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click();
    await list
      .locator('.item-deleted')
      .filter({ hasText: 'Butter' })
      .locator('.restore-item-btn')
      .click();
    await list.locator('.tab-btn').filter({ hasText: 'Aktiv' }).click();
    await expect(list.locator('.item').filter({ hasText: 'Butter' })).toBeVisible();
  });

  test('Daten bleiben nach Reload erhalten', async ({ page }) => {
    const list = page
      .locator('.list')
      .filter({ has: page.getByRole('heading', { name: listName }) });
    await list.locator('.add-item-form .add-input').fill('Apfel');
    await list.locator('.add-item-form .add-btn').click();
    await expect(list.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible();

    // Absichern, dass der Eintrag wirklich in IndexedDB persistiert ist,
    // bevor die Seite neu geladen wird.
    await expect
      .poll(async () => {
        return await page.evaluate(async () => {
          return await new Promise((resolve) => {
            try {
              const req = indexedDB.open('einkaufsliste_db');
              req.onerror = () => resolve(false);
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction('documents', 'readonly');
                const getAllReq = tx.objectStore('documents').getAll();
                getAllReq.onerror = () => resolve(false);
                getAllReq.onsuccess = () => {
                  const docs = getAllReq.result || [];
                  const exists = docs.some(
                    (doc) =>
                      doc?.type === 'item' &&
                      doc?.name === 'Apfel' &&
                      doc?.markedDeleted !== true &&
                      doc?.deleted !== true,
                  );
                  resolve(exists);
                };
              };
            } catch (_) {
              resolve(false);
            }
          });
        });
      })
      .toBe(true);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.locator('.message').filter({ hasText: 'Daten werden geladen...' }),
    ).not.toBeVisible();
    const reloadedList = page
      .locator('.list')
      .filter({ has: page.getByRole('heading', { name: listName }) });
    await expect(reloadedList).toBeVisible();
    await expect(reloadedList.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible();
  });
});

test.describe('U13: Suche', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Suchliste');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Apfel');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.add-item-form .add-input').fill('Banane');
    await list.locator('.add-item-form .add-btn').click();
  });

  test('filtert Artikel per Suche (dimmt nicht-matching)', async ({ page }) => {
    const list = page.locator('.list').last();
    // Suchleiste ist global, nicht innerhalb der Liste
    await page.locator('.search-input').fill('Apfel');
    await expect(list.locator('.item').filter({ hasText: 'Apfel' })).not.toHaveClass(
      /search-dimmed/,
    );
    await expect(list.locator('.item').filter({ hasText: 'Banane' })).toHaveClass(/search-dimmed/);
  });

  test('zeigt Clear-Button bei aktiver Suche', async ({ page }) => {
    await page.locator('.search-input').fill('test');
    await expect(page.locator('.search-clear-btn')).toBeVisible();
  });

  test('löscht Suche mit Clear-Button', async ({ page }) => {
    await page.locator('.search-input').fill('test');
    await page.locator('.search-clear-btn').click();
    await expect(page.locator('.search-input')).toHaveValue('');
    await expect(page.locator('.search-clear-btn')).not.toBeVisible();
  });
});

test.describe('U2: Fortschritt', () => {
  test('zeigt 0% bei leerer Liste', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste');
    await page.click('.add-list-form .add-btn');
    await expect(page.locator('.list').last().locator('.progress-text')).toContainText('0%');
  });

  test('aktualisiert Fortschritt nach Abhaken', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('Item 1');
    await list.locator('.add-item-form .add-btn').click();
    await list.locator('.item').filter({ hasText: 'Item 1' }).locator('.checkbox').click();
    await expect(list.locator('.progress-text')).toContainText('100%');
  });
});

test.describe('U6: Session Badge', () => {
  test('zeigt Session-Name im Header', async ({ page }) => {
    await setupSession(page, 'Alice');
    await expect(page.locator('.session-badge')).toContainText('Alice');
  });

  test('Badge ist rein informativ und öffnet kein Overlay', async ({ page }) => {
    await setupSession(page, 'Alice');
    await page.click('.session-badge');
    await expect(page.locator('.session-badge')).toContainText('Alice');
    await expect(page.locator('.session-overlay')).toHaveCount(0);
  });
});

test.describe('U11: Dark/Light Mode', () => {
  test('Theme-Toggle-Button ist sichtbar', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.theme-toggle-btn')).toBeVisible();
  });

  test('Theme-Toggle hat role="switch"', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.theme-toggle-btn')).toHaveAttribute('role', 'switch');
  });

  test('Klick auf Theme-Toggle wechselt zu Dark Mode', async ({ page }) => {
    await setupSession(page);
    // Light Mode ist Standard
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('.theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.theme-toggle-btn')).toHaveAttribute('aria-checked', 'true');
  });

  test('Zweiter Klick wechselt zurück zu Light Mode', async ({ page }) => {
    await setupSession(page);
    await page.locator('.theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.theme-toggle-btn')).toHaveAttribute('aria-checked', 'false');
  });

  test('Theme-Wahl bleibt nach Reload erhalten', async ({ page }) => {
    await setupSession(page);
    await page.locator('.theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForSelector('.theme-toggle-btn', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('Theme wird in localStorage gespeichert', async ({ page }) => {
    await setupSession(page);
    await page.locator('.theme-toggle-btn').click();
    const stored = await page.evaluate(() => localStorage.getItem('app-theme'));
    expect(stored).toBe('dark');
  });
});

test.describe('U1: Listen auf-/zuklappen', () => {
  test('Liste kann zugeklappt werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Klapptest');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill('TestItem');
    await list.locator('.add-item-form .add-btn').click();
    // Klick auf Header klappt zu
    await list.locator('.list-header').click();
    await expect(list.locator('.list-body')).not.toBeVisible();
  });

  test('Zugeklappte Liste kann wieder aufgeklappt werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'Klapptest2');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.list-header').click();
    await expect(list.locator('.list-body')).not.toBeVisible();
    await list.locator('.list-header').click();
    await expect(list.locator('.list-body')).toBeVisible();
  });
});

test.describe('U1: Inline-Editing', () => {
  test('Listenname kann bearbeitet werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'OriginalName');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.edit-list-btn').click();
    await list.locator('.edit-input').fill('NeuerName');
    await list.locator('.edit-save-btn').click();
    await expect(list.locator('h2')).toContainText('NeuerName');
  });

  test('Listenname-Bearbeitung kann abgebrochen werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'NichtÄndern');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.edit-list-btn').click();
    await list.locator('.edit-input').fill('WirdVerworfen');
    await list.locator('.edit-cancel-btn').click();
    await expect(list.locator('h2')).toContainText('NichtÄndern');
  });

  test('Artikelname kann bearbeitet werden', async ({ page }) => {
    await setupSession(page);
    const uniqueName = `Artikel-${Date.now()}`;
    const newName = `Umbenannt-${Date.now()}`;
    await page.fill('.add-list-form .add-input', 'EditListe');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.add-item-form .add-input').fill(uniqueName);
    await list.locator('.add-item-form .add-btn').click();
    const item = list.locator('.item').filter({ hasText: uniqueName });
    await item.locator('.edit-item-btn').click();
    await list.locator('.edit-input').fill(newName);
    await list.locator('.edit-save-btn').click();
    await expect(list.locator('.item').filter({ hasText: newName })).toBeVisible();
  });
});

test.describe('U7: Liste löschen', () => {
  test('zeigt Bestätigungsdialog beim Löschen einer leeren Liste', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'LöschTest');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.delete-list-btn').click();
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('löschen');
  });

  test('Bestätigungsdialog kann abgebrochen werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'AbbrechTest');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').last();
    await list.locator('.delete-list-btn').click();
    await page.locator('.modal-btn-cancel').click();
    await expect(page.locator('.modal')).not.toBeVisible();
    await expect(list.locator('h2')).toContainText('AbbrechTest');
  });

  test('leere Liste kann gelöscht werden', async ({ page }) => {
    await setupSession(page);
    await page.fill('.add-list-form .add-input', 'WirdGelöscht');
    await page.click('.add-list-form .add-btn');
    const list = page.locator('.list').filter({ hasText: 'WirdGelöscht' });
    await expect(list.locator('h2')).toContainText('WirdGelöscht');
    await list.locator('.delete-list-btn').click();
    // Schritt 1: Weiter
    await page.locator('.modal-btn-confirm').click();
    // Schritt 2: Ja, löschen
    await page.locator('.modal-btn-confirm').click();
    await expect(list).not.toBeVisible();
  });
});

test.describe('U6: Abmelden', () => {
  test('Abmelde-Button ist sichtbar', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.logout-btn')).toBeVisible();
  });

  test('Abmelden leitet auf Login-Seite weiter', async ({ page }) => {
    await setupSession(page);
    await page.locator('.logout-btn').click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('U9: Profil & Einstellungen', () => {
  test('Profil-Dialog öffnet sich mit Passwort-Feldern', async ({ page }) => {
    await setupSession(page, 'ProfilUser');
    await page.locator('.settings-btn').click();

    await expect(page.locator('.profile-modal')).toBeVisible();
    await expect(page.locator('#profile-current-password')).toBeVisible();
    await expect(page.locator('#profile-new-password')).toBeVisible();
    await expect(page.locator('#profile-confirm-password')).toBeVisible();
    await expect(page.locator('.profile-modal')).toContainText('ProfilUser');
  });

  test('zeigt Validierungsfehler bei nicht übereinstimmenden Passwörtern', async ({ page }) => {
    await setupSession(page);
    await page.locator('.settings-btn').click();

    await page.fill('#profile-current-password', 'altespasswort');
    await page.fill('#profile-new-password', 'neuespasswort123');
    await page.fill('#profile-confirm-password', 'anderespasswort123');
    await page.locator('.profile-form button[type="submit"]').click();

    await expect(page.locator('.profile-error')).toContainText('stimmen nicht überein');
  });

  test('Abmelden aus Profil-Dialog leitet auf Login-Seite weiter', async ({ page }) => {
    await setupSession(page);
    await page.locator('.settings-btn').click();
    await page.locator('.profile-logout-btn').click();

    await expect(page).toHaveURL('/login');
  });
});
