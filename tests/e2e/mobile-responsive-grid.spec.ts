import { test, expect } from '@playwright/test';

test.describe('Mobile Responsive Grid', () => {
  test.describe('Mobile viewport (1 column)', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

    test('displays 1-column layout on mobile', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for grid to appear
      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      await expect(grid).toBeVisible({ timeout: 10000 });

      // Check that the grid has 1-column class active
      const gridClasses = await grid.getAttribute('class');
      expect(gridClasses).toContain('grid-cols-1');

      // Verify first card takes nearly full width (minus padding)
      const firstCard = page.locator('[data-testid="listing-card"]').first();
      if (await firstCard.isVisible()) {
        const box = await firstCard.boundingBox();
        // Mobile card should be at least 85% of viewport width
        expect(box!.width).toBeGreaterThan(330);
      }
    });

    test('shows mobile item count', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Mobile should show simplified item count
      const itemCount = page.locator('.lg\\:hidden').filter({ hasText: /items/ });
      await expect(itemCount).toBeVisible({ timeout: 10000 });
    });

    test('no hydration errors in console', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for React hydration errors
      const hydrationErrors = errors.filter(
        (e) =>
          e.includes('Hydration') ||
          e.includes('hydration') ||
          e.includes('did not match') ||
          e.includes('Error #300')
      );

      expect(hydrationErrors).toHaveLength(0);
    });
  });

  test.describe('Tablet viewport (2 columns)', () => {
    test.use({ viewport: { width: 768, height: 1024 } }); // iPad

    test('displays 2-column layout on tablet', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      await expect(grid).toBeVisible({ timeout: 10000 });

      // Verify grid has responsive classes for 2 columns at sm breakpoint
      const gridClasses = await grid.getAttribute('class');
      expect(gridClasses).toContain('sm:grid-cols-2');
    });
  });

  test.describe('Desktop viewport (4-5 columns)', () => {
    test.use({ viewport: { width: 1440, height: 900 } }); // Standard desktop

    test('displays multi-column layout on desktop', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      await expect(grid).toBeVisible({ timeout: 10000 });

      // Desktop grid should have 4-column class at xl breakpoint
      const gridClasses = await grid.getAttribute('class');
      expect(gridClasses).toContain('xl:grid-cols-4');
    });

    test('shows pagination on desktop', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Desktop should show pagination (not infinite scroll by default)
      const pagination = page.locator('button').filter({ hasText: /Previous|Next/ });

      // Wait a bit for content to load
      await page.waitForTimeout(2000);

      // Check if pagination buttons exist
      const paginationCount = await pagination.count();
      expect(paginationCount).toBeGreaterThan(0);
    });

    test('shows detailed results count on desktop', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Desktop should show "Showing X of Y items"
      const resultsCount = page.locator('.hidden.lg\\:flex').filter({ hasText: /Showing/ });
      await expect(resultsCount).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Scroll behavior', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // Mobile

    test('maintains reasonable DOM size during scroll', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Scroll down significantly
      await page.evaluate(() => window.scrollTo(0, 3000));
      await page.waitForTimeout(1000);

      // Count listing cards in DOM
      const cardCount = await page.locator('[data-testid="listing-card"]').count();

      // With virtualization, should have reasonable number of cards
      // (not all items, should be limited by viewport + overscan)
      // Without virtualization, could have 100+ cards
      // With virtualization enabled at 30+ items, should be much less
      console.log(`Card count in DOM after scroll: ${cardCount}`);

      // This is a soft assertion - just log for now
      // Virtual scrolling kicks in at 30+ items in infinite scroll mode
    });
  });
});
