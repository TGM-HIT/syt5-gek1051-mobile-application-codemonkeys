/**
 * E2E-Tests für Benachrichtigungen (Body-Header UI)
 *  - Status-Indikator ist sichtbar
 *  - PWA-Install-Button ist immer sichtbar
 *  - Notification-Toggle: Standardzustand, Ein/Aus-Wechsel
 *  - Erlaubnis-Flow: "Aktivieren"-Button wenn Berechtigung noch offen
 *
 * Hinweis: Headless Chromium startet mit Notification.permission = 'denied'.
 * Wir mocken den Wert via addInitScript BEVOR die Seite lädt, damit die
 * Vue-Komponente beim Mount den richtigen Zustand liest.
 *
 * OS-Benachrichtigungen (showOsNotification, generateNotifications) werden in
 * pwa-notifications.test.js und notifications-toggle.test.js als Unit-Tests
 * abgedeckt.
 */

import { test, expect } from '@playwright/test';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function setupSession(page, name = 'NotifUser') {
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

/**
 * Mockt Notification.permission via addInitScript BEVOR die Seite lädt.
 * addInitScript läuft bei jeder Navigation (inkl. der goto('/') in setupSession).
 */
async function setupSessionWithNotificationPermission(page, permission, name = 'NotifUser') {
  await page.addInitScript((perm) => {
    // Warten bis Notification verfügbar ist, dann permission überschreiben
    if (typeof Notification !== 'undefined') {
      try {
        Object.defineProperty(Notification, 'permission', {
          get: () => perm,
          configurable: true,
        });
      } catch {
        // Falls nicht überschreibbar – ignorieren
      }
    }
  }, permission);

  await setupSession(page, name);
}

// ── Body-Header: Status-Indikator ─────────────────────────────────────────────

test.describe('Body-Header: Online/Offline-Status', () => {
  test('zeigt den Status-Indikator im Body-Header', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.body-header .status-indicator')).toBeVisible();
  });

  test('Status-Indikator hat die Klasse "online" oder "offline"', async ({ page }) => {
    await setupSession(page);
    const hasClass = await page.locator('.body-header .status-indicator').evaluate(
      (el) => el.classList.contains('online') || el.classList.contains('offline'),
    );
    expect(hasClass).toBe(true);
  });

  test('Status-Text zeigt "Online" oder "Offline"', async ({ page }) => {
    await setupSession(page);
    const text = await page.locator('.body-header .status-text').textContent();
    expect(['Online', 'Offline']).toContain(text?.trim());
  });
});

// ── Body-Header: PWA-Install-Button ──────────────────────────────────────────

test.describe('Body-Header: PWA-Install-Button', () => {
  test('ist immer sichtbar (auch ohne Install-Prompt)', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.body-header .pwa-install-btn')).toBeVisible();
  });

  test('zeigt "App installiert" wenn kein Install-Prompt verfügbar', async ({ page }) => {
    await setupSession(page);
    const text = await page.locator('.body-header .pwa-install-btn').textContent();
    expect(text?.trim()).toContain('App installiert');
  });

  test('ist deaktiviert wenn kein Install-Prompt verfügbar', async ({ page }) => {
    await setupSession(page);
    await expect(page.locator('.body-header .pwa-install-btn')).toBeDisabled();
  });
});

// ── Body-Header: Notification-Toggle (permission = 'granted') ────────────────

test.describe('Body-Header: Notification-Toggle (permission granted)', () => {
  test('zeigt den Toggle-Button wenn Berechtigung erteilt ist', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    await expect(page.locator('.body-header .notif-toggle-btn')).toBeVisible();
  });

  test('Toggle-Button zeigt initial "Benachrichtigungen an"', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    const btn = page.locator('.body-header .notif-toggle-btn');
    await expect(btn).toContainText('Benachrichtigungen an');
    await expect(btn).toHaveClass(/notif-on/);
  });

  test('nach Klick wechselt Toggle auf "Benachrichtigungen aus"', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    const btn = page.locator('.body-header .notif-toggle-btn');
    await btn.click();
    await expect(btn).toContainText('Benachrichtigungen aus');
    await expect(btn).toHaveClass(/notif-off/);
  });

  test('erneuter Klick aktiviert Benachrichtigungen wieder', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    const btn = page.locator('.body-header .notif-toggle-btn');
    await btn.click();
    await btn.click();
    await expect(btn).toContainText('Benachrichtigungen an');
    await expect(btn).toHaveClass(/notif-on/);
  });

  test('Toggle-Button hat aria-pressed="true" wenn aktiv', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    await expect(page.locator('.body-header .notif-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Toggle-Button hat aria-pressed="false" nach Deaktivierung', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'granted');
    const btn = page.locator('.body-header .notif-toggle-btn');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Body-Header: Berechtigung ausstehend (permission = 'default') ─────────────

test.describe('Body-Header: Benachrichtigungen – Berechtigung ausstehend', () => {
  test('zeigt "Aktivieren"-Button wenn Berechtigung noch nicht erteilt', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'default');
    await expect(page.locator('.body-header .notif-enable-btn')).toBeVisible();
  });

  test('"Aktivieren"-Button enthält den Text "Aktivieren"', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'default');
    await expect(page.locator('.body-header .notif-enable-btn')).toContainText('Aktivieren');
  });
});

// ── Body-Header: Berechtigung verweigert (permission = 'denied') ──────────────

test.describe('Body-Header: Benachrichtigungen – Berechtigung verweigert', () => {
  test('zeigt "Blockiert"-Hinweis wenn Berechtigung verweigert', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'denied');
    await expect(page.locator('.body-header .notif-denied-hint')).toBeVisible();
    await expect(page.locator('.body-header .notif-denied-hint')).toContainText('Blockiert');
  });

  test('zeigt keinen Toggle-Button wenn Berechtigung verweigert', async ({ page }) => {
    await setupSessionWithNotificationPermission(page, 'denied');
    await expect(page.locator('.body-header .notif-toggle-btn')).not.toBeVisible();
  });
});
