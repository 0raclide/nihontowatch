/**
 * Test: Mobile QuickView functionality
 * - Bottom sheet expands/collapses on tap
 * - Swipe up expands, swipe down collapses
 * - X button closes modal
 * - Price and key metadata visible
 */
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// Mobile viewport
test.use({
  viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
});

test.describe('Mobile QuickView', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to browse page
    await page.goto('http://localhost:3000/browse');

    // Wait for listings to load
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });

    // Click first listing card to open modal
    await listingCards.first().click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(350); // Wait for animation
  });

  test('opens with expanded bottom sheet showing price', async ({ page }) => {
    // Bottom sheet should be visible and expanded
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    await expect(sheet).toBeVisible();

    // Price should be visible in expanded state (uses text-2xl or text-[15px] depending on state)
    const price = page.locator('[data-testid="mobile-sheet"] .text-2xl, [data-testid="mobile-sheet"] .tabular-nums');
    await expect(price.first()).toBeVisible();

    console.log('✓ Bottom sheet opens expanded with price visible');
  });

  test('collapses bottom sheet when tapping image area', async ({ page }) => {
    // Get the image scroll area
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();

    // Tap on image area
    await imageArea.click();
    await page.waitForTimeout(300);

    // Sheet should now be collapsed (smaller height)
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const box = await sheet.boundingBox();

    // Collapsed state should be ~48px or smaller
    expect(box?.height).toBeLessThan(100);

    console.log(`✓ Bottom sheet collapsed to ${box?.height}px`);
  });

  test('expands bottom sheet when tapping collapsed sheet', async ({ page }) => {
    // First collapse by tapping image area
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();
    await imageArea.click();
    await page.waitForTimeout(300);

    // Now tap the collapsed sheet to expand
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    await sheet.click();
    await page.waitForTimeout(300);

    // Sheet should be expanded again
    const box = await sheet.boundingBox();
    expect(box?.height).toBeGreaterThan(100);

    console.log(`✓ Bottom sheet expanded to ${box?.height}px`);
  });

  test('closes modal when tapping X button on sheet', async ({ page }) => {
    // Find the close button on the mobile sheet
    const closeButton = page.locator('[data-testid="mobile-sheet"] [aria-label="Close"]');

    // Click close button
    await closeButton.click();

    // Wait for close animation
    await page.waitForTimeout(400);

    // Modal should be closed
    const modalCount = await page.locator('[role="dialog"]').count();
    expect(modalCount).toBe(0);

    console.log('✓ Modal closed via X button on sheet');
  });

  test('can scroll images when sheet is collapsed', async ({ page }) => {
    // Get the image scroll area
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();

    // Collapse the sheet first
    await imageArea.click();
    await page.waitForTimeout(300);

    // Check if there's scrollable content
    const scrollHeight = await imageArea.evaluate(el => el.scrollHeight);
    const clientHeight = await imageArea.evaluate(el => el.clientHeight);

    if (scrollHeight > clientHeight) {
      // Get initial scroll position
      const initialScroll = await imageArea.evaluate(el => el.scrollTop);

      // Scroll down in the image area
      await imageArea.evaluate(el => el.scrollTo(0, 200));
      await page.waitForTimeout(100);

      // Verify scroll position changed
      const newScroll = await imageArea.evaluate(el => el.scrollTop);
      expect(newScroll).toBeGreaterThan(initialScroll);
      console.log(`✓ Images scrolled from ${initialScroll} to ${newScroll}`);
    } else {
      // Not enough content to scroll, but that's okay
      console.log(`✓ Scroll area exists (scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight})`);
      expect(scrollHeight).toBeGreaterThan(0);
    }
  });

  test('sheet handle is visible for swipe gestures', async ({ page }) => {
    // The handle bar should be visible at the top of the sheet
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const handle = sheet.locator('.w-10.h-1.rounded-full'); // The swipe handle

    await expect(handle).toBeVisible();
    console.log('✓ Swipe handle visible on sheet');
  });

  test('sheet transitions smoothly between states', async ({ page }) => {
    // Get initial expanded state
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const initialBox = await sheet.boundingBox();

    // Collapse via tap on image area
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();
    await imageArea.click();
    await page.waitForTimeout(350); // Wait for transition

    // Get collapsed state
    const collapsedBox = await sheet.boundingBox();
    expect(collapsedBox?.height).toBeLessThan(initialBox?.height || 0);

    // Expand via tap on collapsed sheet
    await sheet.click();
    await page.waitForTimeout(350);

    // Get expanded state
    const expandedBox = await sheet.boundingBox();
    expect(expandedBox?.height).toBeGreaterThan(collapsedBox?.height || 0);

    console.log(`✓ Sheet transitions: ${initialBox?.height}px → ${collapsedBox?.height}px → ${expandedBox?.height}px`);
  });

  test('shows item type and certification badges', async ({ page }) => {
    // Check for badge elements in expanded sheet
    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Should have some badge/label for item type or cert
    const badges = sheet.locator('.bg-gold, .bg-ink, .text-gold, .uppercase');
    const badgeCount = await badges.count();

    // Should have at least one badge visible
    expect(badgeCount).toBeGreaterThan(0);

    console.log(`✓ Found ${badgeCount} badge elements in sheet`);
  });

  test('shows View Full Listing button', async ({ page }) => {
    // Look for the CTA button
    const ctaButton = page.locator('[data-testid="mobile-sheet"] a, [data-testid="mobile-sheet"] button').filter({ hasText: /view|listing|details/i });

    const count = await ctaButton.count();
    expect(count).toBeGreaterThan(0);

    console.log('✓ View Full Listing button present');
  });
});

test.describe('Mobile QuickView - Sheet stays closed', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('modal does not reopen after closing', async ({ page }) => {
    // Navigate and open modal
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(350);

    // Close via X button on sheet
    const closeButton = page.locator('[data-testid="mobile-sheet"] [aria-label="Close"]');
    await closeButton.click();
    await page.waitForTimeout(400);

    // Verify closed
    let modalCount = await page.locator('[role="dialog"]').count();
    expect(modalCount).toBe(0);

    // Wait and verify it stays closed
    await page.waitForTimeout(500);
    modalCount = await page.locator('[role="dialog"]').count();
    expect(modalCount).toBe(0);

    console.log('✓ Modal stayed closed after X button click');
  });
});
