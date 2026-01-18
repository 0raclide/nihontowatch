/**
 * Test: Verify QuickView close does not cause scroll position jump on desktop
 *
 * This regression test ensures that closing QuickView modal doesn't cause
 * a jarring scroll position change in the listing grid.
 */
import { test, expect } from '@playwright/test';

test.describe('QuickView scroll position stability', () => {
  // Use base URL from config
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('desktop: scroll position stable after closing QuickView via close button', async ({ page }) => {
    // Navigate to browse page
    await page.goto('/browse');

    // Wait for listings grid to load
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });
    const cards = page.locator('[role="button"]');
    await cards.first().waitFor({ timeout: 5000 });

    // Scroll down to test scroll restoration
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);

    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Open QuickView
    await cards.first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(350); // Wait for open animation

    // Close via button
    await page.locator('[data-testid="quickview-close-button"]').click();
    await page.waitForTimeout(500); // Wait for close animation + rAF

    const scrollAfter = await page.evaluate(() => window.scrollY);
    const jumpAmount = Math.abs(scrollAfter - scrollBefore);

    // Scroll should be within 10px tolerance (no jarring jump)
    expect(jumpAmount).toBeLessThan(10);
  });

  test('desktop: scroll position stable after closing QuickView via Escape', async ({ page }) => {
    await page.goto('/browse');

    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });
    const cards = page.locator('[role="button"]');
    await cards.first().waitFor({ timeout: 5000 });

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(100);

    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Open and close via Escape
    await cards.first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(350);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const scrollAfter = await page.evaluate(() => window.scrollY);
    const jumpAmount = Math.abs(scrollAfter - scrollBefore);

    expect(jumpAmount).toBeLessThan(10);
  });
});
