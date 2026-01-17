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

// Helper to find user avatar button
const getUserAvatarButton = (page: Page) =>
  page.locator('button[aria-haspopup="true"]').filter({ has: page.locator('.rounded-full') }).last();

test.describe('Profile and Menu Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Go to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('Logging in via UI with test account...');

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

    // Wait for success message and modal close
    await page.waitForTimeout(2000);

    // Wait for auth to be recognized
    await page.waitForTimeout(3000);

    console.log('Login attempt complete');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should be logged in and show user avatar', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if user avatar is visible
    const userMenu = getUserAvatarButton(page);
    const isLoggedIn = await userMenu.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isLoggedIn) {
      const signInVisible = await page.locator('button:has-text("Sign In")').isVisible().catch(() => false);
      console.log('Sign In button visible:', signInVisible);
      await page.screenshot({ path: 'test-results/not-logged-in.png' });
    }

    expect(isLoggedIn).toBe(true);
    console.log('✅ User is logged in');
  });

  test('should open user dropdown and see menu items', async () => {
    // Navigate fresh and wait for page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open user dropdown
    const userMenuButton = getUserAvatarButton(page);
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // The dropdown has specific styling - find it by the dropdown container
    const dropdown = page.locator('.bg-cream.rounded-lg.shadow-lg').first();
    const dropdownItems = dropdown.locator('a, button');

    // Verify profile item (unique to dropdown)
    const profileItem = dropdownItems.filter({ hasText: 'Profile' });
    await expect(profileItem).toBeVisible({ timeout: 5000 });
    console.log('✅ Profile item visible in dropdown');

    // Verify favorites item (unique to dropdown)
    const favoritesItem = dropdownItems.filter({ hasText: 'Favorites' });
    await expect(favoritesItem).toBeVisible({ timeout: 5000 });
    console.log('✅ Favorites item visible in dropdown');

    // Verify alerts item (in dropdown - there's also one in nav)
    const alertsItem = dropdownItems.filter({ hasText: 'Alerts' });
    await expect(alertsItem).toBeVisible({ timeout: 5000 });
    console.log('✅ Alerts item visible in dropdown');

    // Admin item should be visible for admin user
    const adminItem = dropdownItems.filter({ hasText: 'Admin' });
    const hasAdmin = await adminItem.isVisible().catch(() => false);
    console.log(`Admin item: ${hasAdmin ? 'visible' : 'NOT visible'}`);

    console.log('✅ All dropdown items verified');
  });

  test('should navigate to Profile page when clicking dropdown item', async () => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = `[Browser ${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      console.log(text);
    });
    page.on('pageerror', err => console.log(`[Browser Error] ${err.message}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open user dropdown
    const userMenuButton = getUserAvatarButton(page);
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Wait for dropdown to be visible
    const dropdown = page.locator('.bg-cream.rounded-lg.shadow-lg').first();
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Find Profile item (could be a or button)
    const profileItem = dropdown.locator('a, button').filter({ hasText: 'Profile' });
    await expect(profileItem).toBeVisible({ timeout: 5000 });

    // Log the element info
    const href = await profileItem.getAttribute('href');
    console.log(`Profile item href: ${href}`);

    // Click Profile item
    console.log('Clicking Profile item...');
    await profileItem.click();
    console.log('Click completed');

    // Wait a moment and check console logs
    await page.waitForTimeout(1000);
    console.log('Console logs so far:', consoleLogs.filter(l => l.includes('MenuLink')));

    // Wait for navigation
    await page.waitForURL('**/profile', { timeout: 10000 });
    expect(page.url()).toContain('/profile');
    console.log('✅ Navigated to Profile page via dropdown');
  });

  test('should navigate to Favorites page when clicking dropdown item', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open user dropdown
    const userMenuButton = getUserAvatarButton(page);
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Click Favorites item
    const dropdown = page.locator('.bg-cream.rounded-lg.shadow-lg').first();
    const favoritesItem = dropdown.locator('a, button').filter({ hasText: 'Favorites' });
    await favoritesItem.click();

    // Wait for navigation
    await page.waitForURL('**/favorites', { timeout: 10000 });
    expect(page.url()).toContain('/favorites');
    console.log('✅ Navigated to Favorites page via dropdown');
  });

  test('should navigate to Alerts page when clicking dropdown item', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open user dropdown
    const userMenuButton = getUserAvatarButton(page);
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Click Alerts item in the dropdown
    const dropdown = page.locator('.bg-cream.rounded-lg.shadow-lg').first();
    const alertsItem = dropdown.locator('a, button').filter({ hasText: 'Alerts' });
    await alertsItem.click();

    // Wait for navigation
    await page.waitForURL('**/alerts', { timeout: 10000 });
    expect(page.url()).toContain('/alerts');
    console.log('✅ Navigated to Alerts page via dropdown');
  });

  test('should navigate to Admin page when clicking dropdown item', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open user dropdown
    const userMenuButton = getUserAvatarButton(page);
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Click Admin item
    const dropdown = page.locator('.bg-cream.rounded-lg.shadow-lg').first();
    const adminItem = dropdown.locator('a, button').filter({ hasText: 'Admin' });
    await adminItem.click();

    // Wait for navigation
    await page.waitForURL('**/admin', { timeout: 10000 });
    expect(page.url()).toContain('/admin');
    console.log('✅ Navigated to Admin page via dropdown');
  });

  test('should navigate via Admin header dropdown items', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open Admin dropdown in header (separate from user menu)
    const adminDropdownButton = page.locator('button:has-text("ADMIN")');
    await adminDropdownButton.first().click();
    await page.waitForTimeout(500);

    // Click Dashboard item (could be button or link)
    const adminMenu = page.locator('.bg-cream.rounded-lg.shadow-lg').last();
    const dashboardItem = adminMenu.locator('a, button').filter({ hasText: 'Dashboard' });
    await dashboardItem.click();

    // Wait for navigation
    await page.waitForURL('**/admin', { timeout: 10000 });
    expect(page.url()).toMatch(/\/admin$/);
    console.log('✅ Navigated to Admin Dashboard via header dropdown');
  });

  test('should navigate to Admin Users via header dropdown', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open Admin dropdown in header
    const adminDropdownButton = page.locator('button:has-text("ADMIN")');
    await adminDropdownButton.first().click();
    await page.waitForTimeout(500);

    // Click Users item (could be button or link)
    const adminMenu = page.locator('.bg-cream.rounded-lg.shadow-lg').last();
    const usersItem = adminMenu.locator('a, button').filter({ hasText: 'Users' });
    await usersItem.click();

    // Wait for navigation
    await page.waitForURL('**/admin/users', { timeout: 10000 });
    expect(page.url()).toContain('/admin/users');
    console.log('✅ Navigated to Admin Users via header dropdown');
  });

  test('should show profile page with user content', async () => {
    // Navigate directly to profile page
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for profile page content
    const bodyText = await page.textContent('body');
    const hasMyProfile = bodyText?.includes('My Profile');
    const hasSignInPrompt = bodyText?.includes('Sign in to view your profile');

    if (hasSignInPrompt) {
      await page.screenshot({ path: 'test-results/profile-signed-out.png' });
    }

    expect(hasSignInPrompt).toBe(false);
    expect(hasMyProfile).toBe(true);
    expect(bodyText).toContain(testConfig.email);

    console.log('✅ Profile page shows user content with email');
  });

  test('should maintain auth on browse page', async () => {
    await page.goto('/browse');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const userMenu = getUserAvatarButton(page);
    const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isLoggedIn) {
      await page.screenshot({ path: 'test-results/browse-not-logged-in.png' });
    }

    expect(isLoggedIn).toBe(true);
    console.log('✅ Auth maintained on browse page');
  });

  test('should access admin page as admin user', async () => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should stay on admin page (not be redirected)
    expect(page.url()).toContain('/admin');

    console.log('✅ Admin page accessible');
  });
});
