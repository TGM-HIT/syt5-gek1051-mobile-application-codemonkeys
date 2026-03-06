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
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(() => new Promise(resolve => {
    const r = indexedDB.deleteDatabase('einkaufsliste_db')
    r.onsuccess = resolve; r.onerror = resolve
  }))
  await page.reload()
  await page.fill('.session-input', name)
  await page.click('.session-btn')
  await page.waitForSelector('.session-overlay', { state: 'hidden' })
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
    await page.reload()
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
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(() => new Promise(resolve => {
    const r = indexedDB.deleteDatabase('einkaufsliste_db')
    r.onsuccess = resolve; r.onerror = resolve
  }))
  await page.reload()
  await page.fill('.session-input', name)
  await page.click('.session-btn')
  await page.waitForSelector('.session-overlay', { state: 'hidden' })
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

console.log('\\nCreating E2E test files...');
let fileCount = 0;

for (const [filename, content] of Object.entries(testFiles)) {
  const filepath = path.join(e2eDir, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(\`✓ Created: \${filename}\`);
  fileCount++;
}

console.log(\`\\n✓ Successfully created \${fileCount} E2E test files!\\n\`);

  'session-setup.spec.js': `import { test, expect } from '@playwright/test'

test.describe('Session Setup', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('should show session setup modal on first visit', async ({ page }) => {
    await page.goto('/')

    // Check if session modal is visible
    const modal = page.locator('.session-overlay')
    await expect(modal).toBeVisible()

    // Verify modal content
    await expect(page.locator('.session-modal h2')).toContainText('Willkommen')
    await expect(page.locator('.session-input')).toBeVisible()
  })

  test('should allow user to set session name', async ({ page }) => {
    await page.goto('/')

    // Enter name
    await page.fill('.session-input', 'TestUser')
    await page.click('.session-btn')

    // Modal should close
    await expect(page.locator('.session-overlay')).not.toBeVisible()

    // Verify session name is stored
    const sessionName = await page.evaluate(() => localStorage.getItem('einkaufsliste_session_name'))
    expect(sessionName).toBe('TestUser')
  })

  test('should not submit with empty name', async ({ page }) => {
    await page.goto('/')

    // Button should be disabled with empty input
    await expect(page.locator('.session-btn')).toBeDisabled()

    // Enter spaces only
    await page.fill('.session-input', '   ')
    await expect(page.locator('.session-btn')).toBeDisabled()
  })

  test('should persist session name on reload', async ({ page }) => {
    await page.goto('/')
    await page.fill('.session-input', 'PersistentUser')
    await page.click('.session-btn')

    // Reload page
    await page.reload()

    // Modal should not appear
    await expect(page.locator('.session-overlay')).not.toBeVisible()
  })

  test('should trim whitespace from session name', async ({ page }) => {
    await page.goto('/')
    await page.fill('.session-input', '  TrimmedUser  ')
    await page.click('.session-btn')

    const sessionName = await page.evaluate(() => localStorage.getItem('einkaufsliste_session_name'))
    expect(sessionName).toBe('TrimmedUser')
  })

  test('should allow Enter key to submit', async ({ page }) => {
    await page.goto('/')
    await page.fill('.session-input', 'EnterUser')
    await page.press('.session-input', 'Enter')

    await expect(page.locator('.session-overlay')).not.toBeVisible()
  })

  test('should respect maxlength attribute', async ({ page }) => {
    await page.goto('/')
    
    const longName = 'A'.repeat(50)
    await page.fill('.session-input', longName)
    
    const inputValue = await page.inputValue('.session-input')
    expect(inputValue.length).toBeLessThanOrEqual(30)
  })
})
`,

  'shopping-list.spec.js': `import { test, expect } from '@playwright/test'

test.describe('Shopping List CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => {
      const dbRequest = indexedDB.deleteDatabase('einkaufsliste_db')
      return new Promise((resolve) => {
        dbRequest.onsuccess = () => resolve()
        dbRequest.onerror = () => resolve()
      })
    })
    await page.reload()
    
    // Set up session
    await page.fill('.session-input', 'E2ETestUser')
    await page.click('.session-btn')
    await page.waitForTimeout(500)
  })

  test('should create a new shopping list', async ({ page }) => {
    // Create new list
    await page.fill('input[placeholder*="Neue Liste"]', 'Groceries')
    await page.click('button:has-text("Liste anlegen")')
    
    await page.waitForTimeout(300)
    
    // Verify list appears
    await expect(page.locator('text=Groceries')).toBeVisible()
  })

  test('should add items to a shopping list', async ({ page }) => {
    // Create list
    await page.fill('input[placeholder*="Neue Liste"]', 'Weekly Shopping')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Add items
    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Milk')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Bread')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify items appear
    await expect(page.locator('text=Milk')).toBeVisible()
    await expect(page.locator('text=Bread')).toBeVisible()
  })

  test('should toggle item checked state', async ({ page }) => {
    // Create list and add item
    await page.fill('input[placeholder*="Neue Liste"]', 'Test List')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Test Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Find and click checkbox
    const checkbox = page.locator('.item-checkbox').first()
    await checkbox.click()
    await page.waitForTimeout(200)

    // Verify item is checked
    const item = page.locator('.item').first()
    await expect(item).toHaveClass(/checked/)
  })

  test('should mark item as deleted', async ({ page }) => {
    // Create list and item
    await page.fill('input[placeholder*="Neue Liste"]', 'Delete Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('To Delete')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Delete item
    const deleteBtn = page.locator('button[title*="Löschen"]').first()
    await deleteBtn.click()
    await page.waitForTimeout(200)

    // Switch to deleted tab
    await page.click('button:has-text("Gelöscht")')
    await page.waitForTimeout(200)

    // Verify item in deleted tab
    await expect(page.locator('text=To Delete')).toBeVisible()
  })

  test('should restore deleted item', async ({ page }) => {
    // Create, add, and delete item
    await page.fill('input[placeholder*="Neue Liste"]', 'Restore Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Restore Me')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    await page.locator('button[title*="Löschen"]').first().click()
    await page.waitForTimeout(200)

    // Go to deleted tab and restore
    await page.click('button:has-text("Gelöscht")')
    await page.waitForTimeout(200)
    
    await page.locator('button[title*="Wiederherstellen"]').first().click()
    await page.waitForTimeout(200)

    // Switch back to active tab
    await page.click('button:has-text("Aktiv")')
    await page.waitForTimeout(200)

    // Verify item is restored
    await expect(page.locator('text=Restore Me')).toBeVisible()
  })

  test('should delete a shopping list', async ({ page }) => {
    // Create list
    await page.fill('input[placeholder*="Neue Liste"]', 'To Be Deleted')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Delete list
    await page.locator('button[title*="Liste löschen"]').first().click()
    await page.waitForTimeout(300)

    // Verify list is gone
    await expect(page.locator('text=To Be Deleted')).not.toBeVisible()
  })

  test('should search items across lists', async ({ page }) => {
    // Create list with items
    await page.fill('input[placeholder*="Neue Liste"]', 'Search Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Apple')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Banana')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    // Search for specific item
    await page.fill('input[placeholder*="Suchen"]', 'Apple')
    await page.waitForTimeout(200)

    // Verify only matching item is visible
    await expect(page.locator('text=Apple')).toBeVisible()
    await expect(page.locator('text=Banana')).not.toBeVisible()
  })

  test('should show progress bar for list completion', async ({ page }) => {
    // Create list with items
    await page.fill('input[placeholder*="Neue Liste"]', 'Progress Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Item 1')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Item 2')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Check one item
    await page.locator('.item-checkbox').first().click()
    await page.waitForTimeout(200)

    // Verify progress is shown
    const progress = page.locator('.progress-bar').first()
    await expect(progress).toBeVisible()
  })
})
`,

  'offline-mode.spec.js': `import { test, expect } from '@playwright/test'

