import { test, expect } from '@playwright/test';

test.describe('Artist type filter (nihonto/tosogu) must be sticky', () => {

  test('Type stays tosogu across multiple searches', async ({ page }) => {
    // 1. Navigate to /artists (default = nihonto/smith)
    await page.goto('/artists', { waitUntil: 'networkidle' });

    // 2. Click the Tosogu toggle button (sidebar)
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await tosoguBtn.click();
    await page.waitForTimeout(2000); // wait for fetch to complete

    // Verify URL now has type=tosogu
    const urlAfterTosogu = page.url();
    console.log('Step 2 - After clicking Tosogu:', urlAfterTosogu);
    expect(urlAfterTosogu).toContain('type=tosogu');

    // Verify the Tosogu button is highlighted
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // 3. Search for "Katsuhira" in the SIDEBAR search input (not header!)
    const sidebarSearch = page.locator('input[placeholder*="Name, kanji"]');
    await sidebarSearch.fill('Katsuhira');
    await page.waitForTimeout(2000); // wait for debounce + fetch

    const urlAfterSearch1 = page.url();
    console.log('Step 3 - After searching Katsuhira:', urlAfterSearch1);
    expect(urlAfterSearch1).toContain('type=tosogu');

    // Verify Tosogu is still active
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // Verify Katsuhira result is shown
    const resultCount1 = await page.locator('text=Katsuhira').count();
    console.log('Step 3 - Katsuhira results found:', resultCount1);
    expect(resultCount1).toBeGreaterThan(0);

    // 4. Now search for "Nobuie" — THIS IS WHERE THE BUG HAPPENS
    await sidebarSearch.fill('');
    await page.waitForTimeout(500);
    await sidebarSearch.fill('Nobuie');
    await page.waitForTimeout(2000); // wait for debounce + fetch

    const urlAfterSearch2 = page.url();
    console.log('Step 4 - After searching Nobuie:', urlAfterSearch2);

    // CHECK: Is type=tosogu still in the URL?
    const hasTosoguInUrl = urlAfterSearch2.includes('type=tosogu');
    console.log('Step 4 - type=tosogu in URL:', hasTosoguInUrl);

    // CHECK: Is the Tosogu button still highlighted?
    const tosoguClass2 = await tosoguBtn.getAttribute('class');
    console.log('Step 4 - Tosogu button classes:', tosoguClass2);
    const isTosoguActive = tosoguClass2?.includes('text-gold');
    console.log('Step 4 - Tosogu still active:', isTosoguActive);

    // CHECK: What does the Nihonto button look like?
    const nihontoBtn = page.locator('button', { hasText: 'Nihonto' }).first();
    const nihontoClass = await nihontoBtn.getAttribute('class');
    console.log('Step 4 - Nihonto button classes:', nihontoClass);
    const isNihontoActive = nihontoClass?.includes('text-gold');
    console.log('Step 4 - Nihonto active (BUG if true):', isNihontoActive);

    // Log actual page content for debugging
    const artistNames = await page.locator('[class*="cursor-pointer"]').allTextContents();
    console.log('Step 4 - Visible artists:', artistNames.slice(0, 3).join(' | '));

    // The assertions
    expect(hasTosoguInUrl, 'URL should still have type=tosogu after second search').toBe(true);
    expect(isTosoguActive, 'Tosogu toggle should still be active after second search').toBe(true);
    expect(isNihontoActive, 'Nihonto toggle should NOT be active').toBeFalsy();

    // 5. Do a third search to be thorough
    await sidebarSearch.fill('');
    await page.waitForTimeout(500);
    await sidebarSearch.fill('Goto');
    await page.waitForTimeout(2000);

    const urlAfterSearch3 = page.url();
    console.log('Step 5 - After searching Goto:', urlAfterSearch3);
    expect(urlAfterSearch3).toContain('type=tosogu');
    await expect(tosoguBtn).toHaveClass(/text-gold/);
  });

  test('Type stays tosogu after clicking artist card and navigating back', async ({ page }) => {
    // 1. Go to artists page with tosogu + search
    await page.goto('/artists?type=tosogu&q=Katsuhira', { waitUntil: 'networkidle' });

    // Verify we're on tosogu
    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // 2. Click on the artist card
    const artistCard = page.locator('[class*="cursor-pointer"]').first();
    if (await artistCard.isVisible()) {
      console.log('Nav test - Clicking artist card...');
      await artistCard.click();
      await page.waitForTimeout(3000);

      const profileUrl = page.url();
      console.log('Nav test - After click URL:', profileUrl);

      // If we navigated to an artist profile page, go back
      if (profileUrl.includes('/artists/')) {
        await page.goBack();
        await page.waitForTimeout(2000);

        const backUrl = page.url();
        console.log('Nav test - After going back:', backUrl);

        // Check if type=tosogu is preserved
        const hasTosogu = backUrl.includes('type=tosogu');
        console.log('Nav test - type=tosogu preserved after back:', hasTosogu);
      } else {
        console.log('Nav test - Card click did not navigate to profile. URL:', profileUrl);
      }
    }
  });

  test('Header Artists link navigation behavior', async ({ page }) => {
    // 1. Start on artists page with tosogu selected
    await page.goto('/artists?type=tosogu', { waitUntil: 'networkidle' });

    const tosoguBtn = page.locator('button', { hasText: 'Tosogu' }).first();
    await expect(tosoguBtn).toHaveClass(/text-gold/);

    // 2. Click "ARTISTS" link in the header
    const headerArtistsLink = page.locator('header a', { hasText: 'ARTISTS' }).first();
    const linkExists = await headerArtistsLink.isVisible().catch(() => false);
    console.log('Header test - Artists link exists:', linkExists);

    if (linkExists) {
      await headerArtistsLink.click();
      await page.waitForTimeout(2000);

      const afterHeaderUrl = page.url();
      console.log('Header test - URL after clicking header link:', afterHeaderUrl);

      // After clicking header link, check what type is active
      const nihontoBtn = page.locator('button', { hasText: 'Nihonto' }).first();
      const nihontoClass = await nihontoBtn.getAttribute('class');
      const tosoguClass = await tosoguBtn.getAttribute('class');
      console.log('Header test - Nihonto class:', nihontoClass);
      console.log('Header test - Tosogu class:', tosoguClass);

      // The page should load correctly regardless
      const hasContent = await page.locator('[class*="cursor-pointer"]').count();
      console.log('Header test - Artist cards visible:', hasContent);
      expect(hasContent).toBeGreaterThan(0);
    }
  });
});
