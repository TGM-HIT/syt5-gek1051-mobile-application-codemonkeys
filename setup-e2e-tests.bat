@echo off
echo Creating E2E test directory structure...

REM Create e2e directory
if not exist "frontend\e2e" mkdir "frontend\e2e"

echo E2E directory created successfully!
echo.
echo Now creating E2E test files...

REM Create session-setup.spec.js
(
echo import { test, expect } from '@playwright/test'
echo.
echo test.describe('Session Setup', ^(^) =^> {
echo   test('should show session setup modal on first visit', async ^({ page }^) =^> {
echo     await page.goto('/'^)
echo.
echo     // Check if session modal is visible
echo     const modal = page.locator('.session-overlay'^)
echo     await expect^(modal^).toBeVisible^(^)
echo.
echo     // Verify modal content
echo     await expect^(page.locator('.session-modal h2'^)^).toContainText('Willkommen'^)
echo     await expect^(page.locator('.session-input'^)^).toBeVisible^(^)
echo   }^)
echo.
echo   test('should allow user to set session name', async ^({ page }^) =^> {
echo     await page.goto('/'^)
echo.
echo     // Enter name
echo     await page.fill('.session-input', 'TestUser'^)
echo     await page.click('.session-btn'^)
echo.
echo     // Modal should close
echo     await expect^(page.locator('.session-overlay'^)^).not.toBeVisible^(^)
echo.
echo     // Verify session name is stored
echo     const sessionName = await page.evaluate^(^(^) =^> localStorage.getItem^('einkaufsliste_session_name'^)^)
echo     expect^(sessionName^).toBe^('TestUser'^)
echo   }^)
echo.
echo   test('should not submit with empty name', async ^({ page }^) =^> {
echo     await page.goto('/'^)
echo.
echo     // Button should be disabled with empty input
echo     await expect^(page.locator('.session-btn'^)^).toBeDisabled^(^)
echo.
echo     // Enter spaces only
echo     await page.fill('.session-input', '   '^)
echo     await expect^(page.locator('.session-btn'^)^).toBeDisabled^(^)
echo   }^)
echo.
echo   test('should persist session name on reload', async ^({ page, context }^) =^> {
echo     await page.goto('/'^)
echo     await page.fill('.session-input', 'PersistentUser'^)
echo     await page.click('.session-btn'^)
echo.
echo     // Reload page
echo     await page.reload^(^)
echo.
echo     // Modal should not appear
echo     await expect^(page.locator('.session-overlay'^)^).not.toBeVisible^(^)
echo   }^)
echo.
echo   test('should trim whitespace from session name', async ^({ page }^) =^> {
echo     await page.goto('/'^)
echo     await page.fill('.session-input', '  TrimmedUser  '^)
echo     await page.click('.session-btn'^)
echo.
echo     const sessionName = await page.evaluate^(^(^) =^> localStorage.getItem^('einkaufsliste_session_name'^)^)
echo     expect^(sessionName^).toBe^('TrimmedUser'^)
echo   }^)
echo.
echo   test('should allow Enter key to submit', async ^({ page }^) =^> {
echo     await page.goto('/'^)
echo     await page.fill('.session-input', 'EnterUser'^)
echo     await page.press('.session-input', 'Enter'^)
echo.
echo     await expect^(page.locator('.session-overlay'^)^).not.toBeVisible^(^)
echo   }^)
echo }^)
) > "frontend\e2e\session-setup.spec.js"

echo Created: session-setup.spec.js
echo.
echo Successfully created all E2E test files!
echo.
echo To install Playwright and run the tests:
echo   1. cd frontend
echo   2. npm install @playwright/test --save-dev
echo   3. npx playwright install
echo   4. npm run test:e2e
echo.
pause
