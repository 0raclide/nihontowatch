/**
 * Test: Verify shared URLs with ?listing=<id> open QuickView directly
 *
 * This test ensures that when someone shares a listing URL,
 * the recipient sees the QuickView modal immediately upon navigation.
 */
import { test, expect } from '@playwright/test';

test.describe('Share URL deep linking', () => {
  test('navigating to URL with ?listing= param opens QuickView automatically', async ({ page }) => {
    // First, go to browse and find a real listing ID
    await page.goto('/');

    // Wait for listings to load
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click a listing card to open QuickView and get the listing ID from URL
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Get the listing ID from the URL
    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Close the QuickView
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify QuickView is closed
    await expect(page.locator('[data-testid="quickview-modal"]')).not.toBeVisible();

    // Now simulate sharing: navigate directly to the URL with ?listing= param
    await page.goto(`/?listing=${listingId}`);

    // QuickView should open automatically
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="quickview-modal"]')).toBeVisible();

    // Verify URL still has the listing param
    expect(page.url()).toContain(`listing=${listingId}`);
  });

  test('shared URL with filters preserves filters and opens QuickView', async ({ page }) => {
    // First, find a real listing ID
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Navigate to URL with both filters and listing param
    await page.goto(`/?type=katana&listing=${listingId}`);

    // QuickView should open automatically
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="quickview-modal"]')).toBeVisible();

    // URL should have both params
    expect(page.url()).toContain('type=katana');
    expect(page.url()).toContain(`listing=${listingId}`);
  });

  test('share button copies URL to clipboard (desktop)', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Get expected listing ID
    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');

    // Click share button (use the visible one)
    await page.locator('[data-share-button]:visible').click();

    // Wait for toast to appear
    await page.waitForTimeout(500);

    // Read clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Verify clipboard contains the share proxy URL with listing ID
    // Format: /s/{listingId}?v={version}
    expect(clipboardText).toContain(`/s/${listingId}`);
    expect(clipboardText).toMatch(/\?v=[a-zA-Z0-9]+/);
  });
});
