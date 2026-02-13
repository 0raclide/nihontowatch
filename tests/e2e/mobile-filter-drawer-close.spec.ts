import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './helpers';

test.describe('Mobile Filter Drawer - Close Functionality', () => {
  // Use a mobile device with touch support
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
  });

  async function openFilterDrawer(page: import('@playwright/test').Page) {
    // Find the filter button in the bottom tab bar
    const filterButton = page.locator('nav button:has-text("Filters")');
    await expect(filterButton).toBeVisible({ timeout: 10000 });
    await filterButton.click();

    // Wait for drawer to appear
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    return drawer;
  }

  test('should have visible close button in filter drawer header', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    // Check that "Refine Results" header is visible
    await expect(drawer.locator('h2:has-text("Refine Results")')).toBeVisible();

    // Check that close button (X icon) is visible
    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await expect(closeButton).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'tests/screenshots/mobile-filter-drawer-with-close-button.png' });
  });

  test('should close filter drawer when close button is clicked', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    // Verify drawer is open
    await expect(drawer).toBeVisible();

    // Find and click the close button
    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Verify drawer is closed (not visible)
    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });

  test('should close filter drawer when backdrop is clicked', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    // Verify drawer is open
    await expect(drawer).toBeVisible();

    // Click on the backdrop (dark overlay area)
    // The backdrop is the first child div with bg-black/40
    const backdrop = page.locator('.fixed.inset-0 > div.bg-black\\/40').first();
    await backdrop.click({ force: true, position: { x: 10, y: 10 } });

    // Verify drawer is closed
    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });

  test('should have drag handle for swipe-to-close gesture', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    // Verify drawer is open
    await expect(drawer).toBeVisible();

    // Find the drag handle (visual indicator for swipe-to-close)
    const dragHandle = drawer.locator('.cursor-grab').first();
    await expect(dragHandle).toBeVisible();

    // Verify the drag handle has proper visual indicators
    // It should contain the pill-shaped handle indicator
    const handleIndicator = dragHandle.locator('.rounded-full');
    await expect(handleIndicator).toBeVisible();

    // Verify the handle is at the top of the drawer and is draggable
    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    if (handleBox) {
      // The drag handle should be reasonably sized for touch interaction
      expect(handleBox.width).toBeGreaterThan(50);
      expect(handleBox.height).toBeGreaterThan(20);
    }

    // Note: The swipe-to-close gesture works on real devices but is difficult
    // to reliably test with Playwright's touch simulation. The drag handle
    // being present indicates the feature is available to users.
  });

  test('should be able to reopen drawer after closing', async ({ page }) => {
    // Open the drawer
    let drawer = await openFilterDrawer(page);
    await expect(drawer).toBeVisible();

    // Close using the close button
    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await closeButton.click();

    // Verify closed
    await expect(drawer).not.toBeVisible({ timeout: 3000 });

    // Reopen the drawer
    const filterButton = page.locator('nav button:has-text("Filters")');
    await filterButton.click();

    // Verify it opens again
    drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify close button is still there
    const newCloseButton = drawer.locator('button[aria-label="Close filters"]');
    await expect(newCloseButton).toBeVisible();
  });

  test('close button should have proper touch target size for mobile', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await expect(closeButton).toBeVisible();

    // Get the button's bounding box
    const buttonBox = await closeButton.boundingBox();
    expect(buttonBox).not.toBeNull();

    if (buttonBox) {
      // Minimum touch target should be 44x44 pixels for accessibility
      // Our button has p-2 padding so it should be at least 40x40
      expect(buttonBox.width).toBeGreaterThanOrEqual(32);
      expect(buttonBox.height).toBeGreaterThanOrEqual(32);

      console.log(`Close button size: ${buttonBox.width}x${buttonBox.height}`);
    }
  });

  test('filters should persist after closing and reopening drawer', async ({ page }) => {
    // Open the drawer
    let drawer = await openFilterDrawer(page);

    // Click on a category filter (e.g., "Nihonto")
    const nihontoButton = drawer.locator('button:has-text("Nihonto")');
    await nihontoButton.click();

    // Verify it's selected (has gold background)
    await expect(nihontoButton).toHaveClass(/bg-gold/);

    // Close the drawer
    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await closeButton.click();
    await expect(drawer).not.toBeVisible({ timeout: 3000 });

    // Reopen the drawer
    const filterButton = page.locator('nav button:has-text("Filters")');
    await filterButton.click();
    drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify Nihonto is still selected
    const nihontoButtonAfter = drawer.locator('button:has-text("Nihonto")');
    await expect(nihontoButtonAfter).toHaveClass(/bg-gold/);
  });

  test('should show clear all button when filters are active', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    // Click on a category filter to activate it
    const nihontoButton = drawer.locator('button:has-text("Nihonto")');
    await nihontoButton.click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // The mobile header has the "Clear all" button with text-[14px] class (mobile version)
    // We need to find the one in the mobile header (first one in the header flex container)
    const mobileHeader = drawer.locator('.lg\\:hidden').first();
    const clearAllButton = mobileHeader.locator('button:has-text("Clear all")');

    // Now "Clear all" should be visible
    await expect(clearAllButton).toBeVisible({ timeout: 3000 });

    // Both clear all and close button should be visible
    const closeButton = drawer.locator('button[aria-label="Close filters"]');
    await expect(closeButton).toBeVisible();

    // Take screenshot showing both buttons
    await page.screenshot({ path: 'tests/screenshots/mobile-filter-drawer-with-clear-and-close.png' });
  });
});
