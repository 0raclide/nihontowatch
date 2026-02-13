import { test, expect } from '@playwright/test';

test.describe('Artist type filter (nihonto/tosogu) must be sticky', () => {

  // Increase timeout — production pages may load slowly
  test.setTimeout(60000);

  test('Type stays tosogu across multiple searches', async ({ page }) => {
    // 1. Navigate to /artists (default = nihonto/smith)
    await page.goto('/artists', { waitUntil: 'domcontentloaded' });

    // 2. Click the Tosogu toggle button (sidebar) — wait for hydration first
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await tosoguBtn.waitFor();
    // Wait for hydration: sidebar search becomes interactive
    await page.locator('input[placeholder*="Name, kanji"]').first().waitFor();
    await page.waitForTimeout(500);

    await tosoguBtn.click();
    // Wait for the click to take effect (class change confirms React handled it)
    await expect(tosoguBtn).toHaveClass(/text-gold/, { timeout: 5000 });

    // Verify URL now has type=tosogu
    expect(page.url()).toContain('type=tosogu');

    // 3. Search for "Katsuhira" in the SIDEBAR search input
    const sidebarSearch = page.locator('input[placeholder*="Name, kanji"]').first();
    await sidebarSearch.fill('Katsuhira');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);
    expect(await page.locator('text=Katsuhira').count()).toBeGreaterThan(0);

    // 4. Search for "Nobuie"
    await sidebarSearch.fill('');
    await page.waitForTimeout(500);
    await sidebarSearch.fill('Nobuie');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // 5. Third search
    await sidebarSearch.fill('');
    await page.waitForTimeout(500);
    await sidebarSearch.fill('Goto');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);
  });

  test('Artist card navigates to profile page', async ({ page }) => {
    // Navigate to artists page with a search to get a known result
    await page.goto('/artists?type=tosogu&q=Katsuhira', { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="/artists/"]').first().waitFor();

    // Click the artist card link (now a proper <a> element)
    const artistLink = page.locator('a[href*="/artists/"]').first();
    const href = await artistLink.getAttribute('href');
    console.log('Artist link href:', href);

    await artistLink.click();
    await page.waitForTimeout(3000);

    const profileUrl = page.url();
    console.log('Profile URL:', profileUrl);
    expect(profileUrl).toMatch(/\/artists\/[a-z]/);

    // Go back to directory
    await page.goBack();
    await page.waitForTimeout(2000);

    const backUrl = page.url();
    console.log('After back:', backUrl);
    expect(backUrl).toContain('type=tosogu');
  });

  test('Header Artists link resets to default state', async ({ page }) => {
    // 1. Start on artists page with tosogu + search
    await page.goto('/artists?type=tosogu&q=Katsuhira', { waitUntil: 'domcontentloaded' });
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // 2. Click "ARTISTS" link in the header — should reset to defaults
    const headerArtistsLink = page.locator('header a', { hasText: 'ARTISTS' }).first();
    await headerArtistsLink.click();
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('After header Artists click:', url);

    // Should have navigated to /artists without type param (fresh default)
    const nihontoBtn = page.locator('button', { hasText: 'Nihonto' }).first();
    const nihontoClass = await nihontoBtn.getAttribute('class');
    const tosoguClass = await tosoguBtn.getAttribute('class');
    console.log('Nihonto class:', nihontoClass);
    console.log('Tosogu class:', tosoguClass);

    // Nihonto should be active (default), Tosogu should not
    expect(nihontoClass).toContain('text-gold');
    expect(tosoguClass).not.toContain('text-gold');

    // Page should show artist cards
    const cardCount = await page.locator('a[href*="/artists/"]').count();
    console.log('Artist cards visible:', cardCount);
    expect(cardCount).toBeGreaterThan(0);
  });
});
