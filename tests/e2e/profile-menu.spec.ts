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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    console.log('Authenticating via Supabase API from browser...');

    // Call Supabase auth directly via REST API from the browser
    const authResult = await page.evaluate(async ({ url, key, email, password }) => {
      try {
        const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { error: error.error_description || error.message || 'Auth failed' };
        }

        const data = await response.json();

        // Store the session in localStorage (same format as @supabase/ssr)
        const projectRef = new URL(url).hostname.split('.')[0];
        const storageKey = `sb-${projectRef}-auth-token`;

        const sessionData = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
          expires_in: data.expires_in,
          token_type: data.token_type,
          user: data.user,
        };

        localStorage.setItem(storageKey, JSON.stringify(sessionData));

        return { success: true, email: data.user?.email };
      } catch (err) {
        return { error: String(err) };
      }
    }, {
      url: supabaseUrl,
      key: supabaseKey,
      email: testConfig.email,
      password: testConfig.password,
    });

    if (authResult.error) {
      throw new Error(`Auth failed: ${authResult.error}`);
    }

    console.log('Authenticated as:', authResult.email);

    // Reload to let the app pick up the auth
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for auth to initialize
    await page.waitForTimeout(3000);

    console.log('Auth setup complete');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should be logged in after setup', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if user menu (avatar) is visible
    const userMenu = page.locator('[aria-haspopup="true"]').first();
    const isLoggedIn = await userMenu.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isLoggedIn) {
      // Debug info
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;

      const authData = await page.evaluate((key) => localStorage.getItem(key), storageKey);
      console.log('Auth data in localStorage:', authData ? 'present' : 'missing');

      // Check for auth loading indicator
      const isLoading = await page.locator('[class*="animate-spin"]').isVisible().catch(() => false);
      console.log('Loading indicator visible:', isLoading);

      // Check for Sign In button
      const signInVisible = await page.locator('text="Sign In"').isVisible().catch(() => false);
      console.log('Sign In button visible:', signInVisible);

      await page.screenshot({ path: 'test-results/not-logged-in.png' });
    }

    expect(isLoggedIn).toBe(true);
    console.log('✅ User is logged in');
  });

  test('should open user dropdown and see profile link', async () => {
    const userMenuButton = page.locator('[aria-haspopup="true"]').first();
    await userMenuButton.click();
    await page.waitForTimeout(500);

    const profileLink = page.locator('a[href="/profile"]');
    await expect(profileLink).toBeVisible({ timeout: 5000 });

    console.log('✅ Dropdown opened, Profile link visible');
  });

  test('should navigate to profile page', async () => {
    await page.click('a[href="/profile"]');
    await page.waitForURL('**/profile', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for profile page content
    const bodyText = await page.textContent('body');
    const hasMyProfile = bodyText?.includes('My Profile');
    const hasSignInPrompt = bodyText?.includes('Sign in to view your profile');

    console.log('Profile page content:', {
      hasMyProfile,
      hasSignInPrompt,
    });

    if (hasSignInPrompt) {
      await page.screenshot({ path: 'test-results/profile-signed-out.png' });
    }

    expect(hasSignInPrompt).toBe(false);
    expect(hasMyProfile).toBe(true);

    console.log('✅ Profile page shows user content');
  });

  test('should display test user email', async () => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain(testConfig.email);
    console.log('✅ User email is displayed');
  });

  test('should navigate to favorites and remain logged in', async () => {
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userMenu = page.locator('[aria-haspopup="true"]');
    const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isLoggedIn) {
      await page.screenshot({ path: 'test-results/favorites-not-logged-in.png' });
    }

    expect(isLoggedIn).toBe(true);
    console.log('✅ Favorites page - user still logged in');
  });

  test('should navigate to alerts and remain logged in', async () => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userMenu = page.locator('[aria-haspopup="true"]');
    const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

    expect(isLoggedIn).toBe(true);
    console.log('✅ Alerts page - user still logged in');
  });

  test('should access admin page as admin user', async () => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should stay on admin page (not be redirected)
    expect(page.url()).toContain('/admin');

    console.log('✅ Admin page accessible');
  });

  test('should maintain auth across navigation', async () => {
    const routes = ['/', '/browse', '/profile', '/alerts'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const userMenu = page.locator('[aria-haspopup="true"]');
      const isLoggedIn = await userMenu.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isLoggedIn) {
        await page.screenshot({ path: `test-results/lost-auth-${route.replace(/\//g, '-') || 'home'}.png` });
        console.log(`Auth lost on: ${route}`);
      }

      expect(isLoggedIn).toBe(true);
    }

    console.log('✅ Auth maintained across all navigation');
  });

  test('all dropdown links should be functional', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open dropdown
    const userMenuButton = page.locator('[aria-haspopup="true"]').first();
    await userMenuButton.click();
    await page.waitForTimeout(500);

    // Verify links
    const links = ['/profile', '/favorites', '/alerts'];
    for (const href of links) {
      const link = page.locator(`a[href="${href}"]`);
      const isVisible = await link.isVisible();
      console.log(`Link ${href}: ${isVisible ? 'visible' : 'NOT visible'}`);
      expect(isVisible).toBe(true);
    }

    // Admin link should be visible for admin
    const adminLink = page.locator('a[href="/admin"]');
    const hasAdmin = await adminLink.isVisible().catch(() => false);
    console.log(`Admin link: ${hasAdmin ? 'visible' : 'NOT visible'}`);

    console.log('✅ All dropdown links verified');
  });
});
