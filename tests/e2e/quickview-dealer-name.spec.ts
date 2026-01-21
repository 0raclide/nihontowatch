/**
 * Test: Verify dealer name displays correctly in QuickView
 *
 * BUG REPRODUCTION:
 * - On first load with ?listing=X, dealer name shows correctly (via DeepLinkHandler mapping)
 * - After closing and reopening QuickView by clicking a card, dealer name shows only "Dealer"
 *
 * Root cause: ListingCard passes listing with `dealers` (plural, Supabase join syntax)
 * but QuickViewContent expects `listing.dealer.name` (singular, canonical type).
 * DeepLinkHandler correctly maps `dealers` -> `dealer`, but ListingCard does not.
 */
import { test, expect } from '@playwright/test';

test.describe('QuickView dealer name display', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('dealer name persists after close and reopen via card click', async ({ page }) => {
    // Step 1: Navigate to browse page (no listing param)
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Step 2: Click on first listing card to open QuickView
    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    // Step 3: Wait for QuickView modal to appear
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(300); // Animation settle

    // Step 4: Verify dealer name is NOT just "Dealer" (should be actual dealer name)
    const dealerNameElement = page.locator('[data-testid="dealer-name"]');
    const dealerNameText = await dealerNameElement.textContent();

    console.log('First open - dealer name:', dealerNameText);

    // The dealer name should not be the fallback "Dealer"
    // It should be an actual dealer name like "Touken Matsumoto", "Aoi Art", etc.
    expect(dealerNameText).not.toBe('Dealer');
    expect(dealerNameText?.length).toBeGreaterThan(0);

    // Store the dealer name for comparison
    const firstDealerName = dealerNameText;

    // Step 5: Close the QuickView via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400); // Wait for close animation

    // Verify modal is closed
    await expect(page.locator('[data-testid="quickview-modal"]')).not.toBeVisible();

    // Step 6: Click on the same card again
    await firstCard.click();

    // Step 7: Wait for QuickView to reopen
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Step 8: Verify dealer name is STILL the actual name, not "Dealer"
    const dealerNameAfterReopen = await dealerNameElement.textContent();

    console.log('After reopen - dealer name:', dealerNameAfterReopen);

    // BUG: This assertion will fail if the bug exists
    // The dealer name should be the same as before, not the fallback "Dealer"
    expect(dealerNameAfterReopen).toBe(firstDealerName);
    expect(dealerNameAfterReopen).not.toBe('Dealer');
  });

  test('dealer name shows correctly when opening via deep link', async ({ page }) => {
    // Navigate with a specific listing ID (deep link)
    // This uses DeepLinkHandler which correctly maps dealers -> dealer
    await page.goto('/?tab=available&listing=1');

    // Wait for QuickView to open via DeepLinkHandler
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify dealer name is not the fallback
    const dealerNameElement = page.locator('[data-testid="dealer-name"]');
    const dealerNameText = await dealerNameElement.textContent();

    console.log('Deep link - dealer name:', dealerNameText);

    // Should have actual dealer name from the deep link fetch
    expect(dealerNameText).not.toBe('Dealer');
  });

  test('CTA button shows correct dealer name', async ({ page }) => {
    // This tests the "View on {dealerName}" button
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Get the CTA button text
    const ctaButton = page.locator('[data-testid="cta-button"]');
    const ctaText = await ctaButton.textContent();

    console.log('CTA button text:', ctaText);

    // Should say "View on {actual dealer name}" not "View on Dealer"
    expect(ctaText).not.toMatch(/View on Dealer$/);
  });

  test('dealer name persists after keyboard navigation (J/K keys)', async ({ page }) => {
    // This is the CRITICAL regression test - navigation broke dealer names
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView on first card
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Verify first listing has real dealer name
    const dealerNameElement = page.locator('[data-testid="dealer-name"]');
    const firstDealerName = await dealerNameElement.textContent();
    console.log('First listing dealer:', firstDealerName);
    expect(firstDealerName).not.toBe('Dealer');

    // Navigate to next listing with J key
    await page.keyboard.press('j');
    await page.waitForTimeout(300);

    // CRITICAL: After navigation, dealer name should NOT be "Dealer"
    const secondDealerName = await dealerNameElement.textContent();
    console.log('Second listing dealer (after J key):', secondDealerName);
    expect(secondDealerName).not.toBe('Dealer');
    expect(secondDealerName?.length).toBeGreaterThan(0);

    // Navigate back with K key
    await page.keyboard.press('k');
    await page.waitForTimeout(300);

    // Should still have real dealer name
    const backDealerName = await dealerNameElement.textContent();
    console.log('Back to first (after K key):', backDealerName);
    expect(backDealerName).not.toBe('Dealer');
    expect(backDealerName).toBe(firstDealerName);

    // Navigate forward multiple times to test different dealers
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
      const navDealerName = await dealerNameElement.textContent();
      console.log(`Navigation ${i + 2} dealer:`, navDealerName);
      // Each listing should have a real dealer name, not the fallback
      expect(navDealerName).not.toBe('Dealer');
    }
  });
});
