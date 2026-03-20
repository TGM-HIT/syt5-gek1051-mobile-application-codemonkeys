const fs = require('fs');
const path = require('path');

const e2eDir = path.join(__dirname, 'frontend', 'e2e');
if (!fs.existsSync(e2eDir)) {
  fs.mkdirSync(e2eDir, { recursive: true });
  console.log('✓ Created directory:', e2eDir);
} else {
  console.log('✓ Directory already exists:', e2eDir);
}

const testFiles = {
  'session-setup.spec.js': `import { test, expect } from '@playwright/test'

test.describe('Session Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('zeigt das Session-Modal beim ersten Besuch', async ({ page }) => {
    await expect(page.locator('.session-overlay')).toBeVisible()
    await expect(page.locator('.session-modal h2')).toContainText('Willkommen')
    await expect(page.locator('.session-input')).toBeVisible()
  })

  test('Button ist deaktiviert solange kein Name eingegeben ist', async ({ page }) => {
    await expect(page.locator('.session-btn')).toBeDisabled()
    await page.fill('.session-input', '   ')
    await expect(page.locator('.session-btn')).toBeDisabled()
  })

  test('öffnet die App nach Namenseingabe', async ({ page }) => {
    await page.fill('.session-input', 'TestUser')
    await page.click('.session-btn')
    await expect(page.locator('.session-overlay')).not.toBeVisible()
    const sessionName = await page.evaluate(() => localStorage.getItem('einkaufsliste_session_name'))
    expect(sessionName).toBe('TestUser')
  })

  test('akzeptiert Enter zum Bestätigen', async ({ page }) => {
    await page.fill('.session-input', 'EnterUser')
    await page.press('.session-input', 'Enter')
    await expect(page.locator('.session-overlay')).not.toBeVisible()
  })

  test('trimmt Whitespace vom Namen', async ({ page }) => {
    await page.fill('.session-input', '  TrimUser  ')
    await page.click('.session-btn')
    const sessionName = await page.evaluate(() => localStorage.getItem('einkaufsliste_session_name'))
    expect(sessionName).toBe('TrimUser')
  })

  test('Session bleibt nach Reload erhalten', async ({ page }) => {
    await page.fill('.session-input', 'PersistUser')
    await page.click('.session-btn')
    await page.reload()
    await expect(page.locator('.session-overlay')).not.toBeVisible()
  })

  test('hält maxlength von 30 Zeichen ein', async ({ page }) => {
    await page.fill('.session-input', 'A'.repeat(50))
    const value = await page.inputValue('.session-input')
    expect(value.length).toBeLessThanOrEqual(30)
  })
})
`,

  'shopping-list.spec.js': `import { test, expect } from '@playwright/test'

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
    await expect(page.locator('.list h2')).toContainText('Einkaufsliste')
  })

  test('erstellt eine Liste mit Enter-Taste', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Wocheneinkauf')
    await page.press('.add-list-form .add-input', 'Enter')
    await expect(page.locator('.list h2')).toContainText('Wocheneinkauf')
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
    await expect(page.locator('.list-meta')).toContainText('OwnerUser')
  })
})

test.describe('Artikel verwalten', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Testliste')
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.list')).toBeVisible()
  })

  test('fügt einen Artikel hinzu', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Milch')
    await page.click('.add-item-form .add-btn')
    await expect(page.locator('.item').filter({ hasText: 'Milch' })).toBeVisible()
  })

  test('fügt Artikel mit Enter hinzu', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Brot')
    await page.press('.add-item-form .add-input', 'Enter')
    await expect(page.locator('.item').filter({ hasText: 'Brot' })).toBeVisible()
  })

  test('toggelt den Checked-Status', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Eier')
    await page.click('.add-item-form .add-btn')
    const item = page.locator('.item').filter({ hasText: 'Eier' })
    await item.locator('.checkbox').click()
    await expect(item).toHaveClass(/checked/)
  })

  test('markiert Artikel als gelöscht', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Käse')
    await page.click('.add-item-form .add-btn')
    await page.locator('.item').filter({ hasText: 'Käse' }).locator('.delete-item-btn').click()
    await expect(page.locator('.item').filter({ hasText: 'Käse' })).not.toBeVisible()
  })

  test('zeigt gelöschte Artikel im Gelöscht-Tab', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Joghurt')
    await page.click('.add-item-form .add-btn')
    await page.locator('.item').filter({ hasText: 'Joghurt' }).locator('.delete-item-btn').click()
    await page.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click()
    await expect(page.locator('.item-deleted').filter({ hasText: 'Joghurt' })).toBeVisible()
  })

  test('stellt gelöschten Artikel wieder her', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Butter')
    await page.click('.add-item-form .add-btn')
    await page.locator('.item').filter({ hasText: 'Butter' }).locator('.delete-item-btn').click()
    await page.locator('.tab-btn').filter({ hasText: 'Gelöscht' }).click()
    await page.locator('.item-deleted').filter({ hasText: 'Butter' }).locator('.restore-item-btn').click()
    await page.locator('.tab-btn').filter({ hasText: 'Aktiv' }).click()
    await expect(page.locator('.item').filter({ hasText: 'Butter' })).toBeVisible()
  })

  test('Daten bleiben nach Reload erhalten', async ({ page }) => {
    await page.fill('.add-item-form .add-input', 'Apfel')
    await page.click('.add-item-form .add-btn')
    await expect(page.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible()
    await expect.poll(async () => {
      return await page.evaluate(async () => {
        return await new Promise((resolve) => {
          try {
            const req = indexedDB.open('einkaufsliste_db')
            req.onerror = () => resolve(false)
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction('documents', 'readonly')
              const getAllReq = tx.objectStore('documents').getAll()
              getAllReq.onerror = () => resolve(false)
              getAllReq.onsuccess = () => {
                const docs = getAllReq.result || []
                const exists = docs.some((doc) =>
                  doc?.type === 'item' &&
                  doc?.name === 'Apfel' &&
                  doc?.markedDeleted !== true &&
                  doc?.deleted !== true
                )
                resolve(exists)
              }
            }
          } catch (_) {
            resolve(false)
          }
        })
      })
    }).toBe(true)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.message').filter({ hasText: 'Daten werden geladen...' })).not.toBeVisible()
    await expect(page.locator('.item').filter({ hasText: 'Apfel' })).toBeVisible()
  })
})

test.describe('Suche', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Suchliste')
    await page.click('.add-list-form .add-btn')
    await page.fill('.add-item-form .add-input', 'Apfel')
    await page.click('.add-item-form .add-btn')
    await page.fill('.add-item-form .add-input', 'Banane')
    await page.click('.add-item-form .add-btn')
  })

  test('filtert Artikel per Suche (dimmt nicht-matching)', async ({ page }) => {
    await page.fill('.search-input', 'Apfel')
    await expect(page.locator('.item').filter({ hasText: 'Apfel' })).not.toHaveClass(/search-dimmed/)
    await expect(page.locator('.item').filter({ hasText: 'Banane' })).toHaveClass(/search-dimmed/)
  })

  test('zeigt Clear-Button bei aktiver Suche', async ({ page }) => {
    await page.fill('.search-input', 'test')
    await expect(page.locator('.search-clear-btn')).toBeVisible()
  })

  test('löscht Suche mit Clear-Button', async ({ page }) => {
    await page.fill('.search-input', 'test')
    await page.click('.search-clear-btn')
    await expect(page.locator('.search-input')).toHaveValue('')
    await expect(page.locator('.search-clear-btn')).not.toBeVisible()
  })
})

test.describe('Fortschritt', () => {
  test('zeigt 0% bei leerer Liste', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste')
    await page.click('.add-list-form .add-btn')
    await expect(page.locator('.progress-text')).toContainText('0%')
  })

  test('aktualisiert Fortschritt nach Abhaken', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Fortschrittsliste')
    await page.click('.add-list-form .add-btn')
    await page.fill('.add-item-form .add-input', 'Item 1')
    await page.click('.add-item-form .add-btn')
    await page.locator('.item').filter({ hasText: 'Item 1' }).locator('.checkbox').click()
    await expect(page.locator('.progress-text')).toContainText('100%')
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
`,

  'sharing.spec.js': `import { test, expect } from '@playwright/test'

async function setupSession(page, name = 'ShareUser') {
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

test.describe('Liste teilen', () => {
  test('öffnet den Share-Dialog', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Geteilte Liste')
    await page.click('.add-list-form .add-btn')
    await page.click('.share-list-btn')
    await expect(page.locator('.share-modal')).toBeVisible()
    await expect(page.getByText('Liste teilen')).toBeVisible()
  })

  test('generiert einen 6-stelligen Share-Code', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Code Liste')
    await page.click('.add-list-form .add-btn')
    await page.click('.share-list-btn')
    await page.waitForSelector('.share-code', { timeout: 5000 })
    const code = await page.locator('.share-code').textContent()
    expect(code?.trim().length).toBe(6)
    expect(code?.trim()).toMatch(/^[A-Z2-9]{6}$/)
  })

  test('schließt den Share-Dialog', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Modal Test')
    await page.click('.add-list-form .add-btn')
    await page.click('.share-list-btn')
    await expect(page.locator('.share-modal')).toBeVisible()
    await page.locator('.modal-btn-cancel').click()
    await expect(page.locator('.share-modal')).not.toBeVisible()
  })

  test('zeigt Join-Input-Feld', async ({ page }) => {
    await setupSession(page)
    await expect(page.locator('.join-input')).toBeVisible()
    await expect(page.locator('.join-btn')).toBeVisible()
  })

  test('zeigt Fehler bei leerem Code', async ({ page }) => {
    await setupSession(page)
    await page.click('.join-btn')
    await expect(page.locator('.join-message')).toBeVisible()
    await expect(page.locator('.join-message')).toHaveClass(/error/)
  })

  test('zeigt Fehler bei nicht gefundenem Code', async ({ page }) => {
    await setupSession(page)
    await page.fill('.join-input', 'XXXYYY')
    await page.click('.join-btn')
    await expect(page.locator('.join-message')).toBeVisible()
    await expect(page.locator('.join-message')).toHaveClass(/error/)
  })

  test('zeigt Fehler wenn Liste bereits vorhanden', async ({ page }) => {
    await setupSession(page)
    await page.fill('.add-list-form .add-input', 'Eigene Liste')
    await page.click('.add-list-form .add-btn')
    await page.click('.share-list-btn')
    await page.waitForSelector('.share-code', { timeout: 5000 })
    const code = await page.locator('.share-code').textContent()
    await page.locator('.modal-btn-cancel').click()
    await page.fill('.join-input', code?.trim() || '')
    await page.click('.join-btn')
    await expect(page.locator('.join-message')).toHaveClass(/error/)
  })
})
`
};

console.log('\nCreating E2E test files...');
let fileCount = 0;

for (const [filename, content] of Object.entries(testFiles)) {
  const filepath = path.join(e2eDir, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('✓ Created: ' + filename);
  fileCount++;
}

console.log('\n✓ Successfully created ' + fileCount + ' E2E test files!\n');
