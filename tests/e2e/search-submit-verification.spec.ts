import { test, expect } from '@playwright/test';

/**
 * Critical test: Verify search form actually submits and navigates
 *
 * Previous tests only checked spinner state, not whether navigation happened.
 * This test verifies the complete flow.
 */

test.describe('Search Form Submission Verification', () => {
  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('CRITICAL: pressing Enter in search input MUST navigate to search results', async ({ page }) => {
      // Start on home page without query
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get initial URL
      const initialUrl = page.url();
      console.log('Initial URL:', initialUrl);
      expect(initialUrl).not.toContain('q=');

      // Find the desktop search input
      const searchInput = page.locator('header form[role="search"] input[type="search"]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // Clear any existing value and type new query
      await searchInput.click();
      await searchInput.fill('katana');

      // Verify the input has the value
      await expect(searchInput).toHaveValue('katana');
      console.log('Typed "katana" in search input');

      // Press Enter to submit
      await searchInput.press('Enter');
      console.log('Pressed Enter');

      // CRITICAL: URL must change to include query parameter
      await page.waitForURL('**/?q=katana*', { timeout: 10000 });

      const newUrl = page.url();
      console.log('New URL after Enter:', newUrl);

      // Verify navigation happened
      expect(newUrl).toContain('q=katana');

      // Verify we see search results (grid should be visible)
      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      await expect(grid).toBeVisible({ timeout: 15000 });

      console.log('SUCCESS: Navigation worked, grid visible');
    });

    test('clicking submit button MUST navigate to search results', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('header form[role="search"] input[type="search"]');
      await expect(searchInput).toBeVisible();

      await searchInput.fill('wakizashi');

      // Click the submit button
      const submitButton = page.locator('header form[role="search"] button[type="submit"]');
      await submitButton.click();
      console.log('Clicked submit button');

      // URL must change
      await page.waitForURL('**/?q=wakizashi*', { timeout: 10000 });
      expect(page.url()).toContain('q=wakizashi');

      console.log('SUCCESS: Button click navigation worked');
    });

    test('form submission should work with keyboard focus on button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('header form[role="search"] input[type="search"]');
      await expect(searchInput).toBeVisible();

      await searchInput.fill('tanto');

      // Tab to button and press Enter
      await searchInput.press('Tab');
      await page.keyboard.press('Enter');

      // URL must change
      await page.waitForURL('**/?q=tanto*', { timeout: 10000 });
      expect(page.url()).toContain('q=tanto');
    });

    test('debug: check form structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check form exists
      const form = page.locator('header form[role="search"]');
      await expect(form).toBeVisible();

      // Check form attributes
      const formHtml = await form.evaluate(el => el.outerHTML);
      console.log('Form HTML:', formHtml.substring(0, 500));

      // Check input
      const input = page.locator('header form[role="search"] input[type="search"]');
      const inputHtml = await input.evaluate(el => el.outerHTML);
      console.log('Input HTML:', inputHtml);

      // Check button
      const button = page.locator('header form[role="search"] button[type="submit"]');
      const buttonHtml = await button.evaluate(el => el.outerHTML);
      console.log('Button HTML:', buttonHtml.substring(0, 300));

      // Check if input is disabled
      const isDisabled = await input.isDisabled();
      console.log('Input disabled:', isDisabled);
      expect(isDisabled).toBe(false);
    });
  });

  test.describe('Mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('mobile search sheet: pressing Enter MUST navigate', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open search sheet by clicking search in bottom nav
      const searchTab = page.locator('nav button').filter({ hasText: /search/i }).first();
      await searchTab.click().catch(async () => {
        // Try alternative selector
        const altSearch = page.locator('[aria-label*="search" i]').first();
        await altSearch.click();
      });

      await page.waitForTimeout(500); // Wait for drawer animation

      // Find search input in drawer
      const searchInput = page.locator('input[type="search"]').last();
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      await searchInput.fill('juyo');
      await searchInput.press('Enter');

      // URL must change
      await page.waitForURL('**/?q=juyo*', { timeout: 10000 });
      expect(page.url()).toContain('q=juyo');

      console.log('SUCCESS: Mobile search navigation worked');
    });
  });
});
