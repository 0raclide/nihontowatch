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
    test('document height stays stable during scroll', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for listings to load
      await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible({ timeout: 10000 });

      // Get initial document height
      const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      // Should have substantial height (items loaded)
      expect(initialHeight).toBeGreaterThan(1000);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 2000));
      await page.waitForTimeout(500);

      // Get height after scroll
      const heightAfterScroll = await page.evaluate(() => document.documentElement.scrollHeight);

      // Height should be stable (not jumping around)
      // Allow small variance for dynamic content but no major shifts
      const heightChange = Math.abs(heightAfterScroll - initialHeight);
      expect(heightChange).toBeLessThan(500); // Less than 500px change is acceptable
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
    test('scroll position maintained near bottom of page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for listings to load
      await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible({ timeout: 10000 });

      // Count initial listing cards
      const initialCardCount = await page.locator('[data-testid="listing-card"]').count();
      expect(initialCardCount).toBeGreaterThan(0);

      // Get initial document height
      const initialDocHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      // Scroll to near bottom (where load-more would trigger)
      const scrollTarget = Math.max(0, initialDocHeight - 600);
      await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);

      // Record scroll position immediately
      const scrollAfterJump = await page.evaluate(() => window.scrollY);

      // Wait for any async operations
      await page.waitForTimeout(1000);

      // The key test: scroll position should remain stable (no bounce to top)
      const finalScrollPosition = await page.evaluate(() => window.scrollY);

      // Scroll position should not have jumped significantly (allows 100px tolerance)
      const scrollDrift = Math.abs(finalScrollPosition - scrollAfterJump);
      expect(scrollDrift).toBeLessThan(100);

      // Should not have bounced back to top
      expect(finalScrollPosition).toBeGreaterThan(100);
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

      // Wait for listings to load
      await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible({ timeout: 10000 });

      // Get initial document height (works whether virtualized or not)
      const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      // Rapid scroll up and down
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, 5000));
        await page.waitForTimeout(100);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
      }

      // Document height should not have changed significantly
      const finalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      // Allow small variance (up to 100px) for any dynamic content
      expect(Math.abs(finalHeight - initialHeight)).toBeLessThan(100);
    });
  });
});