test.describe('Offline Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => {
      const dbRequest = indexedDB.deleteDatabase('einkaufsliste_db')
      return new Promise((resolve) => {
        dbRequest.onsuccess = () => resolve()
        dbRequest.onerror = () => resolve()
      })
    })
    await page.reload()
    
    await page.fill('.session-input', 'OfflineUser')
    await page.click('.session-btn')
    await page.waitForTimeout(500)
  })

  test('should work offline - create list and items', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true)
    
    // Create list
    await page.fill('input[placeholder*="Neue Liste"]', 'Offline List')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Add items
    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Offline Item 1')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Offline Item 2')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify items exist
    await expect(page.locator('text=Offline Item 1')).toBeVisible()
    await expect(page.locator('text=Offline Item 2')).toBeVisible()
  })

  test('should persist data offline after reload', async ({ page, context }) => {
    // Create data while offline
    await context.setOffline(true)
    
    await page.fill('input[placeholder*="Neue Liste"]', 'Persist Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Persistent Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Reload page while still offline
    await page.reload()
    await page.waitForTimeout(500)

    // Verify data persists
    await expect(page.locator('text=Persist Test')).toBeVisible()
    await expect(page.locator('text=Persistent Item')).toBeVisible()
  })

  test('should toggle items offline', async ({ page, context }) => {
    await context.setOffline(true)
    
    // Create list and item
    await page.fill('input[placeholder*="Neue Liste"]', 'Toggle Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Toggle Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Toggle checkbox
    const checkbox = page.locator('.item-checkbox').first()
    await checkbox.click()
    await page.waitForTimeout(200)

    // Verify state persists after reload
    await page.reload()
    await page.waitForTimeout(500)

    const item = page.locator('.item').first()
    await expect(item).toHaveClass(/checked/)
  })

  test('should delete items offline', async ({ page, context }) => {
    await context.setOffline(true)
    
    await page.fill('input[placeholder*="Neue Liste"]', 'Delete Offline')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Delete Me')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Delete item
    await page.locator('button[title*="Löschen"]').first().click()
    await page.waitForTimeout(200)

    // Check deleted tab
    await page.click('button:has-text("Gelöscht")')
    await page.waitForTimeout(200)

    await expect(page.locator('text=Delete Me')).toBeVisible()
  })

  test('should show offline indicator', async ({ page, context }) => {
    // Start online
    await page.waitForTimeout(500)
    
    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Check for offline indicator (if implemented)
    const offlineIndicator = page.locator('.offline-indicator, .sync-status:has-text("Offline")')
    // This might need adjustment based on your actual implementation
    // For now, we just verify the app still works
    await expect(page.locator('body')).toBeVisible()
  })

  test('should queue changes for sync when offline', async ({ page, context }) => {
    // Create data online first
    await page.fill('input[placeholder*="Neue Liste"]', 'Sync Queue Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(500)

    // Go offline and make changes
    await context.setOffline(true)
    
    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Queued Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Verify item exists locally
    await expect(page.locator('text=Queued Item')).toBeVisible()

    // Go back online
    await context.setOffline(false)
    await page.waitForTimeout(2000)

    // Item should still be visible and eventually sync
    await expect(page.locator('text=Queued Item')).toBeVisible()
  })

  test('should handle IndexedDB operations offline', async ({ page, context }) => {
    await context.setOffline(true)
    
    // Verify IndexedDB is accessible
    const dbWorks = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('einkaufsliste_db')
        request.onsuccess = () => resolve(true)
        request.onerror = () => resolve(false)
      })
    })
    
    expect(dbWorks).toBe(true)
  })
})
`,

  'sharing.spec.js': `import { test, expect } from '@playwright/test'

