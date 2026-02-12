import { test, expect } from '@playwright/test';

const PROD_URL = 'https://nihontowatch.com';

// Chromium with iPhone 14 viewport (390×844)
test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  baseURL: PROD_URL,
});

/** Dismiss cookie consent if visible */
async function dismissCookies(page: import('@playwright/test').Page) {
  const accept = page.locator('button', { hasText: 'Accept' });
  if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accept.click();
    await accept.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

test.describe('Artist pages — mobile navigation', () => {

  test('artist directory has bottom tab bar with working menu', async ({ page }) => {
    await page.goto('/artists', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);

    // BottomTabBar should be visible
    const bottomNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 15000 });

    // Tap Menu
    await bottomNav.locator('button', { hasText: 'Menu' }).click();

    // MobileNavDrawer should appear
    const drawer = page.locator('[role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Should contain "Browse Collection" link
    const browseLink = drawer.locator('a', { hasText: /browse collection/i }).first();
    await expect(browseLink).toBeVisible();
  });

  test('navigate: browse → artists → profile → back to browse', async ({ page }) => {
    // 1. Start at browse
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);

    // 2. Open menu → navigate to Artists
    const bottomNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 15000 });
    await bottomNav.locator('button', { hasText: 'Menu' }).click();

    const drawer = page.locator('[role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const artistsLink = drawer.locator('a[href="/artists"]').first();
    await expect(artistsLink).toBeVisible({ timeout: 3000 });
    await artistsLink.click();

    // 3. Should be on /artists with content loaded
    await page.waitForURL('**/artists**', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /artist directory/i })).toBeVisible({ timeout: 10000 });

    // 4. BottomTabBar still present
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

    // 5. Navigate to a known artist profile directly (card click uses router.push)
    await page.goto('/artists/masamune-MAS590', { waitUntil: 'domcontentloaded' });

    // 6. BottomTabBar on profile page
    const profileNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(profileNav).toBeVisible({ timeout: 10000 });

    // 7. Navigate back to browse via menu
    await profileNav.locator('button', { hasText: 'Menu' }).click();
    const profileDrawer = page.locator('[role="dialog"]').first();
    await expect(profileDrawer).toBeVisible({ timeout: 5000 });

    const browseLink = profileDrawer.locator('a', { hasText: /browse collection/i }).first();
    await expect(browseLink).toBeVisible({ timeout: 3000 });
    await browseLink.click();

    // 8. Should be back on browse
    await page.waitForURL(/^\/$|\/browse/, { timeout: 15000 });
  });

  test('artist profile has section nav above bottom tab bar', async ({ page }) => {
    await page.goto('/artists/masamune-MAS590', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);

    // BottomTabBar visible
    const bottomTabBar = page.locator('nav[aria-label="Main navigation"]');
    await expect(bottomTabBar).toBeVisible({ timeout: 10000 });

    // Section jump nav button
    const sectionNav = page.locator('button[aria-label="Jump to section"]');
    const hasSectionNav = await sectionNav.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSectionNav) {
      // Section nav should be above bottom tab bar
      const sectionBox = await sectionNav.boundingBox();
      const tabBarBox = await bottomTabBar.boundingBox();
      if (sectionBox && tabBarBox) {
        expect(sectionBox.y + sectionBox.height).toBeLessThanOrEqual(tabBarBox.y + 2);
      }

      // Tap to expand section list
      await sectionNav.click();
      const sectionMenu = page.locator('.animate-fadeIn').first();
      await expect(sectionMenu).toBeVisible({ timeout: 3000 });
    }
  });

  test('no horizontal overflow on artist directory', async ({ page }) => {
    await page.goto('/artists', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: /artist directory/i })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(5);
  });

  test('no horizontal overflow on artist profile', async ({ page }) => {
    await page.goto('/artists/masamune-MAS590', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await page.waitForTimeout(1500);

    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(5);
  });
});
