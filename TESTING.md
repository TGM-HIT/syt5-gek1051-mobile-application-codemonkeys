# Test Setup and Execution Guide

This guide explains how to set up and run all tests for the shopping list application.

## Quick Start

**Windows Users:**
1. Run `setup-all-tests.bat` in the project root
2. Follow the on-screen instructions

**Manual Setup:**
1. Run `node create-test-dirs.js` to create directories
2. Run `node create-e2e-dir.js` to create E2E test files
3. Install Playwright: `cd frontend && npm install --save-dev @playwright/test`
4. Install browsers: `npx playwright install chromium`

## Test Structure

```
frontend/
├── e2e/                               # End-to-End tests
│   ├── session-setup.spec.js         # Login & Register E2E tests
│   ├── shopping-list.spec.js         # CRUD operation tests
│   ├── offline-mode.spec.js          # Offline functionality tests
│   ├── sharing.spec.js               # Share code tests
│   ├── item-details.spec.js          # U10: Notes & Labels E2E tests
│   └── synchronization.spec.js       # Data sync tests
│
└── src/
    └── composables/
        └── __tests__/
            ├── database.test.js          # Database tests
            ├── useAuth.test.js           # Authentication composable tests
            ├── useItemDetails.test.js    # U10: Item detail UI state tests
            ├── useShoppingList.test.js   # Shopping list composable tests
            ├── pwa-notifications.test.js # PWA notification tests
            └── search.test.js            # Search composable tests
```

## Running Tests

### Unit Tests

```bash
cd frontend

# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/composables/__tests__/useAuth.test.js
```

### E2E Tests

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Run specific test
npx playwright test e2e/session-setup.spec.js
```

### All Tests

```bash
cd frontend

