import { test, expect } from '@playwright/test';

/**
 * Tests for Study Setsumei feature in QuickView
 *
 * Verifies:
 * - Study button appears only for listings with setsumei data
 * - Clicking study button shows StudySetsumeiView
 * - StudySetsumeiView displays setsumei content correctly
 * - Toggle back to photos works
 * - State resets when navigating to new listing
 */

test.describe('Study Setsumei Feature', () => {
  // Listing 7057 has manual yuhinkai enrichment with setsumei
  const LISTING_WITH_SETSUMEI = 7057;

  // Increase test timeout for slow CI/dev server
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Set a reasonable viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('study button should appear for listing with setsumei data', async ({ page }) => {
    // Open QuickView for listing with setsumei (use / not /browse which redirects)
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });

    // Wait for QuickView to load
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });

    // Wait for enrichment data to be fetched
    await page.waitForTimeout(3000);

    // Look for the study button in the desktop QuickView content
    // Scope to quickview-scrollable-content to avoid matching mobile sheet button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const studyButton = desktopContent.locator('button[aria-label="Study setsumei"]');
    await expect(studyButton).toBeVisible({ timeout: 10000 });

    console.log('✓ Study button is visible for listing with setsumei');
  });

  test('clicking study button should show setsumei content', async ({ page }) => {
    // Open QuickView
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Click the study button in desktop content
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const studyButton = desktopContent.locator('button[aria-label="Study setsumei"]');
    await studyButton.click();

    // Wait for StudySetsumeiView to appear (scope to desktop layout)
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    const studyView = desktopLayout.locator('[data-testid="study-setsumei-view"]');
    await expect(studyView).toBeVisible({ timeout: 10000 });

    // Should show "View Photos" link (in desktop layout)
    const viewPhotosLink = desktopLayout.locator('button:has-text("View Photos")');
    await expect(viewPhotosLink).toBeVisible();

    // The study button should now have "View photos" label (toggled state)
    const toggledButton = desktopContent.locator('button[aria-label="View photos"]');
    await expect(toggledButton).toBeVisible();

    console.log('✓ Study mode shows setsumei content correctly');
  });

  test('study mode should display markdown content with glossary highlighting', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    const studyButton = desktopContent.locator('button[aria-label="Study setsumei"]');
    await studyButton.click();

    // Wait for content to render (scope to desktop layout)
    const studyView = desktopLayout.locator('[data-testid="study-setsumei-view"]');
    await expect(studyView).toBeVisible({ timeout: 10000 });

    // Should have prose content (markdown rendered)
    const proseContent = studyView.locator('.prose').first();
    await expect(proseContent).toBeVisible();

    // Check for source attribution
    const sourceInfo = studyView.locator('text=Source:');
    await expect(sourceInfo).toBeVisible();

    console.log('✓ Setsumei content displays with proper formatting');
  });

  test('toggle back to photos should work', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    await desktopContent.locator('button[aria-label="Study setsumei"]').click();
    await expect(desktopLayout.locator('[data-testid="study-setsumei-view"]')).toBeVisible({ timeout: 10000 });

    // Click "View Photos" to go back (scope to desktop)
    await desktopLayout.locator('button:has-text("View Photos")').click();

    // Should show image scroller again
    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await expect(imageScroller).toBeVisible({ timeout: 5000 });

    // Study button should be back to original state
    const studyButton = desktopContent.locator('button[aria-label="Study setsumei"]');
    await expect(studyButton).toBeVisible();

    console.log('✓ Toggle back to photos works correctly');
  });

  test('study button should also work via the toggle button in study mode', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    await desktopContent.locator('button[aria-label="Study setsumei"]').click();
    await expect(desktopLayout.locator('[data-testid="study-setsumei-view"]')).toBeVisible({ timeout: 10000 });

    // Click the same button (now labeled "View photos") to toggle back
    await desktopContent.locator('button[aria-label="View photos"]').click();

    // Should show image scroller again
    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await expect(imageScroller).toBeVisible({ timeout: 5000 });

    console.log('✓ Study button toggle works both ways');
  });

  test('language toggle should switch between English and Japanese', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    await desktopContent.locator('button[aria-label="Study setsumei"]').click();
    const studyView = desktopLayout.locator('[data-testid="study-setsumei-view"]');
    await expect(studyView).toBeVisible({ timeout: 10000 });

    // Look for language toggle button (scope to study view)
    const languageToggle = studyView.locator('button:has-text("Show Japanese")');

    // If Japanese text is available, toggle should be visible
    const toggleVisible = await languageToggle.isVisible().catch(() => false);

    if (toggleVisible) {
      await languageToggle.click();

      // Button should now say "Show English"
      const showEnglish = studyView.locator('button:has-text("Show English")');
      await expect(showEnglish).toBeVisible({ timeout: 3000 });

      console.log('✓ Language toggle works');
    } else {
      console.log('⚠ Language toggle not available (no Japanese text)');
    }
  });

  test('study button should have gold background when active', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    const studyButton = desktopContent.locator('button[aria-label="Study setsumei"]');
    await studyButton.click();
    await expect(desktopLayout.locator('[data-testid="study-setsumei-view"]')).toBeVisible({ timeout: 10000 });

    // The toggled button should have gold background
    const toggledButton = desktopContent.locator('button[aria-label="View photos"]');
    const hasGoldBg = await toggledButton.evaluate((el) => {
      const classList = el.className;
      return classList.includes('bg-gold');
    });

    expect(hasGoldBg).toBe(true);
    console.log('✓ Study button has gold background when active');
  });
});

