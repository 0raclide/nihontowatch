import { test, expect, Page } from '@playwright/test';

/**
 * Search Spinner Bug Investigation Tests
 *
 * Issue: Search spinner gets stuck after submitting search via the search box,
 * but works fine when pasting a URL directly.
 *
 * Hypothesis: The spinner is controlled by isSearching state which should reset
 * when the URL's 'q' parameter changes, but something prevents this from happening
 * when using the search box.
 */

// Helper to check if spinner is visible
async function isSpinnerVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const spinner = page.locator(selector);
    return await spinner.isVisible({ timeout: 500 });
  } catch {
    return false;
  }
}

// Helper to wait for navigation to complete
async function waitForSearchResults(page: Page, query: string, timeout = 15000): Promise<void> {
  await Promise.all([
    page.waitForURL(`**/?q=${encodeURIComponent(query)}*`, { timeout }),
    page.waitForLoadState('networkidle', { timeout }),
  ]);
}

// Desktop spinner selector (in header search form)
const DESKTOP_SPINNER_SELECTOR = 'header form[role="search"] svg.animate-spin';
const DESKTOP_SEARCH_INPUT = 'header form[role="search"] input[type="search"]';
const DESKTOP_SEARCH_BUTTON = 'header form[role="search"] button[type="submit"]';

// Mobile search sheet selectors
const MOBILE_SEARCH_TRIGGER = '[data-testid="mobile-search-trigger"]'; // We'll need to add this
const MOBILE_SEARCH_INPUT = '[data-mobile-search] input[type="search"]';
const MOBILE_SEARCH_BUTTON = '[data-mobile-search] button[type="submit"]';
const MOBILE_SPINNER_SELECTOR = '[data-mobile-search] svg.animate-spin';

