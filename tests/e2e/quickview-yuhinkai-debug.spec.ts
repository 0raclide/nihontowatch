import { test, expect } from '@playwright/test';

/**
 * Tests for QuickView YuhinkaiEnrichmentSection display logic
 *
 * Verifies:
 * - Manual connections ARE displayed
 * - Auto-matched connections are NOT displayed (SHOW_AUTO_MATCHED_ENRICHMENTS = false)
 */

test.describe('QuickView Yuhinkai Enrichment', () => {
  test('should display YuhinkaiEnrichmentSection for MANUAL connection', async ({ page }) => {
    // Listing 7057 has yuhinkai_enrichment from manual connection
    const listingId = 7057;

    // First check the API response to confirm it's a manual connection
    const apiResponse = await page.request.get(`/api/listing/${listingId}?nocache=1`);
    const apiData = await apiResponse.json();
    const enrichment = apiData.listing?.yuhinkai_enrichment;

    console.log('=== Listing 7057 (Manual Connection) ===');
    console.log('connection_source:', enrichment?.connection_source);
    console.log('verification_status:', enrichment?.verification_status);
    console.log('has setsumei_en:', !!enrichment?.setsumei_en);

    // Verify it's a manual connection
    expect(enrichment?.connection_source).toBe('manual');

    // Open QuickView
    await page.goto(`/?listing=${listingId}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for async data fetch

    // Manual connections SHOULD show "Official Catalog Translation"
    const yuhinkaiSection = page.locator('text=Official Catalog Translation');
    await expect(yuhinkaiSection).toBeVisible({ timeout: 5000 });

    console.log('✓ Manual connection displays correctly');
  });

  test('should NOT display YuhinkaiEnrichmentSection for AUTO-MATCHED connection', async ({ page }) => {
    // Listing 6758 has yuhinkai_enrichment from auto-matcher (false positive)
    const listingId = 6758;

    // First check the API response to confirm it's an auto connection
    const apiResponse = await page.request.get(`/api/listing/${listingId}?nocache=1`);
    const apiData = await apiResponse.json();
    const enrichment = apiData.listing?.yuhinkai_enrichment;

    console.log('=== Listing 6758 (Auto-Matched Connection) ===');
    console.log('connection_source:', enrichment?.connection_source);
    console.log('verification_status:', enrichment?.verification_status);
    console.log('enriched_maker:', enrichment?.enriched_maker);
    console.log('enriched_school:', enrichment?.enriched_school);

    // Verify it's an auto connection (null or 'auto')
    expect(enrichment?.connection_source === null || enrichment?.connection_source === 'auto').toBe(true);

    // Open QuickView
    await page.goto(`/?listing=${listingId}`, { timeout: 60000 });
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for async data fetch

    // Auto-matched connections should NOT show any Yuhinkai section
    const officialTranslation = page.locator('text=Official Catalog Translation');
    const catalogData = page.locator('text=Catalog Data');

    // Neither should be visible
    await expect(officialTranslation).not.toBeVisible();
    await expect(catalogData).not.toBeVisible();

    console.log('✓ Auto-matched connection correctly hidden');
  });

  test('API should include connection_source field', async ({ page }) => {
    // Verify the API returns connection_source for debugging
    const response = await page.request.get('/api/listing/7057?nocache=1');
    const data = await response.json();

    expect(data.listing.yuhinkai_enrichment).toBeDefined();
    expect('connection_source' in data.listing.yuhinkai_enrichment).toBe(true);

    console.log('connection_source value:', data.listing.yuhinkai_enrichment.connection_source);
  });
});