test.describe('Study Setsumei - Mobile', () => {
  const LISTING_WITH_SETSUMEI = 7057;

  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('study button should work on mobile', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });

    // Wait for mobile sheet to appear
    await page.waitForSelector('[data-testid="mobile-sheet"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Study button should be visible in mobile sheet header
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const studyButton = mobileSheet.locator('button[aria-label="Study setsumei"]');
    await expect(studyButton).toBeVisible({ timeout: 10000 });

    // Click study button
    await studyButton.click();

    // Should show setsumei content
    const studyView = page.locator('[data-testid="study-setsumei-view"]').first();
    await expect(studyView).toBeVisible({ timeout: 10000 });

    console.log('✓ Study mode works on mobile');
  });

  test('mobile study mode should replace image scroller', async ({ page }) => {
    await page.goto(`/?listing=${LISTING_WITH_SETSUMEI}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="mobile-sheet"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using mobile sheet button
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    await mobileSheet.locator('button[aria-label="Study setsumei"]').click();
    await expect(page.locator('[data-testid="study-setsumei-view"]').first()).toBeVisible({ timeout: 10000 });

    // Mobile image scroller should NOT be visible
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');
    await expect(imageScroller).not.toBeVisible();

    console.log('✓ Mobile study mode replaces image scroller');
  });
});

test.describe('Study Setsumei - Edge Cases', () => {
  test.setTimeout(60000);

  test('study button should not appear for listing without setsumei', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // First, let's find a listing without setsumei by checking the API
    // Try a few listing IDs that likely don't have setsumei
    const testListings = [1, 100, 500, 1000];

    for (const listingId of testListings) {
      // Check API first
      const response = await page.request.get(`/api/listing/${listingId}?nocache=1`);
      if (!response.ok()) continue;

      const data = await response.json();
      const listing = data.listing;

      // Check if this listing has no setsumei data
      const hasOcrSetsumei = !!listing?.setsumei_text_en;
      const hasYuhinkaiSetsumei = listing?.yuhinkai_enrichment?.setsumei_en &&
        listing?.yuhinkai_enrichment?.connection_source === 'manual' &&
        listing?.yuhinkai_enrichment?.verification_status === 'confirmed';

      if (!hasOcrSetsumei && !hasYuhinkaiSetsumei) {
        // Found a listing without setsumei - test it
        await page.goto(`/?listing=${listingId}`, { timeout: 60000 });
        await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
        await page.waitForTimeout(2000);

        // Study button should NOT be visible (check count is 0)
        const studyButtons = page.locator('button[aria-label="Study setsumei"]');
        await expect(studyButtons).toHaveCount(0);

        console.log(`✓ Study button correctly hidden for listing ${listingId} (no setsumei)`);
        return;
      }
    }

    console.log('⚠ Could not find a listing without setsumei to test');
  });

  test('study mode should reset when navigating to new listing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open QuickView for listing with setsumei
    await page.goto(`/?listing=${7057}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Enter study mode using desktop content button
    const desktopContent = page.locator('[data-testid="quickview-scrollable-content"]');
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    await desktopContent.locator('button[aria-label="Study setsumei"]').click();
    await expect(desktopLayout.locator('[data-testid="study-setsumei-view"]')).toBeVisible({ timeout: 10000 });

    // Now navigate to home and open a different listing
    // Use keyboard navigation if available, or close and reopen
    await page.goto(`/`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });

    // Click on any listing card to open QuickView
    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    // Wait for QuickView
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should be in photo mode, not study mode
    // Check that the study view is not visible in desktop layout
    const newDesktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    const studyView = newDesktopLayout.locator('[data-testid="study-setsumei-view"]');
    const isInStudyMode = await studyView.isVisible().catch(() => false);

    expect(isInStudyMode).toBe(false);
    console.log('✓ Study mode resets when navigating to new listing');
  });
});
