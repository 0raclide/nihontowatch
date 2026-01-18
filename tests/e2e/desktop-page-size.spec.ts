import { test, expect } from '@playwright/test';

test.describe('Desktop Page Size - 100 items', () => {
  test('API returns 100 items by default', async ({ page }) => {
    // Intercept the API call to check what's returned
    let apiResponse: any = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/browse')) {
        try {
          apiResponse = await response.json();
          console.log('API Response:', {
            listingsCount: apiResponse.listings?.length,
            total: apiResponse.total,
            page: apiResponse.page,
            totalPages: apiResponse.totalPages,
          });
        } catch (e) {
          console.log('Could not parse API response');
        }
      }
    });

    // Go to homepage with desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Wait for the API call to complete
    await page.waitForResponse(response =>
      response.url().includes('/api/browse') && response.status() === 200
    );

    // Wait a bit for rendering
    await page.waitForTimeout(2000);

    // Verify API returned 100 items
    expect(apiResponse).not.toBeNull();
    expect(apiResponse.listings.length).toBe(100);
    console.log(`API returned ${apiResponse.listings.length} items`);
  });

  test('Grid renders all 100 items on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Intercept API to verify response
    let apiListingsCount = 0;
    page.on('response', async (response) => {
      if (response.url().includes('/api/browse')) {
        try {
          const data = await response.json();
          apiListingsCount = data.listings?.length || 0;
        } catch (e) {}
      }
    });

    await page.goto('/');

    // Wait for grid to load
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Count rendered listing cards
    const listingCards = await page.locator('[data-testid="virtual-listing-grid"] > div').count();

    console.log(`API returned: ${apiListingsCount} items`);
    console.log(`Grid rendered: ${listingCards} items`);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/desktop-grid.png', fullPage: true });

    // Should render all items from API
    expect(listingCards).toBe(apiListingsCount);
    expect(listingCards).toBe(100);
  });

  test('Debug: trace rendering pipeline', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Add console log listener
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('Browser console:', msg.text());
      }
    });

    await page.goto('/');

    // Wait for initial load
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Check various counts in the DOM
    const gridElement = page.locator('[data-testid="virtual-listing-grid"]');
    const directChildren = await gridElement.locator('> *').count();

    // Check the "Showing X of Y" text
    const showingText = await page.locator('text=/Showing.*of.*items/').textContent().catch(() => 'Not found');

    // Check if there's any virtualization container
    const virtualContainer = await page.locator('.virtual-scroll-container').count();

    console.log('=== Debug Info ===');
    console.log(`Direct grid children: ${directChildren}`);
    console.log(`Showing text: ${showingText}`);
    console.log(`Virtual containers: ${virtualContainer}`);

    // Get the actual HTML structure
    const gridHTML = await gridElement.evaluate(el => {
      return {
        childCount: el.children.length,
        className: el.className,
        parentClassName: el.parentElement?.className,
      };
    });
    console.log('Grid structure:', gridHTML);

    // Screenshot
    await page.screenshot({ path: 'test-results/desktop-debug.png', fullPage: true });
  });
});
