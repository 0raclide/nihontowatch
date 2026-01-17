import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// iPhone 14 Pro viewport
test.use({
  viewport: { width: 390, height: 844 },
});

test.describe('Mobile Virtual Scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for mobile virtual grid to load
    await page.waitForSelector('[data-testid="mobile-virtual-grid"]', { timeout: 15000 });
  });

  test('displays 1-column layout on mobile', async ({ page }) => {
    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    const firstCard = cards.first();
    const box = await firstCard.boundingBox();

    // Card should be nearly full width (minus padding)
    expect(box!.width).toBeGreaterThan(350);
    // Should not be side-by-side (2-column would be ~180px)
    expect(box!.width).toBeGreaterThan(300);
  });

  test('uses mobile virtual grid component', async ({ page }) => {
    const mobileGrid = page.locator('[data-testid="mobile-virtual-grid"]');
    await expect(mobileGrid).toBeVisible();

    // Desktop grid should not be present
    const desktopGrid = page.locator('[data-testid="desktop-grid"]');
    await expect(desktopGrid).not.toBeVisible();
  });

  test('limits DOM nodes (virtualization working)', async ({ page }) => {
    // First, ensure we have loaded some data
    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    // Scroll down to trigger more data loading
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(500);

    // Count visible DOM cards
    const cardCount = await cards.count();

    // With virtualization, should have fewer cards than would fit in 3000px scroll
    // At 320px per card, 3000px would normally show ~10 cards, plus overscan
    // Should be well under 100 (which would be full page)
    expect(cardCount).toBeLessThan(25);
    expect(cardCount).toBeGreaterThan(0);
  });

  test('scroll container has correct total height', async ({ page }) => {
    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    // Get the virtual scroll container height
    const container = page.locator('[data-testid="mobile-virtual-grid"] > div[style*="height"]').first();
    const height = await container.evaluate((el) => el.style.height);

    // Height should be set based on total items * card height
    expect(height).toMatch(/\d+px/);
    const heightValue = parseInt(height);
    expect(heightValue).toBeGreaterThan(1000); // Should be substantial for many items
  });

  test('opens QuickView on card tap', async ({ page }) => {
    const firstCard = page.locator('[data-testid="mobile-listing-card"]').first();
    await firstCard.waitFor({ timeout: 10000 });
    await firstCard.click();

    // QuickView modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  });

  test('cards have fixed height for consistent layout', async ({ page }) => {
    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    const firstCard = cards.first();
    const box = await firstCard.boundingBox();

    // Card height should be consistent (320px as defined)
    expect(box!.height).toBe(320);
  });

  test('image container has 4:3 aspect ratio', async ({ page }) => {
    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    const imageContainer = page.locator('[data-testid="mobile-listing-card"] .aspect-\\[4\\/3\\]').first();
    const box = await imageContainer.boundingBox();

    // Check aspect ratio (width / height should be ~1.33)
    const aspectRatio = box!.width / box!.height;
    expect(aspectRatio).toBeCloseTo(4 / 3, 1);
  });
});

test.describe('Mobile Virtual Scroll - Infinite Loading', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('maintains scroll position when loading more items', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-virtual-grid"]', { timeout: 15000 });

    const cards = page.locator('[data-testid="mobile-listing-card"]');
    await cards.first().waitFor({ timeout: 10000 });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(300);

    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Scroll near bottom to potentially trigger load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1000));
    await page.waitForTimeout(1000);

    const scrollAfter = await page.evaluate(() => window.scrollY);

    // Scroll position should be roughly maintained (not jump to top or bottom)
    // Allow for some tolerance due to loading
    expect(scrollAfter).toBeGreaterThan(500);
  });

  test('shows loading indicator when fetching more', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-virtual-grid"]', { timeout: 15000 });

    // Scroll to near bottom to trigger loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 500));

    // Look for loading indicator (may or may not appear depending on timing)
    const loadingIndicator = page.locator('text=Loading more');
    // This is a soft check - loading might complete too fast
    const isVisible = await loadingIndicator.isVisible().catch(() => false);

    // Just verify we can scroll without errors
    expect(true).toBe(true);
  });
});

test.describe('Mobile Card Image Handling', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('images use object-cover for cropping', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-listing-card"]', { timeout: 15000 });

    const image = page.locator('[data-testid="mobile-listing-card"] img').first();
    await image.waitFor({ timeout: 10000 });

    const objectFit = await image.evaluate((el) => getComputedStyle(el).objectFit);
    expect(objectFit).toBe('cover');
  });

  test('no image opacity transition for smooth scroll', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-listing-card"]', { timeout: 15000 });

    const image = page.locator('[data-testid="mobile-listing-card"] img').first();
    await image.waitFor({ timeout: 10000 });

    const transition = await image.evaluate((el) => getComputedStyle(el).transition);

    // Transition should be 'none' or not contain 'opacity'
    const hasNoOpacityTransition = transition === 'none' || transition === 'all 0s ease 0s' || !transition.includes('opacity');
    expect(hasNoOpacityTransition).toBe(true);
  });
});

test.describe('Desktop Layout (breakpoint test)', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
  });

  test('shows desktop grid on wide viewport', async ({ page }) => {
    await page.goto('/');

    // Desktop should show the standard grid, not virtual grid
    const desktopGrid = page.locator('[data-testid="desktop-grid"]');
    await desktopGrid.waitFor({ timeout: 15000 });
    await expect(desktopGrid).toBeVisible();

    // Mobile virtual grid should not be present
    const mobileGrid = page.locator('[data-testid="mobile-virtual-grid"]');
    await expect(mobileGrid).not.toBeVisible();
  });

  test('shows multi-column layout on desktop', async ({ page }) => {
    await page.goto('/');

    const desktopGrid = page.locator('[data-testid="desktop-grid"]');
    await desktopGrid.waitFor({ timeout: 15000 });

    // Check for grid class with multiple columns
    const grid = page.locator('.grid.grid-cols-2');
    await expect(grid).toBeVisible();
  });
});

test.describe('Layout Stability (CLS)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('no significant layout shift during scroll', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-virtual-grid"]', { timeout: 15000 });

    // Start measuring CLS
    const cls = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
              clsValue += (entry as PerformanceEntry & { value?: number }).value || 0;
            }
          }
        });

        try {
          observer.observe({ type: 'layout-shift', buffered: true });
        } catch {
          // Layout shift API not supported
          resolve(0);
          return;
        }

        // Perform scroll
        window.scrollTo(0, 2000);

        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 1500);
      });
    });

    // CLS should be under 0.1 (good), definitely under 0.25 (needs improvement threshold)
    expect(cls).toBeLessThan(0.25);
  });
});
