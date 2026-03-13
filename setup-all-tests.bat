@echo off
echo ==========================================
echo  Setting up E2E Tests and Enhanced Tests
echo ==========================================
echo.

echo Step 1: Creating directories...
node create-test-dirs.js
if errorlevel 1 (
    echo Failed to create directories!
    pause
    exit /b 1
)

echo.
echo Step 2: Creating E2E test files...
node create-e2e-dir.js
if errorlevel 1 (
    echo Failed to create test files!
    pause
    exit /b 1
)

echo.
echo Step 3: Installing Playwright...
cd frontend
call npm install --save-dev @playwright/test
if errorlevel 1 (
    echo Failed to install Playwright!
    cd ..
    pause
    exit /b 1
)

echo.
echo Step 4: Installing Playwright browsers...
call npx playwright install chromium
if errorlevel 1 (
    echo Warning: Failed to install browsers - you may need to run this manually
)

cd ..

echo.
echo ==========================================
echo  Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Component tests will be created in the next step
echo   2. Run 'cd frontend' to enter the frontend directory
echo   3. Run 'npm run test:e2e' to run E2E tests
echo   4. Run 'npm test' to run unit tests
echo.
pause
