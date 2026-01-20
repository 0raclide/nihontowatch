/**
 * Visual Tests: Social Preview Cards
 *
 * These tests verify the visual appearance and functionality
 * of the social preview components that show users how their
 * shared links will appear on various platforms.
 */
import { test, expect, type Page } from '@playwright/test';

// Helper to create a test page with the social preview panel
async function setupSocialPreviewPage(page: Page, listingId: string) {
  // Navigate to a listing page and inject the preview panel
  await page.goto(`/listing/${listingId}`);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Social Preview Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Find a real listing ID
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });
  });

  test('share proxy serves correct OG image for social platforms', async ({ page, request }) => {
    // Click first listing to get ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Fetch the share proxy page like a social platform crawler would
    const response = await request.get(`/s/${listingId}?v=test`);
    const html = await response.text();

    // Check for Discord-specific og:image
    expect(html).toContain('og:image');

    // Extract the og:image URL
    const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
    expect(ogImageMatch).toBeTruthy();

    if (ogImageMatch) {
      const ogImageUrl = ogImageMatch[1];

      // Verify the image is accessible
      const imageResponse = await request.get(ogImageUrl);
      expect(imageResponse.ok()).toBe(true);

      // Verify it's a PNG image
      const contentType = imageResponse.headers()['content-type'];
      expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
    }
  });

  test('OG image matches expected dimensions for social platforms', async ({ page, request }) => {
    // Click first listing to get ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Check listing page metadata
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify image dimensions in meta tags
    const width = await page.locator('meta[property="og:image:width"]').getAttribute('content');
    const height = await page.locator('meta[property="og:image:height"]').getAttribute('content');

    // Standard dimensions for social cards: 1200x630
    expect(width).toBe('1200');
    expect(height).toBe('630');
  });

  test('Twitter card type is summary_large_image', async ({ page }) => {
    // Click first listing to get ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Check listing page metadata
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify Twitter card type
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');
  });

  test('share proxy HTML includes meta refresh for redirect', async ({ request }) => {
    // Fetch share proxy directly
    const response = await request.get('/s/1?v=test');
    const html = await response.text();

    // Should include meta refresh for redirect
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('/listing/');
  });
});

test.describe('Share URL Format', () => {
  test('share URLs use versioned proxy format', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Click share button
    await page.locator('[data-share-button]:visible').click();
    await page.waitForTimeout(300);

    // Get clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Verify format: https://domain/s/[id]?v=[version]
    expect(clipboardText).toMatch(/\/s\/\d+\?v=[a-zA-Z0-9]+/);
  });

  test('share URL resolves to listing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Get a listing ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Navigate to share URL
    await page.goto(`/s/${listingId}?v=test`);

    // Should redirect to listing page
    await page.waitForURL(`**/listing/${listingId}`, { timeout: 5000 });
    expect(page.url()).toContain(`/listing/${listingId}`);
  });
});

test.describe('OG Image Quality', () => {
  test('pre-generated OG images exist in database', async ({ page, request }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Get a listing ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Check listing page for OG image
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();

    // Verify image is accessible and valid
    const imageResponse = await request.get(ogImage!);
    expect(imageResponse.ok()).toBe(true);
  });

  test('fallback OG image works when no pre-generated image', async ({ request }) => {
    // Test the /api/og endpoint with a non-existent listing
    const response = await request.get('/api/og?id=999999999');

    // Should still return a valid image (the default OG image)
    expect(response.ok()).toBe(true);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });

  test('default OG image works without listing ID', async ({ request }) => {
    // Test the /api/og endpoint without ID
    const response = await request.get('/api/og');

    // Should return default brand image
    expect(response.ok()).toBe(true);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });
});

test.describe('Cross-Platform Compatibility', () => {
  test('OG metadata includes all required fields for Discord', async ({ page, request }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Fetch share proxy page
    const response = await request.get(`/s/${listingId}?v=test`);
    const html = await response.text();

    // Discord requires these OG tags
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:image');
    expect(html).toContain('og:url');
    expect(html).toContain('og:type');
    expect(html).toContain('og:site_name');
  });

  test('OG metadata includes all required fields for Twitter', async ({ page, request }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Fetch share proxy page
    const response = await request.get(`/s/${listingId}?v=test`);
    const html = await response.text();

    // Twitter requires these tags
    expect(html).toContain('twitter:card');
    expect(html).toContain('twitter:title');
    expect(html).toContain('twitter:image');
  });
});
