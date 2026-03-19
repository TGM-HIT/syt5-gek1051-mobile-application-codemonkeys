import { test, expect } from '@playwright/test'

async function setupSession(page, name = 'E2EUser') {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  
  // Clear storage
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  
  // Delete IndexedDB with timeout
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 2000)
      try {
        const req = indexedDB.deleteDatabase('einkaufsliste_db')
        req.onsuccess = () => { clearTimeout(timeout); resolve() }
        req.onerror = () => { clearTimeout(timeout); resolve() }
        req.onblocked = () => { clearTimeout(timeout); resolve() }
      } catch (e) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
  
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500) // Small delay for app to initialize
  
  await page.fill('.session-input', name)
  await page.click('.session-btn')
  await page.waitForSelector('.session-overlay', { state: 'hidden', timeout: 5000 })
}

test.describe('Listen verwalten', () => {
  test('zeigt Meldung wenn keine Listen vorhanden', async ({ page }) => {
    await setupSession(page)
    await expect(page.getByText('Keine Listen vorhanden')).toBeVisible()
  })

  test('erstellt eine neue Liste', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Einkaufsliste')
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.list').last().locator('h2')).toContainText('Einkaufsliste')
  })

  test('erstellt eine Liste mit Enter-Taste', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Wocheneinkauf')
    await page.press('.add-list-form .add-input', 'Enter')
    await expect(page.locator('.list').last().locator('h2')).toContainText('Wocheneinkauf')
  })

  test('ignoriert leere Listennamen', async ({ page }) => {
    await setupSession(page)
    await page.click('.add-list-form .add-btn')
    await expect(page.getByText('Keine Listen vorhanden')).toBeVisible()
  })

  test('zeigt den Besitzer der Liste', async ({ page }) => {
    await setupSession(page, 'OwnerUser')
    await page.fill('.add-list-form .add-input', 'Meine Liste')
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.list').last().locator('.list-meta')).toContainText('OwnerUser')
  })
})

test.describe('Artikel verwalten', () => {
  let listName = ''

  test.beforeEach(async ({ page }) => {
    await setupSession(page)
    listName = `Testliste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await page.fill('.add-list-form .add-input', listName)
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.list').filter({ has: page.getByRole('heading', { name: listName }) })).toBeVisible()
  })

  test('fügt einen Artikel hinzu', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Milch')
    await list.locator('.add-item-form .add-btn').click()
    await expect(list.locator('.item').filter({ hasText: 'Milch' })).toBeVisible()
  })

  test('fügt Artikel mit Enter hinzu', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Brot')
    await list.locator('.add-item-form .add-input').press('Enter')
    await expect(list.locator('.item').filter({ hasText: 'Brot' })).toBeVisible()
  })

  test('toggelt den Checked-Status', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Eier')
    await list.locator('.add-item-form .add-btn').click()
    const item = list.locator('.item').filter({ hasText: 'Eier' })
    await item.locator('.checkbox').click()
    await expect(item).toHaveClass(/checked/)
  })

  test('markiert Artikel als gelöscht', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Käse')
    await list.locator('.add-item-form .add-btn').click()
    await list.locator('.item').filter({ hasText: 'Käse' }).locator('.delete-item-btn').click()
    await expect(list.locator('.item').filter({ hasText: 'Käse' })).not.toBeVisible()
  })

  test('zeigt gelöschte Artikel im Gelöscht-Tab', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Joghurt')
    await list.locator('.add-item-form .add-btn').click()
    await list.locator('.item').filter({ hasText: 'Joghurt' }).locator('.delete-item-btn').click()
    await list.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click()
    await expect(list.locator('.item-deleted').filter({ hasText: 'Joghurt' })).toBeVisible()
  })

  test('stellt gelöschten Artikel wieder her', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Butter')
    await list.locator('.add-item-form .add-btn').click()
    await list.locator('.item').filter({ hasText: 'Butter' }).locator('.delete-item-btn').click()
    await list.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click()
    await list.locator('.item-deleted').filter({ hasText: 'Butter' }).locator('.restore-item-btn').click()
    await list.locator('.tab-btn').filter({ hasText: 'Aktiv' }).click()
    await expect(list.locator('.item').filter({ hasText: 'Butter' })).toBeVisible()
  })

  test('Daten bleiben nach Reload erhalten', async ({ page }) => {
    const list = page.locator('.list').filter({ has: page.getByRole('heading', { name: listName }) })
    await list.locator('.add-item-form .add-input').fill('Apfel')
    await list.locator('.add-item-form .add-btn').click()
    await expect(list.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible()
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.message').filter({ hasText: 'Daten werden geladen...' })).not.toBeVisible()
    const reloadedList = page.locator('.list').filter({ has: page.getByRole('heading', { name: listName }) })
    await expect(reloadedList.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible()
  })
})

test.describe('Suche', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Suchliste')
    await page.click('.add-list-form .add-btn')
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Apfel')
    await list.locator('.add-item-form .add-btn').click()
    await list.locator('.add-item-form .add-input').fill('Banane')
    await list.locator('.add-item-form .add-btn').click()
  })

  test.skip('filtert Artikel per Suche (dimmt nicht-matching)', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('input[placeholder*="Suche"]').fill('Apfel')
    await expect(list.locator('.item').filter({ hasText: 'Apfel' })).not.toHaveClass(/search-dimmed/)
    await expect(list.locator('.item').filter({ hasText: 'Banane' })).toHaveClass(/search-dimmed/)
  })

  test.skip('zeigt Clear-Button bei aktiver Suche', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('input[placeholder*="Suche"]').fill('test')
    await expect(list.locator('.search-clear-btn')).toBeVisible()
  })

  test.skip('löscht Suche mit Clear-Button', async ({ page }) => {
    const list = page.locator('.list').last()
    await list.locator('input[placeholder*="Suche"]').fill('test')
    await list.locator('.search-clear-btn').click()
    await expect(list.locator('input[placeholder*="Suche"]')).toHaveValue('')
    await expect(list.locator('.search-clear-btn')).not.toBeVisible()
  })
})

test.describe('Fortschritt', () => {
  test('zeigt 0% bei leerer Liste', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste')
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.list').last().locator('.progress-text')).toContainText('0%')
  })

  test('aktualisiert Fortschritt nach Abhaken', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste')
    await page.click('.add-list-form .add-btn')
    const list = page.locator('.list').last()
    await list.locator('.add-item-form .add-input').fill('Item 1')
    await list.locator('.add-item-form .add-btn').click()
    await list.locator('.item').filter({ hasText: 'Item 1' }).locator('.checkbox').click()
    await expect(list.locator('.progress-text')).toContainText('100%')
  })
})

test.describe('Session Badge', () => {
  test('zeigt Session-Name im Header', async ({ page }) => {
    await setupSession(page, 'Alice')
    await expect(page.locator('.session-badge')).toContainText('Alice')
  })

  test('beendet Session bei Klick auf Badge', async ({ page }) => {
    await setupSession(page, 'Alice')
    await page.click('.session-badge')
    await expect(page.locator('.session-overlay')).toBeVisible()
  })
})