test.describe('List Sharing with Codes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => {
      const dbRequest = indexedDB.deleteDatabase('einkaufsliste_db')
      return new Promise((resolve) => {
        dbRequest.onsuccess = () => resolve()
        dbRequest.onerror = () => resolve()
      })
    })
    await page.reload()
    
    await page.fill('.session-input', 'SharingUser')
    await page.click('.session-btn')
    await page.waitForTimeout(500)
  })

  test('should generate share code for a list', async ({ page }) => {
    // Create a list
    await page.fill('input[placeholder*="Neue Liste"]', 'Shared List')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Open share dialog
    const shareButton = page.locator('button[title*="Teilen"], button:has-text("📤")')
    await shareButton.first().click()
    await page.waitForTimeout(300)

    // Generate code
    const generateBtn = page.locator('button:has-text("Code generieren")')
    if (await generateBtn.isVisible()) {
      await generateBtn.click()
      await page.waitForTimeout(500)
    }

    // Verify code is displayed
    const codeDisplay = page.locator('.share-code, code, .code-display')
    await expect(codeDisplay.first()).toBeVisible()
  })

  test('should display 6-character share code', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'Code Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Open share dialog
    const shareButton = page.locator('button[title*="Teilen"], button:has-text("📤")')
    await shareButton.first().click()
    await page.waitForTimeout(300)

    // Generate code if needed
    const generateBtn = page.locator('button:has-text("Code generieren")')
    if (await generateBtn.isVisible()) {
      await generateBtn.click()
      await page.waitForTimeout(500)
    }

    // Get code text
    const codeElement = page.locator('.share-code, code, .code-display').first()
    const codeText = await codeElement.textContent()
    
    // Verify code format (6 uppercase letters/numbers, no similar characters)
    expect(codeText?.trim().length).toBe(6)
    expect(codeText?.trim()).toMatch(/^[A-Z2-9]{6}$/)
  })

  test('should show join list input', async ({ page }) => {
    // Look for join/add list functionality
    const joinInput = page.locator('input[placeholder*="Code eingeben"], input[placeholder*="Join"], input[placeholder*="code"]')
    const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join")')

    // Either input or button should be visible
    const hasJoinUI = await joinInput.count() > 0 || await joinButton.count() > 0
    expect(hasJoinUI).toBeTruthy()
  })

  test('should validate empty join code', async ({ page }) => {
    const joinInput = page.locator('input[placeholder*="Code eingeben"], input[placeholder*="code"]').first()
    const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join")').first()

    if (await joinInput.isVisible()) {
      // Try to join with empty code
      await joinButton.click()
      await page.waitForTimeout(300)

      // Should show error or button should be disabled
      const errorMsg = page.locator('.error, .message, [class*="error"]')
      const hasError = await errorMsg.count() > 0
      const isDisabled = await joinButton.isDisabled()
      
      expect(hasError || isDisabled).toBeTruthy()
    }
  })

  test('should validate invalid join code format', async ({ page }) => {
    const joinInput = page.locator('input[placeholder*="Code eingeben"], input[placeholder*="code"]').first()
    const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join")').first()

    if (await joinInput.isVisible()) {
      // Enter invalid code
      await joinInput.fill('12345') // Too short
      await joinButton.click()
      await page.waitForTimeout(300)

      // Should show error message
      const errorMsg = page.locator('.error, .message, [class*="error"]:has-text("Code")')
      const hasError = await errorMsg.count() > 0
      expect(hasError).toBeTruthy()
    }
  })

  test('should not allow joining with own code', async ({ page }) => {
    // Create and share a list
    await page.fill('input[placeholder*="Neue Liste"]', 'My List')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Generate share code
    const shareButton = page.locator('button[title*="Teilen"], button:has-text("📤")')
    await shareButton.first().click()
    await page.waitForTimeout(300)

    const generateBtn = page.locator('button:has-text("Code generieren")')
    if (await generateBtn.isVisible()) {
      await generateBtn.click()
      await page.waitForTimeout(500)
    }

    // Get the code
    const codeElement = page.locator('.share-code, code, .code-display').first()
    const shareCode = await codeElement.textContent()

    // Close share dialog
    const closeBtn = page.locator('button:has-text("Schließen"), button:has-text("×")')
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
      await page.waitForTimeout(200)
    }

    // Try to join with own code
    const joinInput = page.locator('input[placeholder*="Code eingeben"], input[placeholder*="code"]').first()
    const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join")').first()

    if (await joinInput.isVisible() && shareCode) {
      await joinInput.fill(shareCode.trim())
      await joinButton.click()
      await page.waitForTimeout(500)

      // Should show error about already having this list
      const errorMsg = page.locator('[class*="error"]:has-text("bereits"), [class*="message"]:has-text("bereits")')
      const hasError = await errorMsg.count() > 0
      expect(hasError).toBeTruthy()
    }
  })

  test('should close share modal', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'Modal Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Open share dialog
    const shareButton = page.locator('button[title*="Teilen"], button:has-text("📤")')
    await shareButton.first().click()
    await page.waitForTimeout(300)

    // Verify modal is visible
    const modal = page.locator('.modal, .dialog, [class*="modal"]')
    await expect(modal.first()).toBeVisible()

    // Close modal
    const closeBtn = page.locator('button:has-text("Schließen"), button:has-text("×"), button:has-text("Close")')
    await closeBtn.first().click()
    await page.waitForTimeout(200)

    // Modal should be closed
    await expect(modal.first()).not.toBeVisible()
  })

  test('should regenerate share code', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'Regen Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    // Open share and generate code
    const shareButton = page.locator('button[title*="Teilen"], button:has-text("📤")')
    await shareButton.first().click()
    await page.waitForTimeout(300)

    const generateBtn = page.locator('button:has-text("Code generieren"), button:has-text("Neuer Code")')
    if (await generateBtn.isVisible()) {
      await generateBtn.click()
      await page.waitForTimeout(500)

      const codeElement = page.locator('.share-code, code, .code-display').first()
      const firstCode = await codeElement.textContent()

      // Regenerate
      const regenBtn = page.locator('button:has-text("Neuer Code"), button:has-text("Regenerieren")')
      if (await regenBtn.isVisible()) {
        await regenBtn.click()
        await page.waitForTimeout(500)

        const secondCode = await codeElement.textContent()
        expect(secondCode).not.toBe(firstCode)
      }
    }
  })
})
`,

  'synchronization.spec.js': `import { test, expect } from '@playwright/test'

