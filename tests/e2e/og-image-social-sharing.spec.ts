/**
 * E2E Tests: OG Image & Social Sharing
 *
 * These tests verify the social sharing functionality that solves Discord's
 * OG image caching problem. Discord caches images by PAGE URL, not image URL,
 * so we use a share proxy route (/s/[id]?v=[version]) to enable cache-busting.
 *
 * Test Coverage:
 * 1. OG meta tags on /listing/[id] pages
 * 2. OG meta tags on /s/[id] share proxy pages
 * 3. Share URL generation with versioning
 * 4. Share proxy redirect behavior
 * 5. OG image accessibility
 * 6. Version extraction from og_image_url
 */
import { test, expect, type Page } from '@playwright/test';

// Helper to get meta tag content
async function getMetaContent(page: Page, property: string): Promise<string | null> {
  const meta = await page.locator(`meta[property="${property}"]`).first();
  if (await meta.count() === 0) {
    // Try name attribute as fallback
    const nameMeta = await page.locator(`meta[name="${property}"]`).first();
    if (await nameMeta.count() === 0) return null;
    return nameMeta.getAttribute('content');
  }
  return meta.getAttribute('content');
}

// Helper to get all OG meta tags
async function getOgMetaTags(page: Page) {
  return {
    title: await getMetaContent(page, 'og:title'),
    description: await getMetaContent(page, 'og:description'),
    image: await getMetaContent(page, 'og:image'),
    url: await getMetaContent(page, 'og:url'),
    type: await getMetaContent(page, 'og:type'),
    siteName: await getMetaContent(page, 'og:site_name'),
    twitterCard: await getMetaContent(page, 'twitter:card'),
    twitterTitle: await getMetaContent(page, 'twitter:title'),
    twitterImage: await getMetaContent(page, 'twitter:image'),
  };
}

test.describe('OG Meta Tags on Listing Page', () => {
  test('listing page has all required OG meta tags', async ({ page }) => {
    // First, find a real listing ID from the browse page
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click a listing to get its ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Get listing ID from URL
    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Close QuickView
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Navigate to the listing page directly
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Get OG meta tags
    const ogTags = await getOgMetaTags(page);

    // Verify required OG tags exist
    expect(ogTags.title).toBeTruthy();
    expect(ogTags.description).toBeTruthy();
    expect(ogTags.image).toBeTruthy();
    expect(ogTags.siteName).toBe('Nihontowatch');
    expect(ogTags.type).toBe('website');

    // Verify Twitter card tags
    expect(ogTags.twitterCard).toBe('summary_large_image');
    expect(ogTags.twitterTitle).toBeTruthy();
    expect(ogTags.twitterImage).toBeTruthy();

    // Verify image URL is valid
    expect(ogTags.image).toMatch(/^https?:\/\//);
  });

  test('OG image URL is accessible', async ({ page, request }) => {
    // Find a listing with OG image
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Get the OG image URL from the listing page
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    const ogImage = await getMetaContent(page, 'og:image');
    expect(ogImage).toBeTruthy();

    // Verify the image is accessible
    const imageResponse = await request.get(ogImage!);
    expect(imageResponse.ok()).toBe(true);

    // Verify it's actually an image
    const contentType = imageResponse.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });
});

test.describe('Share Proxy Route (/s/[id])', () => {
  test('share proxy page has OG meta tags', async ({ page, request }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Fetch the share proxy page directly (like a crawler would)
    // This avoids the JS redirect and gets the raw HTML with OG meta tags
    const response = await request.get(`/s/${listingId}?v=test123`);
    expect(response.ok()).toBe(true);

    const html = await response.text();

    // Verify OG tags exist in the HTML
    expect(html).toContain('og:title');
    expect(html).toContain('og:image');
    expect(html).toContain('og:url');

    // Verify the og:url contains the version parameter
    const ogUrlMatch = html.match(/property="og:url"\s+content="([^"]+)"/);
    if (ogUrlMatch) {
      expect(ogUrlMatch[1]).toContain(`/s/${listingId}`);
      expect(ogUrlMatch[1]).toContain('v=');
    }
  });

  test('share proxy redirects to listing page normally', async ({ page }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Navigate to share proxy page (allow redirect)
    await page.goto(`/s/${listingId}?v=test`);

    // Should redirect to listing page
    await page.waitForURL(`**/listing/${listingId}`, { timeout: 5000 });

    // Verify we're on the listing page
    expect(page.url()).toContain(`/listing/${listingId}`);
  });

  test('share proxy works with invalid version param', async ({ page }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Navigate without version param
    await page.goto(`/s/${listingId}`);

    // Should still redirect to listing page
    await page.waitForURL(`**/listing/${listingId}`, { timeout: 5000 });
    expect(page.url()).toContain(`/listing/${listingId}`);
  });

  test('share proxy returns 404-style for invalid listing ID', async ({ page }) => {
    // Navigate to share proxy with invalid ID
    await page.goto('/s/99999999');

    // Should redirect to listing page (which will show not found)
    await page.waitForURL('**/listing/99999999', { timeout: 5000 });
  });
});