# Run unit tests then E2E tests
npm run test:all
```

## Test Coverage

### Current Unit Test Coverage

The unit tests cover (223 tests total):
- ✅ Authentication (useAuth composable: register, login, logout, checkSession)
- ✅ Shopping list operations (useShoppingList composable: CRUD, sharing, U10 details)
- ✅ Item detail UI state (useItemDetails composable: 52 tests)
- ✅ Database operations (database.js)
- ✅ PWA notifications (pwa-notifications composable)
- ✅ Search functionality (search composable)

### Current E2E Test Coverage

The E2E tests cover:
- ✅ Login page visibility and form validation
- ✅ Registration page and password mismatch errors
- ✅ Auth redirect guards (protected routes require login)
- ✅ Session persistence after page reload
- ✅ List and item CRUD operations
- ✅ Offline mode functionality
- ✅ Share code generation and joining
- ✅ Data synchronization
- ✅ Search functionality
- ✅ U10: Detail panel open/close (9 tests)
- ✅ U10: Note creation, preview and deletion (9 tests)
- ✅ U10: Label assignment and color dot display (9 tests)
- ✅ U10: LabelFilterBar visibility and filtering (4 tests)
- ✅ U10: Combined note + label persistence (5 tests)
- ✅ U9: Profil-Dialog mit Passwortfeldern und lokaler Validierung
- ✅ U9: Logout über Profil-Einstellungen
- ✅ Error handling

## U9 User Profil & Einstellungen - Akzeptanzkriterien

Diese Kriterien definieren die Abnahme für U9 (**Passwort ändern** und **Abmelden**).

### Scope

- `frontend/src/components/ShoppingList.vue` (Profil- und Einstellungsdialog)
- `frontend/src/composables/useAuth.js` (Passwortänderung + Session-Logout)

### Akzeptanzkriterien (testbar)

1. Ein eingeloggter Benutzer kann den Dialog **Profil & Einstellungen** öffnen.
2. Der Dialog zeigt den aktuellen Benutzernamen sowie Felder für aktuelles Passwort, neues Passwort und Bestätigung.
3. Die Aktion **Passwort ändern** ist erst möglich, wenn alle Pflichtfelder ausgefüllt sind.
4. Stimmen neues Passwort und Bestätigung nicht überein, wird keine Passwortänderung ausgeführt und eine klare Fehlermeldung angezeigt.
5. Ist das aktuelle Passwort falsch, wird die Änderung abgelehnt und eine klare Fehlermeldung angezeigt.
6. Bei gültigen Eingaben wird das Passwort in CouchDB erfolgreich aktualisiert und eine Erfolgsmeldung angezeigt.
7. Der Benutzer kann sich über **Abmelden** (Header oder Profil-Dialog) ausloggen und wird auf `/login` weitergeleitet.
8. Der Profil-Dialog ist tastaturbedienbar (Escape schließt, Tab bleibt im Dialog).

### Done-Kriterien für U9

1. Unit-Tests decken den `changePassword`-Flow (Erfolg + Fehlpfade) im Auth-Composable ab.
2. E2E-Tests decken Profil-Dialog, lokale Passwort-Validierung und Logout aus den Einstellungen ab.

## U15 Accessibility (A11y) - Sub-Issue 1: Audit & Scope

This section defines the audit scope and acceptance checklist for U15 before implementation work starts.

### Audit scope

The following user-facing surfaces are part of the U15 baseline audit:

- `frontend/src/views/LoginView.vue`
- `frontend/src/views/RegisterView.vue`
- `frontend/src/components/ShoppingList.vue`
- `frontend/src/components/LabelFilterBar.vue`
- `frontend/src/components/ThemeToggle.vue`
- `frontend/src/components/SessionSetup.vue`
- `frontend/src/components/ShoppingList.css`
- `frontend/src/assets/base.css`

### Core user flows to validate

1. Login and registration (including error messages and password toggle)
2. Create list and add item
3. Toggle, delete and restore item
4. Open/close confirm modal and share modal
5. Search and label filter usage
6. Logout and navigation redirects

### Audit matrix (manual)

1. Keyboard-only navigation in Chromium (no mouse)
2. Screen reader smoke test with NVDA + Firefox on Windows
3. Contrast and focus visibility check in Light and Dark mode

### A11y checklist (must be testable)

- Every interactive control has an accessible name (`label`, visible text, or `aria-label`)
- Every form input has a correctly associated label
- All actions are reachable via Tab/Shift+Tab and triggerable with keyboard
- Focus order is logical and visible on all interactive controls
- Dialogs expose dialog semantics and do not lose keyboard focus
- Dynamic errors/status updates are announced via `role="alert"` or `aria-live`
- Information is not color-only (status remains understandable without color perception)
- Text and UI controls meet WCAG AA contrast targets

### Done criteria for Sub-Issue 1

Sub-Issue 1 is complete when:

1. The full checklist above is executed for all scoped surfaces.
2. Findings are documented as concrete implementation tasks (Sub-Issues 2+).
3. Blocking findings are prioritized before final U15 acceptance.

## Test Enhancements Added

### Auth Unit Tests (useAuth.test.js)

- ✅ Register: success, duplicate user error, network error
- ✅ Login: success with session persistence, wrong credentials error
- ✅ Logout: session cleared from localStorage
- ✅ checkSession: active session, expired session, offline fallback
- ✅ clearError: resets authError state

### Enhanced Unit Tests

**useShoppingList.test.js:**
- ✅ Edge cases (empty IDs, rapid toggles)
- ✅ Special characters in names
- ✅ Very long names
- ✅ Empty list handling
- ✅ Database error handling
- ✅ Error propagation
- ✅ U10: updateItemDetails (note, label, _rev update, null handling)
- ✅ U10: addItem creates items with note='' and label=null

**useItemDetails.test.js (U10, 52 tests):**
- ✅ LABEL_COLORS: 6 colors, unique names and hex values
- ✅ getLabelColor: correct hex, null/unknown handling, case-sensitive
- ✅ getLabelObject: full metadata object, null handling
- ✅ openDetail / closeDetail / toggleDetail lifecycle
- ✅ isDirty: detects note and label changes
- ✅ setLabel / clearLabel
- ✅ getDetailValues: returns current editing state
- ✅ isValidLabel: validates against LABEL_COLORS

## CI/CD Integration

Tests run automatically on:
- Every push to any branch
- Pull requests to `main` or `dev`

### CI Workflow

1. **Unit Tests** (runs first)
   - Installs dependencies
   - Runs unit tests with coverage
   - Uploads coverage report
   - Posts coverage comment on PRs

2. **E2E Tests** (runs after unit tests pass)
   - Installs dependencies
   - Installs Playwright browsers
   - Runs E2E tests
   - Uploads test results
   - Uploads screenshots on failure

### Viewing CI Results

1. Go to GitHub Actions tab
2. Click on the workflow run
3. Download artifacts:
   - `coverage-report` - Unit test coverage
   - `playwright-report` - E2E test results
   - `playwright-screenshots` - Failure screenshots (if any)

## Debugging Tests

### Unit Tests

```bash
# Run specific test in watch mode
npx vitest --reporter=verbose useSession

