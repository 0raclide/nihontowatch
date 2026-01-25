import { test, expect, Page, BrowserContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length && !process.env[key.trim()]) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

// Load test credentials
const configPath = '.test-admin-config.json';
if (!existsSync(configPath)) {
  throw new Error('Test config not found. Run setup-test-admin.ts first.');
}
const testConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

test.describe('Admin Setsumei Toggle Debugging', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  const apiResponses: { url: string; isAdmin: boolean | undefined; userId: string | null }[] = [];
  const consoleLogs: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (text.includes('isAdmin') || text.includes('FilterContent') || text.includes('Browse')) {
        console.log(`[Console] ${text}`);
      }
    });

    // Intercept API responses
    page.on('response', async response => {
      if (response.url().includes('/api/browse')) {
        try {
          const json = await response.json();
          apiResponses.push({
            url: response.url().substring(0, 100),
            isAdmin: json.isAdmin,
            userId: json._debug?.userId || null,
          });
          console.log(`[API Response] isAdmin: ${json.isAdmin}, userId: ${json._debug?.userId || 'null'}`);
        } catch {
          // Response might not be JSON
        }
      }
    });

    // Go to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('Logging in via UI with test admin account...');

    // Click Sign In button in the header to open modal
    const signInButton = page.locator('nav button:has-text("Sign In")');
    await signInButton.click();
    await page.waitForTimeout(500);

    // Enter test email (ends in .local, triggers password flow)
    const emailInput = page.locator('input#email');
    await emailInput.fill(testConfig.email);

    // Click Continue
    const continueButton = page.locator('button[type="submit"]:has-text("Continue with Email")');
    await continueButton.click();
    await page.waitForTimeout(500);

    // Should now show password step
    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await passwordInput.fill(testConfig.password);

    // Click Sign In button in the modal (form submit)
    const signInSubmit = page.locator('form button[type="submit"]:has-text("Sign In")');
    await signInSubmit.click();

    // Wait for auth to complete
    await page.waitForTimeout(3000);
    console.log('Login complete');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should show admin toggle after login', async () => {
    // Clear previous responses
    apiResponses.length = 0;

    // Navigate to home page fresh
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Log API responses
    console.log('API responses after page load:', apiResponses);

    // Check if any API response has isAdmin: true
    const hasAdminResponse = apiResponses.some(r => r.isAdmin === true);
    console.log(`Has isAdmin: true response: ${hasAdminResponse}`);

    // Open filter sidebar/drawer (on desktop it's visible, on mobile need to click)
    const filterButton = page.locator('button:has-text("Filters")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }

    // Look for the Missing Setsumei toggle
    const adminToggle = page.locator('text=Missing Setsumei');
    const isToggleVisible = await adminToggle.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Missing Setsumei toggle visible: ${isToggleVisible}`);

    if (!isToggleVisible) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/admin-toggle-missing.png', fullPage: true });

      // Log all console messages with isAdmin
      const adminLogs = consoleLogs.filter(l => l.includes('isAdmin'));
      console.log('Console logs with isAdmin:', adminLogs);
    }

    expect(isToggleVisible).toBe(true);
  });

  test('should persist admin toggle after changing filters', async () => {
    // Clear previous responses
    apiResponses.length = 0;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open filters if needed
    const filterButton = page.locator('button:has-text("Filters")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }

    // Verify toggle is visible initially
    const adminToggle = page.locator('text=Missing Setsumei');
    await expect(adminToggle).toBeVisible({ timeout: 5000 });
    console.log('✅ Admin toggle visible initially');

    // Change a filter (click on Nihonto category)
    const nihontoButton = page.locator('button:has-text("Nihonto")');
    if (await nihontoButton.isVisible()) {
      await nihontoButton.click();
      await page.waitForTimeout(2000); // Wait for API response
    }

    // Check toggle is still visible
    const stillVisible = await adminToggle.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Admin toggle visible after filter change: ${stillVisible}`);

    // Log API responses
    console.log('API responses after filter change:', apiResponses);

    if (!stillVisible) {
      await page.screenshot({ path: 'test-results/admin-toggle-after-filter.png', fullPage: true });
    }

    expect(stillVisible).toBe(true);
  });

  test('should track isAdmin through multiple filter changes', async () => {
    apiResponses.length = 0;
    consoleLogs.length = 0;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open filters if needed
    const filterButton = page.locator('button:has-text("Filters")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }

    const adminToggle = page.locator('text=Missing Setsumei');

    // Test multiple filter changes
    const filterChanges = [
      { name: 'Nihonto', selector: 'button:has-text("Nihonto")' },
      { name: 'All', selector: 'button:has-text("All")' },
      { name: 'Tosogu', selector: 'button:has-text("Tosogu")' },
    ];

    for (const filter of filterChanges) {
      const button = page.locator(filter.selector).first();
      if (await button.isVisible()) {
        console.log(`\n--- Clicking ${filter.name} ---`);
        await button.click();
        await page.waitForTimeout(2000);

        const isVisible = await adminToggle.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Toggle visible after ${filter.name}: ${isVisible}`);

        // Log latest API response
        const latestResponse = apiResponses[apiResponses.length - 1];
        console.log(`Latest API isAdmin: ${latestResponse?.isAdmin}, userId: ${latestResponse?.userId}`);

        if (!isVisible) {
          console.log('❌ Toggle disappeared!');
          await page.screenshot({ path: `test-results/toggle-gone-after-${filter.name}.png`, fullPage: true });

          // Check console logs
          const recentAdminLogs = consoleLogs.filter(l => l.includes('isAdmin')).slice(-10);
          console.log('Recent isAdmin logs:', recentAdminLogs);
        }
      }
    }

    // Final check
    const finalVisible = await adminToggle.isVisible({ timeout: 2000 }).catch(() => false);
    expect(finalVisible).toBe(true);
  });

  test('should verify API consistently returns isAdmin: true', async () => {
    apiResponses.length = 0;

    // Make multiple requests
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.goto('/?category=nihonto');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.goto('/?category=tosogu');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check all responses
    console.log('\n=== All API Responses ===');
    apiResponses.forEach((r, i) => {
      console.log(`${i + 1}. isAdmin: ${r.isAdmin}, userId: ${r.userId}`);
    });

    // All responses should have isAdmin: true
    const allAdmin = apiResponses.every(r => r.isAdmin === true);
    const anyNullUser = apiResponses.some(r => r.userId === null);

    console.log(`All responses have isAdmin: true: ${allAdmin}`);
    console.log(`Any response has null userId: ${anyNullUser}`);

    if (!allAdmin || anyNullUser) {
      console.log('❌ ISSUE FOUND: Inconsistent isAdmin or null userId');
    }

    expect(allAdmin).toBe(true);
    expect(anyNullUser).toBe(false);
  });
});
