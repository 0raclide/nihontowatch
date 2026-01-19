import { test, expect } from '@playwright/test';

/**
 * Test for the same-query search bug.
 *
 * Bug: If user is already on /?q=katana and searches for "katana" again,
 * the spinner appears but never disappears because:
 * 1. setIsSearching(true) is called
 * 2. router.push('/?q=katana') is called (same URL)
 * 3. currentQuery doesn't change (still "katana")
 * 4. useEffect([currentQuery]) doesn't fire
 * 5. Spinner stays stuck forever
 */

const DESKTOP_SPINNER_SELECTOR = 'header form[role="search"] svg.animate-spin';
const DESKTOP_SEARCH_INPUT = 'header form[role="search"] input[type="search"]';

test.describe('Same Query Search Bug', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('CRITICAL: searching same query twice should NOT leave spinner stuck', async ({ page }) => {
    // Start with a search already in URL
    await page.goto('/?q=katana');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the right page with results
    expect(page.url()).toContain('q=katana');

    // Check spinner is NOT visible initially
    const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
    await expect(searchInput).toBeVisible();

    let spinnerVisible = await page.locator(DESKTOP_SPINNER_SELECTOR).isVisible({ timeout: 500 }).catch(() => false);
    console.log('Initial spinner state:', spinnerVisible);
    expect(spinnerVisible).toBe(false);

    // Now search for the SAME query again
    await searchInput.clear();
    await searchInput.fill('katana');
    await searchInput.press('Enter');
    console.log('Searched for same query: katana');

    // Wait for any navigation/processing
    await page.waitForTimeout(3000);

    // Screenshot for debugging
    await page.screenshot({ path: 'tests/screenshots/same-query-search.png' });

    // CRITICAL CHECK: Spinner should NOT be stuck
    spinnerVisible = await page.locator(DESKTOP_SPINNER_SELECTOR).isVisible({ timeout: 500 }).catch(() => false);
    console.log('Spinner after same-query search:', spinnerVisible);

    // This is the bug - spinner gets stuck when searching same query
    expect(spinnerVisible).toBe(false);
  });

  test('searching different query then same query back', async ({ page }) => {
    // Start on home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator(DESKTOP_SEARCH_INPUT);
    await expect(searchInput).toBeVisible();

    // Search for first term
    await searchInput.fill('katana');
    await searchInput.press('Enter');
    await page.waitForURL('**/?q=katana*', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('First search complete: katana');

    // Search for second term
    await searchInput.clear();
    await searchInput.fill('wakizashi');
    await searchInput.press('Enter');
    await page.waitForURL('**/?q=wakizashi*', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('Second search complete: wakizashi');

    // Search for first term AGAIN
    await searchInput.clear();
    await searchInput.fill('katana');
    await searchInput.press('Enter');
    await page.waitForURL('**/?q=katana*', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('Third search (back to katana) complete');

    // Check spinner
    const spinnerVisible = await page.locator(DESKTOP_SPINNER_SELECTOR).isVisible({ timeout: 500 }).catch(() => false);
    console.log('Spinner after third search:', spinnerVisible);
    expect(spinnerVisible).toBe(false);
  });
});
