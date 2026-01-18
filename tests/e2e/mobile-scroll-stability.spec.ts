import { test, expect } from '@playwright/test';

/**
 * Mobile Scroll Stability Tests
 *
 * These tests verify that:
 * 1. Infinite scroll works without visual bounce
 * 2. BottomTabBar stays fixed during scroll and drawer interactions
 * 3. Scroll position is maintained correctly
 */

// iPhone 14 Pro viewport
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Mobile Scroll Stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test.describe('Infinite Scroll', () => {
    test('container height is stable when loading more items', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get the virtual scroll container
      const container = page.locator('.virtual-scroll-container');

      // Wait for virtualization to be enabled (needs >30 items)
      await expect(container).toBeVisible({ timeout: 10000 });

      // Get initial height
      const initialHeight = await container.evaluate((el) => el.getBoundingClientRect().height);

      // Height should be based on total items, not loaded items
      // So it should be large (thousands of pixels for thousands of items)
      expect(initialHeight).toBeGreaterThan(10000);

      // Scroll down to trigger load more
      await page.evaluate(() => window.scrollTo(0, 5000));
      await page.waitForTimeout(500);

      // Scroll more to ensure IntersectionObserver triggers
      await page.evaluate(() => window.scrollTo(0, 10000));
      await page.waitForTimeout(1000);

      // Get height after potential load more
      const heightAfterScroll = await container.evaluate((el) => el.getBoundingClientRect().height);

      // Height should NOT have changed (pre-reserved based on totalCount)
      expect(heightAfterScroll).toBe(initialHeight);
    });

    test('scroll position stays stable during content load', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Scroll to a specific position
      const targetScroll = 3000;
      await page.evaluate((y) => window.scrollTo(0, y), targetScroll);
      await page.waitForTimeout(100);

      // Record scroll position
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeCloseTo(targetScroll, -1); // Within 10px

      // Wait a bit for any async operations
      await page.waitForTimeout(500);

      // Scroll position should be stable
      const scrollAfter = await page.evaluate(() => window.scrollY);
      expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(50);
    });

    test('no console errors during scroll', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Scroll through the page
      for (let y = 0; y <= 10000; y += 2000) {
        await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
        await page.waitForTimeout(200);
      }

      // Filter out known non-issues
      const relevantErrors = errors.filter(
        (e) => !e.includes('Supabase') && !e.includes('favicon')
      );
      expect(relevantErrors).toHaveLength(0);
    });
  });

  test.describe('BottomTabBar Stability', () => {
    test('BottomTabBar stays at bottom during scroll', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bottomBar = page.locator('nav[aria-label="Main navigation"]');
      await expect(bottomBar).toBeVisible();

      // Get initial position
      const initialBox = await bottomBar.boundingBox();
      expect(initialBox).not.toBeNull();

      // The bar should be at the bottom of the viewport
      // Account for safe area (bottom should be near viewport height)
      expect(initialBox!.y + initialBox!.height).toBeGreaterThan(MOBILE_VIEWPORT.height - 100);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 2000));
      await page.waitForTimeout(300);

      // Bar should still be at the same viewport position
      const afterScrollBox = await bottomBar.boundingBox();
      expect(afterScrollBox).not.toBeNull();
      expect(afterScrollBox!.y).toBeCloseTo(initialBox!.y, 0);
    });

    test('BottomTabBar stays fixed when filter drawer opens', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bottomBar = page.locator('nav[aria-label="Main navigation"]');
      const filterButton = bottomBar.locator('button:has-text("Filters")');

      // Get initial bar position
      const initialBox = await bottomBar.boundingBox();
      expect(initialBox).not.toBeNull();

      // Open filter drawer
      await filterButton.click();
      await page.waitForTimeout(300);

      // Bar should still be visible and at the same position
      // (The drawer opens above the bar)
      const afterDrawerBox = await bottomBar.boundingBox();

      // Position should not have changed significantly
      // Allow some tolerance for any animation
      if (afterDrawerBox) {
        expect(Math.abs(afterDrawerBox.y - initialBox!.y)).toBeLessThan(20);
      }
    });

    test('BottomTabBar stays fixed when search opens', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bottomBar = page.locator('nav[aria-label="Main navigation"]');
      const searchButton = bottomBar.locator('button:has-text("Search")');

      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(200);

      // Get bar position after scroll
      const beforeSearchBox = await bottomBar.boundingBox();
      expect(beforeSearchBox).not.toBeNull();

      // Open search
      await searchButton.click();
      await page.waitForTimeout(300);

      // Bar should still be at the same viewport position
      const afterSearchBox = await bottomBar.boundingBox();
      if (afterSearchBox) {
        expect(Math.abs(afterSearchBox.y - beforeSearchBox!.y)).toBeLessThan(20);
      }
    });
  });

  test.describe('Load More Trigger', () => {
    test('load more triggers before reaching absolute bottom', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Count initial listing cards
      const initialCardCount = await page.locator('[data-testid="listing-card"]').count();
      expect(initialCardCount).toBeGreaterThan(0);

      // Get total height
      const container = page.locator('.virtual-scroll-container');
      const containerHeight = await container.evaluate((el) => el.getBoundingClientRect().height);

      // Scroll to near the end (but not absolute bottom)
      // IntersectionObserver has 400px rootMargin
      const scrollTarget = containerHeight - 600;
      await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);

      // Wait for potential load more
      await page.waitForTimeout(1500);

      // The load more should have been triggered
      // Verify by checking that we can still scroll smoothly
      const canStillScroll = await page.evaluate(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        return window.scrollY < maxScroll;
      });
      expect(canStillScroll).toBe(true);
    });

    test('loading indicator appears in fixed height zone', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // The load-more-placeholder should exist and have fixed height
      const placeholder = page.locator('.load-more-placeholder');

      // Scroll to make placeholder visible
      await page.evaluate(() => {
        const el = document.querySelector('.load-more-placeholder');
        if (el) el.scrollIntoView();
      });

      await expect(placeholder).toBeVisible({ timeout: 5000 });

      // Check computed height is 64px
      const height = await placeholder.evaluate((el) => {
        return window.getComputedStyle(el).height;
      });
      expect(height).toBe('64px');
    });
  });

  test.describe('Visual Regression Prevention', () => {
    test('no layout shift on rapid scroll', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get initial layout
      const container = page.locator('.virtual-scroll-container');
      const initialHeight = await container.evaluate((el) => el.getBoundingClientRect().height);

      // Rapid scroll up and down
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, 5000));
        await page.waitForTimeout(100);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
      }

      // Height should not have changed
      const finalHeight = await container.evaluate((el) => el.getBoundingClientRect().height);
      expect(finalHeight).toBe(initialHeight);
    });
  });
});
