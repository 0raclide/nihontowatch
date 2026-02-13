import { test, expect } from '@playwright/test';

test.describe('Artist type + header search interaction', () => {

  // Increase timeout — production pages may load slowly
  test.setTimeout(60000);

  test('Header search while on tosogu artists page', async ({ page }) => {
    // 1. Navigate to artists with tosogu selected
    await page.goto('/artists?type=tosogu', { waitUntil: 'domcontentloaded' });
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);
    console.log('Step 1 - On tosogu artists page');

    // 2. Type in the HEADER search bar
    const headerSearch = page.locator('header input[type="search"]').first();
    const headerSearchVisible = await headerSearch.isVisible().catch(() => false);
    console.log('Header search visible:', headerSearchVisible);

    if (headerSearchVisible) {
      await headerSearch.fill('Nobuie');
      console.log('Step 3 - Typed "Nobuie" in header search');

      // Press Enter to submit
      await headerSearch.press('Enter');
      await page.waitForTimeout(3000);

      const urlAfterHeaderSearch = page.url();
      console.log('Step 3 - URL after header search submit:', urlAfterHeaderSearch);

      // Should stay on artists page and preserve type
      expect(urlAfterHeaderSearch).toContain('/artists');
      expect(urlAfterHeaderSearch).toContain('type=tosogu');
    }
  });

  test('Sidebar search specifically preserves tosogu type', async ({ page }) => {
    // Use sidebar search explicitly
    await page.goto('/artists?type=tosogu', { waitUntil: 'domcontentloaded' });
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // Target the visible sidebar search (use .first() since mobile drawer also has one)
    const sidebarSearch = page.locator('input[placeholder*="Name, kanji"]').first();

    // Type and wait for results - simulate fast typing
    await sidebarSearch.type('Katsuhira', { delay: 50 });
    await page.waitForTimeout(1500);

    let url = page.url();
    console.log('After typing Katsuhira:', url);
    expect(url).toContain('type=tosogu');

    // Now clear and search again quickly
    await sidebarSearch.fill('');
    await page.waitForTimeout(200);
    await sidebarSearch.type('Nobuie', { delay: 50 });
    await page.waitForTimeout(1500);

    url = page.url();
    console.log('After typing Nobuie:', url);
    expect(url).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // Quick succession - clear and search again immediately
    await sidebarSearch.fill('');
    await sidebarSearch.type('Goto', { delay: 30 });
    await page.waitForTimeout(1500);

    url = page.url();
    console.log('After typing Goto:', url);
    expect(url).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);
  });
});