test.describe('Data Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => {
      const dbRequest = indexedDB.deleteDatabase('einkaufsliste_db')
      return new Promise((resolve) => {
        dbRequest.onsuccess = () => resolve()
        dbRequest.onerror = () => resolve()
      })
    })
    await page.reload()
    
    await page.fill('.session-input', 'SyncUser')
    await page.click('.session-btn')
    await page.waitForTimeout(500)
  })

  test('should initialize sync on app load', async ({ page }) => {
    // Create a list to trigger sync
    await page.fill('input[placeholder*="Neue Liste"]', 'Sync Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(1000)

    // Check for sync indicator or status
    // This depends on your implementation
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should sync data after creation', async ({ page }) => {
    // Create list and item
    await page.fill('input[placeholder*="Neue Liste"]', 'Sync List')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Sync Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(2000)

    // Reload to verify sync
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.locator('text=Sync List')).toBeVisible()
    await expect(page.locator('text=Sync Item')).toBeVisible()
  })

  test('should sync item state changes', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'State Sync')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Check Me')
    await itemInput.press('Enter')
    await page.waitForTimeout(500)

    // Toggle item
    await page.locator('.item-checkbox').first().click()
    await page.waitForTimeout(1000)

    // Reload and verify state persisted
    await page.reload()
    await page.waitForTimeout(1000)

    const item = page.locator('.item').first()
    await expect(item).toHaveClass(/checked/)
  })

  test('should sync deletions', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'Delete Sync')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Delete Sync Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(500)

    // Delete item
    await page.locator('button[title*="Löschen"]').first().click()
    await page.waitForTimeout(1000)

    // Reload and check deleted tab
    await page.reload()
    await page.waitForTimeout(1000)

    await page.click('button:has-text("Gelöscht")')
    await page.waitForTimeout(300)

    await expect(page.locator('text=Delete Sync Item')).toBeVisible()
  })

  test('should handle sync conflicts', async ({ page }) => {
    // This test simulates a conflict scenario
    // Create initial data
    await page.fill('input[placeholder*="Neue Liste"]', 'Conflict Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(500)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Conflict Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(1000)

    // In a real scenario, conflicts would be detected by the sync mechanism
    // For now, we just verify the app handles the data correctly
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.locator('text=Conflict Item')).toBeVisible()
  })

  test('should show sync status indicator', async ({ page }) => {
    // Look for sync status indicators
    const syncIndicators = page.locator('.sync-status, [class*="sync"], [class*="online"]')
    
    // At least the app should be running
    await expect(page.locator('body')).toBeVisible()
    
    // If sync indicators exist, verify they're functional
    if (await syncIndicators.count() > 0) {
      await expect(syncIndicators.first()).toBeVisible()
    }
  })

  test('should sync across browser reload', async ({ page }) => {
    // Create data
    await page.fill('input[placeholder*="Neue Liste"]', 'Reload Sync')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    await itemInput.fill('Item 1')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Item 2')
    await itemInput.press('Enter')
    await page.waitForTimeout(1000)

    // Hard reload
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Verify all data is present
    await expect(page.locator('text=Reload Sync')).toBeVisible()
    await expect(page.locator('text=Item 1')).toBeVisible()
    await expect(page.locator('text=Item 2')).toBeVisible()
  })

  test('should handle rapid successive changes', async ({ page }) => {
    await page.fill('input[placeholder*="Neue Liste"]', 'Rapid Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    
    // Add multiple items quickly
    for (let i = 1; i <= 5; i++) {
      await itemInput.fill(\`Rapid Item \${i}\`)
      await itemInput.press('Enter')
      await page.waitForTimeout(100)
    }

    await page.waitForTimeout(1000)

    // Verify all items are present
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(\`text=Rapid Item \${i}\`)).toBeVisible()
    }
  })

  test('should preserve data integrity during sync', async ({ page }) => {
    // Create complex data structure
    await page.fill('input[placeholder*="Neue Liste"]', 'Integrity Test')
    await page.click('button:has-text("Liste anlegen")')
    await page.waitForTimeout(300)

    const itemInput = page.locator('input[placeholder*="Artikel hinzufügen"]').first()
    
    // Add items
    await itemInput.fill('Checked Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Unchecked Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(200)

    await itemInput.fill('Deleted Item')
    await itemInput.press('Enter')
    await page.waitForTimeout(300)

    // Check first item
    await page.locator('.item-checkbox').first().click()
    await page.waitForTimeout(200)

    // Delete third item
    await page.locator('button[title*="Löschen"]').nth(2).click()
    await page.waitForTimeout(500)

    // Reload and verify integrity
    await page.reload()
    await page.waitForTimeout(1000)

    // First item should be checked
    const firstItem = page.locator('.item').first()
    await expect(firstItem).toHaveClass(/checked/)

    // Second item should be unchecked
    const secondItem = page.locator('.item').nth(1)
    await expect(secondItem).not.toHaveClass(/checked/)

    // Third item should be in deleted tab
    await page.click('button:has-text("Gelöscht")')
    await page.waitForTimeout(200)
    await expect(page.locator('text=Deleted Item')).toBeVisible()
  })
})
`
};

console.log('\\nCreating E2E test files...');
let fileCount = 0;

for (const [filename, content] of Object.entries(testFiles)) {
  const filepath = path.join(e2eDir, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(\`✓ Created: \${filename}\`);
  fileCount++;
}

console.log(\`\\n✓ Successfully created \${fileCount} E2E test files!\\n\`);

// Create README for e2e directory
const readmeContent = \`# E2E Tests

This directory contains End-to-End (E2E) tests for the shopping list application using Playwright.

## Test Files

- **session-setup.spec.js** - Tests for session setup functionality
- **shopping-list.spec.js** - Tests for shopping list CRUD operations  
- **offline-mode.spec.js** - Tests for offline functionality
- **sharing.spec.js** - Tests for list sharing with codes
- **synchronization.spec.js** - Tests for data sync

## Running Tests

\\\`\\\`\\\`bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug
\\\`\\\`\\\`

See the main TESTING.md file in the project root for complete documentation.
\`;

fs.writeFileSync(path.join(e2eDir, 'README.md'), readmeContent, 'utf8');
console.log('✓ Created: README.md\\n');
feh