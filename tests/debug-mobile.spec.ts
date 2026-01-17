/**
 * DEBUG: Mobile QuickView functionality test
 * Tests mobile-specific issues with MOBILE viewport (390x844)
 *
 * Issues to test:
 * - Bottom sheet appearance
 * - X button close functionality
 * - Tapping image to collapse sheet
 * - Tapping collapsed sheet to expand
 */
import { test, expect } from '@playwright/test';

// Set mobile viewport globally for all tests
test.use({
  viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
});

test.describe('DEBUG: Mobile QuickView Sheet', () => {
  test.setTimeout(60000);

  test('1. Bottom sheet appears when QuickView opens', async ({ page }) => {
    // Navigate to browse page
    await page.goto('http://localhost:3000/browse');

    // Wait for listings to load
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    console.log('Found listing cards');

    // Click first listing card to open QuickView
    await listingCards.first().click();
    console.log('Clicked first listing card');

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400); // Wait for animation
    console.log('Modal dialog appeared');

    // Check if mobile sheet is visible
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const isSheetVisible = await mobileSheet.isVisible();
    console.log(`Mobile sheet visible: ${isSheetVisible}`);

    // Debug: check the mobile layout container
    const mobileLayout = page.locator('.lg\\:hidden');
    const mobileLayoutCount = await mobileLayout.count();
    console.log(`Found ${mobileLayoutCount} mobile layout containers`);

    // Get viewport info
    const viewportSize = page.viewportSize();
    console.log(`Viewport: ${viewportSize?.width}x${viewportSize?.height}`);

    expect(isSheetVisible).toBe(true);
  });

  test('2. X button on sheet is clickable and closes modal', async ({ page }) => {
    // Setup: Navigate and open QuickView
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Get the mobile sheet
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    await expect(mobileSheet).toBeVisible();
    console.log('Mobile sheet is visible');

    // Find the X button - it should have aria-label="Close"
    const closeButton = mobileSheet.locator('[aria-label="Close"]');
    const closeButtonCount = await closeButton.count();
    console.log(`Found ${closeButtonCount} close buttons in mobile sheet`);

    if (closeButtonCount > 0) {
      // Check button visibility
      const isButtonVisible = await closeButton.isVisible();
      console.log(`Close button visible: ${isButtonVisible}`);

      // Get button bounding box
      const buttonBox = await closeButton.boundingBox();
      console.log(`Button bounding box: ${JSON.stringify(buttonBox)}`);

      // Check if button is in expanded state (only shown when expanded)
      const sheetClasses = await mobileSheet.getAttribute('class');
      console.log(`Sheet classes: ${sheetClasses}`);

      // Try clicking the button
      try {
        await closeButton.click({ timeout: 3000 });
        console.log('Successfully clicked close button');
      } catch (e) {
        console.log(`Failed to click close button: ${e}`);

        // Debug: try force click
        await closeButton.click({ force: true });
        console.log('Force clicked close button');
      }

      // Wait for close animation
      await page.waitForTimeout(400);

      // Check if modal closed
      const modalCount = await page.locator('[role="dialog"]').count();
      console.log(`Remaining modals after close: ${modalCount}`);

      expect(modalCount).toBe(0);
    } else {
      console.log('ERROR: No close button found in mobile sheet!');
      // Debug: log entire sheet HTML
      const sheetHTML = await mobileSheet.innerHTML();
      console.log('Sheet HTML:', sheetHTML.substring(0, 500));
      expect(closeButtonCount).toBeGreaterThan(0);
    }
  });

  test('3. Tapping image area collapses the sheet', async ({ page }) => {
    // Setup: Navigate and open QuickView
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Get the mobile sheet
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const initialBox = await mobileSheet.boundingBox();
    console.log(`Initial sheet height: ${initialBox?.height}`);

    // Get the image scroll area (mobile layout, not lg:hidden but lg:hidden's child)
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();
    const imageAreaVisible = await imageArea.isVisible();
    console.log(`Image area visible: ${imageAreaVisible}`);

    // Tap on image area
    await imageArea.click();
    await page.waitForTimeout(400);

    // Get new sheet dimensions
    const collapsedBox = await mobileSheet.boundingBox();
    console.log(`Collapsed sheet height: ${collapsedBox?.height}`);

    // Sheet should be smaller now (collapsed ~48px, expanded up to 50vh)
    expect(collapsedBox?.height).toBeLessThan((initialBox?.height || 300) / 2);
  });

  test('4. Tapping collapsed sheet expands it', async ({ page }) => {
    // Setup: Navigate and open QuickView
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // First collapse the sheet
    const imageArea = page.locator('.lg\\:hidden .overflow-y-auto').first();
    await imageArea.click();
    await page.waitForTimeout(400);

    // Verify sheet is collapsed
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const collapsedBox = await mobileSheet.boundingBox();
    console.log(`Collapsed sheet height: ${collapsedBox?.height}`);
    expect(collapsedBox?.height).toBeLessThan(100);

    // Now tap the collapsed sheet to expand
    await mobileSheet.click();
    await page.waitForTimeout(400);

    // Verify sheet expanded
    const expandedBox = await mobileSheet.boundingBox();
    console.log(`Expanded sheet height: ${expandedBox?.height}`);

    expect(expandedBox?.height).toBeGreaterThan(100);
  });

  test('5. Debug: Check all button elements in modal', async ({ page }) => {
    // Setup: Navigate and open QuickView
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Get all buttons in the modal
    const modal = page.locator('[role="dialog"]');
    const buttons = modal.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Total buttons in modal: ${buttonCount}`);

    // Log each button's info
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const classes = await button.getAttribute('class');
      const isVisible = await button.isVisible();
      const box = await button.boundingBox();
      console.log(`Button ${i}: aria-label="${ariaLabel}", visible=${isVisible}, box=${JSON.stringify(box)}, classes="${classes?.substring(0, 50)}..."`);
    }

    // Debug: check visibility of desktop close button (should be hidden on mobile)
    const desktopCloseButton = modal.locator('button.hidden.lg\\:flex');
    const desktopCloseCount = await desktopCloseButton.count();
    console.log(`Desktop close buttons (hidden lg:flex): ${desktopCloseCount}`);

    if (desktopCloseCount > 0) {
      const desktopCloseVisible = await desktopCloseButton.first().isVisible();
      console.log(`Desktop close button visible: ${desktopCloseVisible}`);
    }

    // Check for mobile sheet close button
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const mobileCloseButton = mobileSheet.locator('button[aria-label="Close"]');
    const mobileCloseCount = await mobileCloseButton.count();
    console.log(`Mobile sheet close buttons: ${mobileCloseCount}`);

    if (mobileCloseCount > 0) {
      const mobileCloseVisible = await mobileCloseButton.isVisible();
      const mobileCloseBox = await mobileCloseButton.boundingBox();
      console.log(`Mobile close button visible: ${mobileCloseVisible}, box: ${JSON.stringify(mobileCloseBox)}`);
    }

    expect(buttonCount).toBeGreaterThan(0);
  });

  test('6. Debug: Check if sheet is in expanded state when close button should be visible', async ({ page }) => {
    // Setup: Navigate and open QuickView
    await page.goto('http://localhost:3000/browse');
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });
    await listingCards.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Get the mobile sheet
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const classes = await mobileSheet.getAttribute('class');
    console.log(`Sheet classes: ${classes}`);

    // Check if it has expanded class
    const hasExpandedClass = classes?.includes('sheet-expanded');
    const hasCollapsedClass = classes?.includes('sheet-collapsed');
    console.log(`Has sheet-expanded: ${hasExpandedClass}`);
    console.log(`Has sheet-collapsed: ${hasCollapsedClass}`);

    // The close button is only rendered when isExpanded is true
    // Check the sheet HTML to see what state it's in
    const sheetHTML = await mobileSheet.innerHTML();
    console.log('Sheet inner HTML (first 1000 chars):');
    console.log(sheetHTML.substring(0, 1000));

    // Should be expanded by default
    expect(hasExpandedClass).toBe(true);
  });
});
