import { test, expect } from '@playwright/test';

/**
 * Debug test for QuickView YuhinkaiEnrichmentSection
 *
 * Issue: After connecting setsumei via AdminSetsumeiWidget,
 * the YuhinkaiEnrichmentSection doesn't show in QuickView
 */

test.describe('QuickView Yuhinkai Enrichment Debug', () => {
  test('should display YuhinkaiEnrichmentSection for listing with enrichment', async ({ page }) => {
    // Listing 7057 has yuhinkai_enrichment from manual connection (user confirmed)
    const listingId = 7057;

    // First check the API response
    const apiResponse = await page.request.get(`http://localhost:3000/api/listing/${listingId}?nocache=1`);
    const apiData = await apiResponse.json();

    console.log('=== API Response ===');
    console.log('Has yuhinkai_enrichment:', !!apiData.listing?.yuhinkai_enrichment);
    if (apiData.listing?.yuhinkai_enrichment) {
      const enrichment = apiData.listing.yuhinkai_enrichment;
      console.log('match_confidence:', enrichment.match_confidence);
      console.log('verification_status:', enrichment.verification_status);
      console.log('has setsumei_en:', !!enrichment.setsumei_en);
      console.log('setsumei_en length:', enrichment.setsumei_en?.length || 0);
    }
    console.log('=== End API Response ===');

    // Go directly to browse with listing param to open QuickView
    await page.goto(`/?listing=${listingId}`, { timeout: 60000 });

    // Wait for QuickView to open
    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 15000 });

    // Wait a bit for content to load
    await page.waitForTimeout(2000);

    // Debug: Log the entire QuickView content
    const quickViewContent = await page.locator('[data-testid="quickview-scrollable-content"]').innerHTML();
    console.log('=== QuickView Content (first 3000 chars) ===');
    console.log(quickViewContent.substring(0, 3000));
    console.log('=== End QuickView Content ===');

    // Check for YuhinkaiEnrichmentSection - it shows "Official Catalog Translation" header
    const yuhinkaiSection = page.locator('text=Official Catalog Translation');
    const hasYuhinkai = await yuhinkaiSection.count();
    console.log(`Has Official Catalog Translation: ${hasYuhinkai > 0}`);

    // Check for "Catalog Data" (shows when enrichment has no setsumei)
    const catalogDataSection = page.locator('text=Catalog Data');
    const hasCatalogData = await catalogDataSection.count();
    console.log(`Has Catalog Data: ${hasCatalogData > 0}`);

    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/quickview-yuhinkai-7057.png' });
    console.log('Screenshot saved');

    // The YuhinkaiEnrichmentSection should be visible
    await expect(yuhinkaiSection).toBeVisible({ timeout: 5000 });
  });

  test('debug: check what components render in QuickView', async ({ page }) => {
    await page.goto('/?listing=5671');

    await page.waitForSelector('[data-testid="quickview-scrollable-content"]', { timeout: 10000 });

    // Get all section headers in QuickView
    const headers = await page.locator('[data-testid="quickview-scrollable-content"] h3, [data-testid="quickview-scrollable-content"] .uppercase').allTextContents();
    console.log('=== Section Headers in QuickView ===');
    headers.forEach((h, i) => console.log(`${i + 1}. ${h}`));
    console.log('=== End Section Headers ===');

    // Take a screenshot for visual debugging
    await page.screenshot({ path: 'tests/e2e/screenshots/quickview-debug.png', fullPage: false });
    console.log('Screenshot saved to tests/e2e/screenshots/quickview-debug.png');
  });
});
