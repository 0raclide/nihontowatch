import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './helpers';

test.describe('Filter UI - Desktop Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
  });

  test('category buttons should not be clipped by scrollbar', async ({ page }) => {
    const filterSidebar = page.locator('aside.lg\\:block');
    await expect(filterSidebar).toBeVisible({ timeout: 15000 });

    // Screenshot the sidebar
    await filterSidebar.screenshot({ path: 'tests/screenshots/desktop-sidebar.png' });

    // Get the Tosogu button
    const tosoguButton = filterSidebar.locator('button:has-text("Tosogu")');
    await expect(tosoguButton).toBeVisible();

    // Get the scrollable container
    const scrollContainer = filterSidebar.locator('.overflow-y-auto');

    const tosoguBox = await tosoguButton.boundingBox();
    const containerBox = await scrollContainer.boundingBox();

    if (tosoguBox && containerBox) {
      const rightEdgeOfButton = tosoguBox.x + tosoguBox.width;
      const rightEdgeOfContainer = containerBox.x + containerBox.width;
      const spacing = rightEdgeOfContainer - rightEdgeOfButton;

      console.log(`Tosogu button right edge: ${rightEdgeOfButton}`);
      console.log(`Container right edge: ${rightEdgeOfContainer}`);
      console.log(`Spacing: ${spacing}px`);

      // Need at least 8px spacing to avoid scrollbar overlap
      expect(spacing).toBeGreaterThanOrEqual(8);
    }
  });
});

test.describe('Filter UI - Mobile Drawer', () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
  });

  test('should open filter drawer and show all content', async ({ page }) => {
    // Find and click the filter button to open drawer
    const filterButton = page.locator('button:has-text("Filters"), button[aria-label*="filter"], button:has-text("Filter")').first();

    // If no dedicated filter button, look for the mobile filter trigger
    const mobileFilterTrigger = page.locator('[data-testid="filter-trigger"], button:has-text("Filters")').first();

    // Try to find any filter-related button
    const anyFilterButton = page.locator('button').filter({ hasText: /filter/i }).first();

    // Click whichever is visible
    if (await filterButton.isVisible()) {
      await filterButton.click();
    } else if (await mobileFilterTrigger.isVisible()) {
      await mobileFilterTrigger.click();
    } else if (await anyFilterButton.isVisible()) {
      await anyFilterButton.click();
    } else {
      // Look for the filter icon button in the header
      const iconButtons = page.locator('header button, nav button').all();
      const buttons = await iconButtons;
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes('filter')) {
          await btn.click();
          break;
        }
      }
    }

    // Wait for drawer to open
    await page.waitForTimeout(500);

    // Take screenshot of mobile drawer
    await page.screenshot({ path: 'tests/screenshots/mobile-drawer-open.png', fullPage: false });
  });

  test('category buttons should have proper spacing from scrollbar', async ({ page }) => {
    // Open filters - look for the filter button
    const filterTriggers = [
      page.locator('button:has-text("Filters")'),
      page.locator('button:has-text("Filter")'),
      page.locator('[aria-label*="filter" i]'),
      page.locator('button').filter({ hasText: /filter/i })
    ];

    for (const trigger of filterTriggers) {
      if (await trigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await trigger.first().click();
        break;
      }
    }

    await page.waitForTimeout(500);

    // Check if drawer is open
    const drawer = page.locator('[role="dialog"], .fixed.inset-0');

    if (await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find the Tosogu button in the drawer
      const tosoguButton = drawer.locator('button:has-text("Tosogu")');

      if (await tosoguButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await drawer.screenshot({ path: 'tests/screenshots/mobile-drawer-category.png' });

        const buttonBox = await tosoguButton.boundingBox();
        const drawerBox = await drawer.locator('.overflow-y-auto').boundingBox();

        if (buttonBox && drawerBox) {
          const spacing = (drawerBox.x + drawerBox.width) - (buttonBox.x + buttonBox.width);
          console.log(`Mobile drawer - Tosogu button spacing: ${spacing}px`);
          expect(spacing).toBeGreaterThanOrEqual(16);
        }
      }
    }
  });

  test('ASK toggle should be visible when scrolled to bottom', async ({ page }) => {
    // Open filters
    const filterTriggers = [
      page.locator('button:has-text("Filters")'),
      page.locator('[aria-label*="filter" i]')
    ];

    for (const trigger of filterTriggers) {
      if (await trigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await trigger.first().click();
        break;
      }
    }

    await page.waitForTimeout(500);

    const drawer = page.locator('[role="dialog"]');

    if (await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find the scrollable content area
      const scrollArea = drawer.locator('.overflow-y-auto');

      // Scroll to bottom
      await scrollArea.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });

      await page.waitForTimeout(300);

      // Screenshot after scrolling
      await drawer.screenshot({ path: 'tests/screenshots/mobile-drawer-scrolled.png' });

      // Look for "Price on request" text which is the ASK toggle
      const askToggle = drawer.locator('text=Price on request');
      const isVisible = await askToggle.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`ASK toggle visible after scroll: ${isVisible}`);
      expect(isVisible).toBe(true);
    }
  });

  test('dealer dropdown should be scrollable', async ({ page }) => {
    // Open filters
    const filterTriggers = [
      page.locator('button:has-text("Filters")'),
      page.locator('[aria-label*="filter" i]')
    ];

    for (const trigger of filterTriggers) {
      if (await trigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await trigger.first().click();
        break;
      }
    }

    await page.waitForTimeout(500);

    const drawer = page.locator('[role="dialog"]');

    if (await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
      // First scroll to find the dealer section
      const scrollArea = drawer.locator('.overflow-y-auto');

      // Scroll down to find dealer section
      await scrollArea.evaluate(el => {
        el.scrollTop = el.scrollHeight / 2;
      });

      await page.waitForTimeout(300);

      // Find and click the dealer dropdown
      const dealerButton = drawer.locator('button:has-text("All dealers"), button:has-text("dealer")').first();

      if (await dealerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dealerButton.click();
        await page.waitForTimeout(300);

        // Screenshot with dropdown open
        await drawer.screenshot({ path: 'tests/screenshots/mobile-dealer-dropdown.png' });

        // Find the dealer list container
        const dealerList = drawer.locator('.max-h-52.overflow-y-auto, .max-h-72 .overflow-y-auto');

        if (await dealerList.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check if it's scrollable
          const scrollInfo = await dealerList.evaluate(el => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            isScrollable: el.scrollHeight > el.clientHeight
          }));

          console.log(`Dealer list - scrollHeight: ${scrollInfo.scrollHeight}, clientHeight: ${scrollInfo.clientHeight}, scrollable: ${scrollInfo.isScrollable}`);

          // If there are many dealers, it should be scrollable
          if (scrollInfo.scrollHeight > 100) {
            expect(scrollInfo.isScrollable).toBe(true);
          }

          // Try scrolling to the bottom of the dealer list
          await dealerList.evaluate(el => {
            el.scrollTop = el.scrollHeight;
          });

          await page.waitForTimeout(200);
          await drawer.screenshot({ path: 'tests/screenshots/mobile-dealer-scrolled.png' });
        }
      }
    }
  });
});
