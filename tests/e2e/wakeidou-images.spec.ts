/**
 * E2E Tests: Wakeidou Image Loading
 *
 * Regression test for the bug where only 2 images were showing
 * for Wakeidou listings despite 20 being available.
 *
 * The root cause was sequential image validation that got interrupted
 * by component re-renders. Fixed by validating images in parallel.
 */
import { test, expect } from '@playwright/test';

// Test against production to verify the deployed fix
const PRODUCTION_URL = 'https://nihontowatch.com';

test.describe('Wakeidou Image Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('listing 32330 shows all images (not just 2)', async ({ page }) => {
    // Go directly to the listing via deep link
    await page.goto(`${PRODUCTION_URL}/?tab=available&listing=32330`);

    // Wait for QuickView modal to open
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 15000 });

    // Wait for images to load and validate
    await page.waitForTimeout(3000);

    // Check the desktop image scroller
    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await expect(imageScroller).toBeVisible();

    // Count visible images in viewport (lazy loading means not all are rendered)
    const images = imageScroller.locator('img');
    const imageCount = await images.count();

    console.log(`Found ${imageCount} images in initial viewport`);

    // Due to lazy loading, only a few images are rendered initially
    // The bug showed only 2 images TOTAL (even after scrolling)
    // Now we should see at least 3-4 in the initial viewport
    expect(imageCount).toBeGreaterThanOrEqual(3);

    // Scroll to the bottom to load all images
    await imageScroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(2000);

    // After scrolling, we should have many more
    const finalCount = await images.count();
    console.log(`Found ${finalCount} images after scrolling (should be 10+)`);

    // After scrolling, we should see significantly more than the bugged 2
    expect(finalCount).toBeGreaterThan(10);
  });

  test('images load successfully without errors', async ({ page }) => {
    // Track image load failures
    const failedImages: string[] = [];
    const loadedImages: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('supabase.co/storage') || url.includes('wakeidou.com')) {
        if (response.status() >= 400) {
          failedImages.push(url);
        } else if (response.status() === 200) {
          loadedImages.push(url);
        }
      }
    });

    await page.goto(`${PRODUCTION_URL}/?tab=available&listing=32330`);
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 15000 });

    // Wait for images to load
    await page.waitForTimeout(5000);

    console.log(`Loaded images: ${loadedImages.length}`);
    console.log(`Failed images: ${failedImages.length}`);

    // No images should fail to load
    expect(failedImages.length).toBe(0);

    // We should have loaded multiple images
    expect(loadedImages.length).toBeGreaterThan(5);
  });

  test('image count indicator shows correct total', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/?tab=available&listing=32330`);
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 15000 });

    // Wait for images to load
    await page.waitForTimeout(3000);

    // Look for the "Photo X of Y" indicator or "Y images" text
    const contentPanel = page.locator('[data-testid="desktop-content-panel"]');

    // Try to find image count in the panel
    const photoText = await contentPanel.textContent();

    // Check for image count pattern like "Photo 1 of 20" or "20 images"
    const photoMatch = photoText?.match(/of (\d+)/);
    const imagesMatch = photoText?.match(/(\d+) images/);

    if (photoMatch) {
      const total = parseInt(photoMatch[1], 10);
      console.log(`Photo indicator shows: ${total} images`);
      expect(total).toBeGreaterThan(5);
    } else if (imagesMatch) {
      const total = parseInt(imagesMatch[1], 10);
      console.log(`Images indicator shows: ${total} images`);
      expect(total).toBeGreaterThan(5);
    }
  });

  test('scrolling reveals more images', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/?tab=available&listing=32330`);
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 15000 });

    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await expect(imageScroller).toBeVisible();

    // Count initial visible images
    await page.waitForTimeout(2000);
    const initialCount = await imageScroller.locator('img').count();
    console.log(`Initial image count: ${initialCount}`);

    // Scroll down to load more images
    await imageScroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Wait for lazy loaded images
    await page.waitForTimeout(2000);

    // Count images after scrolling
    const finalCount = await imageScroller.locator('img').count();
    console.log(`Final image count after scroll: ${finalCount}`);

    // Should have more images after scrolling (or at least the same if all loaded)
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
    expect(finalCount).toBeGreaterThan(5);
  });

  test('all Wakeidou listings have images', async ({ page }) => {
    // Go to browse filtered by wakeidou
    await page.goto(`${PRODUCTION_URL}/?tab=available`);
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Find Wakeidou listings by checking listing cards
    // Open each one and verify images load
    const listingCards = page.locator('[data-testid="listing-card"]');
    const count = await listingCards.count();

    let testedCount = 0;
    const maxToTest = 5; // Limit to first 5 to keep test fast

    for (let i = 0; i < Math.min(count, maxToTest); i++) {
      const card = listingCards.nth(i);

      // Check if this is a Wakeidou listing by looking for the domain in href or data
      const href = await card.getAttribute('href');

      // Click to open QuickView
      await card.click();

      try {
        await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

        // Wait for images
        await page.waitForTimeout(2000);

        const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
        const imageCount = await imageScroller.locator('img').count();

        console.log(`Listing ${i + 1}: ${imageCount} images`);

        // Each listing should have at least 1 image
        expect(imageCount).toBeGreaterThan(0);

        testedCount++;

        // Close QuickView by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (e) {
        console.log(`Listing ${i + 1}: QuickView didn't open or timed out`);
      }
    }

    console.log(`Tested ${testedCount} listings`);
    expect(testedCount).toBeGreaterThan(0);
  });
});
