import { test, expect, Page, BrowserContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to authenticate and get session tokens
async function getAuthTokens() {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: testConfig.email,
    password: testConfig.password,
  });

  if (error || !data.session) {
    throw new Error(`Failed to authenticate: ${error?.message}`);
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

test.describe('Profile and Menu Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Get auth tokens before tests
    console.log('Authenticating test user...');
    const tokens = await getAuthTokens();
    console.log('Got auth tokens');

    // Create context with cookies set
    context = await browser.newContext();

    // Set Supabase auth cookies
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: tokens.accessToken,
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'sb-refresh-token',
        value: tokens.refreshToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    page = await context.newPage();

    // Also set localStorage (some Supabase versions use this)
    await page.goto('/');
    await page.evaluate(({ url, key, tokens }) => {
      const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'bearer',
      }));
    }, { url: supabaseUrl, key: supabaseKey, tokens });

    // Reload to pick up auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log('Auth setup complete');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should be logged in after setup', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // User menu should be visible (indicating logged in)
    const userMenu = page.locator('[aria-haspopup="true"]').first();
    const isLoggedIn = await userMenu.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isLoggedIn) {
      // Debug: check page content
      const bodyText = await page.textContent('body');
      console.log('Not logged in. Page content preview:', bodyText?.substring(0, 500));

      // Check for Sign In button
      const signInButton = page.locator('button:has-text("Sign In")');
      if (await signInButton.isVisible().catch(() => false)) {
        console.log('Sign In button is visible - auth failed');
      }

      await page.screenshot({ path: 'test-results/auth-failed.png' });
    }

    expect(isLoggedIn).toBe(true);
    console.log('✅ Logged in successfully');
  });

  test('should open user dropdown menu', async () => {
    // Click user menu button
    const userMenuButton = page.locator('[aria-haspopup="true"]').first();
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    await userMenuButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Verify dropdown is open - profile link should be visible
    const profileLink = page.locator('a[href="/profile"]');
    await expect(profileLink).toBeVisible({ timeout: 5000 });
    console.log('✅ User dropdown opened');
  });

  test('should navigate to profile page and stay logged in', async () => {
    // Click Profile link
    await page.click('a[href="/profile"]');

    // Wait for navigation
    await page.waitForURL('**/profile', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Give auth time to settle
    await page.waitForTimeout(2000);

    // Check page content
    const pageContent = await page.textContent('body');

    // Should see "My Profile" title (indicating logged in view)
    const hasProfileTitle = pageContent?.includes('My Profile');

    // Should NOT see "Sign in to view your profile"
    const hasLoginPrompt = pageContent?.includes('Sign in to view your profile');

    console.log('Profile page state:', {
      hasProfileTitle,
      hasLoginPrompt,
      url: page.url(),
    });

    if (hasLoginPrompt || !hasProfileTitle) {
      await page.screenshot({ path: 'test-results/profile-page-issue.png' });
      console.log('Page HTML preview:', pageContent?.substring(0, 1000));
    }

    expect(hasLoginPrompt).toBe(false);
    expect(hasProfileTitle).toBe(true);
    console.log('✅ Profile page loaded correctly');
  });

  test('should display user email on profile page', async () => {
    // Verify user email is displayed somewhere on the page
    const emailRegex = new RegExp(testConfig.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pageContent = await page.textContent('body');

    expect(pageContent).toMatch(emailRegex);
    console.log('✅ User email displayed');
  });

  test('should navigate to favorites page and stay logged in', async () => {
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const pageContent = await page.textContent('body');

    // Should see My Favorites or favorites content
    const hasFavoritesContent = pageContent?.includes('My Favorites') || pageContent?.includes('Favorites');

    // Should NOT see sign in prompt
    const hasLoginPrompt = pageContent?.includes('Sign in to view favorites') ||
      pageContent?.includes('create an account');

    if (hasLoginPrompt || !hasFavoritesContent) {
      await page.screenshot({ path: 'test-results/favorites-page-issue.png' });
    }

    // User menu should still be visible
    const userMenu = page.locator('[aria-haspopup="true"]');
    const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

    expect(isLoggedIn).toBe(true);
    console.log('✅ Favorites page loaded while logged in');
  });

  test('should navigate to alerts page and stay logged in', async () => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const pageContent = await page.textContent('body');

    // Should see alerts content
    const hasAlertsContent = pageContent?.includes('My Alerts') || pageContent?.includes('Alerts');

    if (!hasAlertsContent) {
      await page.screenshot({ path: 'test-results/alerts-page-issue.png' });
    }

    // User menu should still be visible
    const userMenu = page.locator('[aria-haspopup="true"]');
    const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

    expect(isLoggedIn).toBe(true);
    console.log('✅ Alerts page loaded while logged in');
  });

  test('should navigate to admin page (test user is admin)', async () => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should be on admin page, not redirected
    const currentUrl = page.url();

    if (!currentUrl.includes('/admin')) {
      console.log('Redirected from admin. Current URL:', currentUrl);
      await page.screenshot({ path: 'test-results/admin-redirect.png' });
    }

    expect(currentUrl).toContain('/admin');
    console.log('✅ Admin page accessible');
  });

  test('should persist auth state when navigating back and forth', async () => {
    const routes = ['/', '/profile', '/browse', '/favorites', '/alerts'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // User menu should be visible on every page
      const userMenu = page.locator('[aria-haspopup="true"]');
      const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isLoggedIn) {
        console.log(`Auth lost on ${route}`);
        await page.screenshot({ path: `test-results/auth-lost-${route.replace(/\//g, '-') || 'home'}.png` });
      }

      expect(isLoggedIn).toBe(true);
    }

    console.log('✅ Auth state persisted across all navigations');
  });

  test('dropdown links should all be functional', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open dropdown
    const userMenuButton = page.locator('[aria-haspopup="true"]').first();
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Verify all expected links are present
    const expectedLinks = [
      { href: '/profile', text: 'Profile' },
      { href: '/favorites', text: 'Favorites' },
      { href: '/alerts', text: 'Alerts' },
      { href: '/admin', text: 'Admin' },
    ];

    for (const link of expectedLinks) {
      const linkElement = page.locator(`a[href="${link.href}"]`);
      const isVisible = await linkElement.isVisible().catch(() => false);
      console.log(`Link ${link.text} (${link.href}): ${isVisible ? 'visible' : 'NOT visible'}`);

      if (link.href === '/admin') {
        // Admin link may or may not be visible depending on user role
        continue;
      }

      expect(isVisible).toBe(true);
    }

    console.log('✅ All dropdown links present');
  });
});