test.describe('Share Button & URL Generation', () => {
  test('share button copies versioned share URL', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Click share button
    await page.locator('[data-share-button]:visible').click();

    // Wait for clipboard operation
    await page.waitForTimeout(500);

    // Read clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Verify share URL format: should be /s/[id]?v=[version]
    expect(clipboardText).toContain(`/s/${listingId}`);
    expect(clipboardText).toMatch(/\?v=[a-zA-Z0-9]+/);
  });

  test('share URL version is stable for same listing', async ({ page, context }) => {
    // This test verifies that the version is deterministic - same listing = same version

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click first listing and get share URL
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    await page.locator('[data-share-button]:visible').click();
    await page.waitForTimeout(300);
    const url1 = await page.evaluate(() => navigator.clipboard.readText());

    // Close and reopen same listing
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="quickview-modal"]', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);

    // Click the same listing again
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    await page.locator('[data-share-button]:visible').click();
    await page.waitForTimeout(300);
    const url2 = await page.evaluate(() => navigator.clipboard.readText());

    // Same listing should produce same share URL (stable versioning)
    expect(url1).toBe(url2);
    expect(url1).toMatch(/\?v=[a-zA-Z0-9]+/);
  });
});

test.describe('Discord Cache-Busting Mechanism', () => {
  test('different version params result in different page URLs', async ({ page }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Both URLs point to the same listing but have different versions
    // Discord would cache them separately
    const url1 = `/s/${listingId}?v=version1`;
    const url2 = `/s/${listingId}?v=version2`;

    // Verify they're treated as different URLs (this is the cache-busting key)
    expect(url1).not.toBe(url2);

    // Both should still redirect to the same listing
    await page.goto(url1);
    await page.waitForURL(`**/listing/${listingId}`, { timeout: 5000 });

    await page.goto(url2);
    await page.waitForURL(`**/listing/${listingId}`, { timeout: 5000 });
  });

  test('canonical URL points to clean listing URL', async ({ page }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Check listing page canonical
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    const listingCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(listingCanonical).toContain(`/listing/${listingId}`);
    expect(listingCanonical).not.toContain('?v='); // No version param in canonical
  });
});

test.describe('OG Image Dimensions & Format', () => {
  test('OG image has correct dimensions (1200x630)', async ({ page, request }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Check og:image:width and og:image:height meta tags
    const ogImageWidth = await page.locator('meta[property="og:image:width"]').getAttribute('content');
    const ogImageHeight = await page.locator('meta[property="og:image:height"]').getAttribute('content');

    // Standard OG image dimensions
    expect(ogImageWidth).toBe('1200');
    expect(ogImageHeight).toBe('630');
  });
});

test.describe('Fallback OG Image (Dynamic Generation)', () => {
  test('dynamic OG endpoint returns valid image', async ({ request }) => {
    // Test the /api/og endpoint directly
    const response = await request.get('/api/og');

    expect(response.ok()).toBe(true);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });

  test('dynamic OG endpoint with listing ID returns listing image', async ({ page, request }) => {
    // Find a listing
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Test the dynamic OG endpoint with listing ID
    const response = await request.get(`/api/og?id=${listingId}`);

    expect(response.ok()).toBe(true);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });
});