test.describe('Search Spinner Bug Investigation', () => {
  test.describe('Desktop Search', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('baseline: direct URL navigation shows results without spinner stuck', async ({ page }) => {
      // This should work correctly - pasting URL directly
      const consoleMessages: string[] = [];
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      });

      // Navigate directly to search URL
      await page.goto('/?q=katana');
      await page.waitForLoadState('networkidle');

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Check that spinner is NOT visible (baseline check)
      const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Direct URL navigation - spinner visible:', spinnerVisible);

      // The spinner should NOT be visible after direct navigation
      expect(spinnerVisible).toBe(false);

      // Verify search results loaded
      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      const gridVisible = await grid.isVisible({ timeout: 10000 }).catch(() => false);
      console.log('Grid visible:', gridVisible);

      // Log any errors
      if (consoleErrors.length > 0) {
        console.log('Console errors:', consoleErrors);
      }
    });

    test('bug reproduction: search box submission - spinner should disappear after navigation', async ({ page }) => {
      const consoleMessages: string[] = [];
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      });

      // Start on home page without query
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for page to be fully loaded
      await page.waitForTimeout(2000);

      // Find and interact with the desktop search input
      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      // Type search query
      await searchInput.fill('katana');
      console.log('Typed search query: katana');

      // Take screenshot before submit
      await page.screenshot({ path: 'tests/screenshots/search-before-submit.png' });

      // Check spinner state BEFORE submit
      const spinnerBeforeSubmit = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Spinner visible BEFORE submit:', spinnerBeforeSubmit);
      expect(spinnerBeforeSubmit).toBe(false);

      // Submit the form by pressing Enter
      await searchInput.press('Enter');
      console.log('Pressed Enter to submit');

      // Immediately check if spinner appears
      await page.waitForTimeout(100);
      const spinnerAfterSubmit = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Spinner visible immediately AFTER submit:', spinnerAfterSubmit);

      // Take screenshot right after submit
      await page.screenshot({ path: 'tests/screenshots/search-after-submit.png' });

      // Wait for navigation to complete
      try {
        await page.waitForURL('**/?q=katana*', { timeout: 10000 });
        console.log('URL changed to:', page.url());
      } catch (e) {
        console.log('Navigation timeout. Current URL:', page.url());
        await page.screenshot({ path: 'tests/screenshots/search-navigation-timeout.png' });
      }

      // Wait for network to settle
      await page.waitForLoadState('networkidle');
      console.log('Network idle');

      // Take screenshot after navigation
      await page.screenshot({ path: 'tests/screenshots/search-after-navigation.png' });

      // Check spinner state AFTER navigation
      const spinnerAfterNavigation = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Spinner visible AFTER navigation:', spinnerAfterNavigation);

      // THIS IS THE BUG: spinner should be false but may be true
      // Wait a bit more and check again
      await page.waitForTimeout(2000);
      const spinnerAfterWait = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Spinner visible 2 seconds AFTER navigation:', spinnerAfterWait);

      // Take final screenshot
      await page.screenshot({ path: 'tests/screenshots/search-final-state.png' });

      // Verify grid loaded (results appeared)
      const grid = page.locator('[data-testid="virtual-listing-grid"]');
      const gridVisible = await grid.isVisible({ timeout: 10000 }).catch(() => false);
      console.log('Grid visible after search:', gridVisible);

      // Log any errors
      if (consoleErrors.length > 0) {
        console.log('Console errors:', consoleErrors);
      }

      // The test assertion - spinner SHOULD be hidden after navigation completes
      expect(spinnerAfterWait).toBe(false);
    });

    test('detailed timing: track isSearching state through the search flow', async ({ page }) => {
      // This test will use page.evaluate to check React state
      const timeline: string[] = [];

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find the search input
      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await expect(searchInput).toBeVisible();

      // Check initial state
      const initialSpinnerState = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      timeline.push(`T+0ms: Initial spinner visible: ${initialSpinnerState}`);

      // Type and submit
      await searchInput.fill('wakizashi');
      await searchInput.press('Enter');
      timeline.push(`T+submit: Submitted search`);

      // Check at various intervals
      const checkpoints = [50, 100, 250, 500, 1000, 2000, 3000, 5000];
      for (const delay of checkpoints) {
        await page.waitForTimeout(delay - (checkpoints[checkpoints.indexOf(delay) - 1] || 0));
        const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
        const currentUrl = page.url();
        timeline.push(`T+${delay}ms: spinner=${spinnerVisible}, url=${currentUrl}`);
      }

      // Print timeline
      console.log('\n=== Search State Timeline ===');
      timeline.forEach(entry => console.log(entry));
      console.log('=== End Timeline ===\n');

      // Take final screenshot
      await page.screenshot({ path: 'tests/screenshots/search-timeline-final.png' });

      // Final assertion
      const finalSpinner = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      expect(finalSpinner).toBe(false);
    });

    test('submit button click (alternative to Enter)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await expect(searchInput).toBeVisible();

      // Type search query
      await searchInput.fill('tanto');

      // Click submit button instead of pressing Enter
      const submitButton = page.locator(DESKTOP_SEARCH_BUTTON);
      await submitButton.click();
      console.log('Clicked submit button');

      // Wait for navigation
      await page.waitForURL('**/?q=tanto*', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check spinner state
      const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Spinner visible after click submit:', spinnerVisible);

      await page.screenshot({ path: 'tests/screenshots/search-click-submit.png' });

      expect(spinnerVisible).toBe(false);
    });
  });

  test.describe('Mobile Search', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

    test('baseline: direct URL navigation on mobile', async ({ page }) => {
      // Navigate directly to search URL on mobile
      await page.goto('/?q=katana');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // On mobile, the header is hidden, so check for mobile-specific indicators
      await page.screenshot({ path: 'tests/screenshots/mobile-direct-url.png' });

      // Verify we see search results indicator
      const searchIndicator = page.locator('text=for "katana"');
      const hasSearchIndicator = await searchIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Mobile search indicator visible:', hasSearchIndicator);
    });

    test('mobile search sheet: open, search, verify spinner behavior', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Take initial screenshot
      await page.screenshot({ path: 'tests/screenshots/mobile-initial.png' });

      // On mobile, we need to find the search trigger
      // The bottom tab bar should have a search button
      const searchTab = page.locator('nav button', { hasText: /search/i }).first();
      const searchTabVisible = await searchTab.isVisible({ timeout: 3000 }).catch(() => false);

      if (!searchTabVisible) {
        // Try looking for magnifying glass icon in bottom nav
        const searchIcon = page.locator('nav svg').first();
        console.log('Looking for search trigger in bottom nav');
      }

      // Click on search tab/icon to open search sheet
      await searchTab.click().catch(async () => {
        // If that doesn't work, look for any search trigger
        console.log('Search tab not found, looking for alternatives');
        const anySearchTrigger = page.getByRole('button').filter({ hasText: /search/i }).first();
        await anySearchTrigger.click();
      });

      await page.waitForTimeout(500); // Wait for drawer animation
      await page.screenshot({ path: 'tests/screenshots/mobile-search-opened.png' });

      // Look for the search input in the drawer
      const mobileSearchInput = page.locator('input[type="search"]').last(); // Last one is likely in drawer
      const inputVisible = await mobileSearchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (inputVisible) {
        await mobileSearchInput.fill('katana');
        console.log('Mobile: Typed search query');

        // Submit
        await mobileSearchInput.press('Enter');
        console.log('Mobile: Submitted search');

        // Wait and check
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'tests/screenshots/mobile-after-search.png' });

        // Check for stuck spinner in drawer area (if still open)
        const mobileSpinner = page.locator('svg.animate-spin');
        const mobileSpinnerVisible = await mobileSpinner.isVisible({ timeout: 500 }).catch(() => false);
        console.log('Mobile spinner visible after search:', mobileSpinnerVisible);

        // Verify URL changed
        expect(page.url()).toContain('q=katana');
      } else {
        console.log('Mobile search input not found');
        await page.screenshot({ path: 'tests/screenshots/mobile-search-input-not-found.png' });
      }
    });

    test('mobile quick search buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Open search sheet
      const searchTab = page.locator('nav button').filter({ hasText: /search/i }).first();
      await searchTab.click().catch(() => {
        console.log('Could not find search tab');
      });

      await page.waitForTimeout(500);

      // Look for quick search buttons
      const quickSearchButton = page.locator('button', { hasText: 'Katana' });
      const quickButtonVisible = await quickSearchButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (quickButtonVisible) {
        await quickSearchButton.click();
        console.log('Mobile: Clicked quick search button');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'tests/screenshots/mobile-quick-search.png' });

        // Check spinner state
        const spinner = page.locator('svg.animate-spin');
        const spinnerVisible = await spinner.isVisible({ timeout: 500 }).catch(() => false);
        console.log('Mobile quick search - spinner visible:', spinnerVisible);

        // Spinner should NOT be visible after navigation
        expect(spinnerVisible).toBe(false);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('empty search should not show spinner', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await expect(searchInput).toBeVisible();

      // Try to submit empty search
      await searchInput.click();
      await searchInput.press('Enter');

      // Should not navigate or show spinner
      await page.waitForTimeout(1000);
      const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('Empty search - spinner visible:', spinnerVisible);

      // URL should still be at root
      expect(page.url()).not.toContain('q=');
      expect(spinnerVisible).toBe(false);
    });

    test('rapid consecutive searches', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await expect(searchInput).toBeVisible();

      // Rapid fire searches
      const searches = ['katana', 'wakizashi', 'tanto'];
      for (const query of searches) {
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await page.waitForTimeout(200); // Small delay between searches
      }

      // Wait for final navigation
      await page.waitForURL('**/?q=tanto*', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('After rapid searches - spinner visible:', spinnerVisible);

      await page.screenshot({ path: 'tests/screenshots/rapid-search-final.png' });

      expect(spinnerVisible).toBe(false);
    });

    test('search then navigate away and back', async ({ page }) => {
      // Do a search
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
      await searchInput.fill('juyo');
      await searchInput.press('Enter');

      await page.waitForURL('**/?q=juyo*', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // Navigate away
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Navigate back (using history)
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check spinner
      const spinnerVisible = await isSpinnerVisible(page, DESKTOP_SPINNER_SELECTOR);
      console.log('After back navigation - spinner visible:', spinnerVisible);

      await page.screenshot({ path: 'tests/screenshots/back-navigation.png' });

      expect(spinnerVisible).toBe(false);
    });
  });
});