# Run with debugging
node --inspect-brk node_modules/vitest/vitest.mjs run
```

### E2E Tests

```bash
# Debug mode (step through tests)
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# View test report
npx playwright show-report

# View trace
npx playwright show-trace trace.zip
```

## Troubleshooting

### PowerShell Issues

If PowerShell 6+ is not installed:
1. Use the batch file: `setup-all-tests.bat`
2. Or manually run the Node.js scripts

### Playwright Installation Issues

```bash
# Reinstall Playwright
npm uninstall @playwright/test
npm install --save-dev @playwright/test

# Reinstall browsers
npx playwright install --force
```

### Test Failures

**Unit tests failing:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 20.19.0 or 22.12.0+)
- Reset vitest cache: `npx vitest --clearCache`

**E2E tests failing:**
- Start dev server manually: `npm run dev`
- Check if port 5173 is available
- Clear browser data
- Update browsers: `npx playwright install`

## Best Practices

### Writing Unit Tests

1. Use descriptive test names
2. Test one thing per test
3. Mock external dependencies
4. Clean up after tests
5. Use beforeEach for setup

Example:
```javascript
describe('Feature', () => {
  beforeEach(() => {
    // Setup
    vi.resetModules()
  })

  it('should do specific thing', async () => {
    // Arrange
    const data = { ... }
    
    // Act
    const result = await doSomething(data)
    
    // Assert
    expect(result).toBe(expected)
  })
})
```

### Writing E2E Tests

1. Clean state before each test
2. Use explicit waits
3. Test user flows, not implementation
4. Make tests resilient to UI changes
5. Test happy path and error cases

Example:
```javascript
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('should complete user flow', async ({ page }) => {
  // User action 1
  await page.fill('input', 'value')
  
  // User action 2
  await page.click('button')
  
  // Verify outcome
  await expect(page.locator('.result')).toBeVisible()
})
```

## Performance Tips

### Faster Unit Tests

```bash
# Run tests in parallel (default)
npm test

# Run specific tests only
npx vitest run path/to/test.js

# Skip slow tests during development
npx vitest --no-coverage
```

### Faster E2E Tests

```bash
# Run in parallel (default locally)
npm run test:e2e

# Run single test file
npx playwright test session-setup.spec.js

# Skip setup in config if needed
```

## Continuous Improvement

### Adding New Tests

1. Identify untested features
2. Write failing test
3. Implement feature
4. Verify test passes
5. Refactor if needed

### Maintaining Tests

1. Update tests when features change
2. Remove tests for removed features
3. Keep test data realistic
4. Review test coverage regularly
5. Fix flaky tests immediately

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Support

For issues or questions:
1. Check this documentation
2. Review existing tests for examples
3. Check CI logs for error details
4. Consult Playwright/Vitest docs
