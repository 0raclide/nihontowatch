import { test, expect } from '@playwright/test';

test.describe('Artist type + header search interaction', () => {

  test('Header search while on tosogu artists page', async ({ page }) => {
    // 1. Navigate to artists with tosogu selected
    await page.goto('/artists?type=tosogu', { waitUntil: 'networkidle' });

    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);
    console.log('Step 1 - On tosogu artists page ✓');

    // 2. Find all search inputs and log them
    const allSearchInputs = page.locator('input[type="search"]');
    const count = await allSearchInputs.count();
    console.log(`Found ${count} search inputs on page`);

    for (let i = 0; i < count; i++) {
      const placeholder = await allSearchInputs.nth(i).getAttribute('placeholder');
      const isVisible = await allSearchInputs.nth(i).isVisible();
      console.log(`  Input ${i}: placeholder="${placeholder}", visible=${isVisible}`);
    }

    // 3. Type in the HEADER search bar (first search input — the one in the navbar)
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

      // Check what page we're on
      const hasArtistsPath = urlAfterHeaderSearch.includes('/artists');
      const hasBrowsePath = urlAfterHeaderSearch.includes('/browse') || urlAfterHeaderSearch === 'https://nihontowatch.com/';
      console.log('Step 3 - On artists page:', hasArtistsPath);
      console.log('Step 3 - On browse page:', hasBrowsePath);

      // If we got redirected to browse, the user would see nihonto swords
      if (hasBrowsePath) {
        console.log('BUG SCENARIO: Header search navigated away from artists to browse!');
        console.log('User would see swords (nihonto) and think type reverted.');
      }
    }
  });

  test('Sidebar search specifically preserves tosogu type', async ({ page }) => {
    // Use sidebar search explicitly
    await page.goto('/artists?type=tosogu', { waitUntil: 'networkidle' });

    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // Target sidebar search specifically
    const sidebarSearch = page.locator('input[placeholder*="Name, kanji"]');
    const sidebarVisible = await sidebarSearch.isVisible();
    console.log('Sidebar search visible:', sidebarVisible);

    // Type and wait for results - simulate fast typing
    await sidebarSearch.type('Katsuhira', { delay: 50 });
    await page.waitForTimeout(1500);

    let url = page.url();
    console.log('After typing Katsuhira:', url);
    expect(url).toContain('type=tosogu');

    // Count results
    const resultText = await page.locator('text=/\\d+ artist/').first().textContent();
    console.log('Results:', resultText);

    // Now clear and search again quickly
    await sidebarSearch.fill('');
    await page.waitForTimeout(200); // very short wait
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
