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
│   └── synchronization.spec.js       # Data sync tests
│
└── src/
    └── composables/
        └── __tests__/
            ├── database.test.js          # Database tests
            ├── useAuth.test.js           # Authentication composable tests
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

The unit tests cover:
- ✅ Authentication (useAuth composable: register, login, logout, checkSession)
- ✅ Shopping list operations (useShoppingList composable)
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
- ✅ Error handling

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
