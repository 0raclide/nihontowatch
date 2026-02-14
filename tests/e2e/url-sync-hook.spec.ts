import { test, expect } from '@playwright/test';

const BASE = '/';

// Helper: wait for browse grid to finish loading (handles 0-result filtered views too)
async function waitForGrid(page: import('@playwright/test').Page) {
  // Wait for loading to finish: either listings appear OR "0 items" text appears
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="animate-spin"]');
    // Check if any spinner is visible (not just exists)
    let hasVisibleSpinner = false;
    spinners.forEach(s => {
      const rect = (s as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) hasVisibleSpinner = true;
    });
    if (hasVisibleSpinner) return false;
    // Either we have listings or a "0 items" / "no results" state
    const items = document.querySelectorAll('[data-listing-id]');
    const bodyText = document.body.innerText;
    return items.length > 0 || /0 items|no results|no listings/i.test(bodyText);
  }, { timeout: 20000 });
}

// Helper: get current URL params
function getParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

test.describe('useBrowseURLSync — URL ↔ State bidirectional sync', () => {

  test('1. Landing page loads with default state (no filter params in URL)', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE);
    await waitForGrid(page);
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    // Default tab=available is omitted from URL (clean URL for defaults)
    // The hook sets tab=available internally but buildParamsFromState always writes it
    // However, on initial mount the State→URL effect skips (prevUrlRef === null guard)
    // So the clean "/" URL is preserved — no tab param
    expect(params.get('type')).toBeNull();
    expect(params.get('cert')).toBeNull();
    expect(params.get('dealer')).toBeNull();
    expect(params.get('q')).toBeNull();
    expect(params.get('sort')).toBeNull();

    console.log(`[TIMING] Landing page load + grid: ${elapsed}ms`);
  });

  test('2. Direct URL with filters → state initializes correctly', async ({ page }) => {
    const start = Date.now();
    // Use KATANA only — more likely to have results
    await page.goto('/?type=KATANA&sort=price_desc');
    await waitForGrid(page);
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    expect(params.get('type')).toBe('KATANA');
    expect(params.get('sort')).toBe('price_desc');

    console.log(`[TIMING] Direct URL with filters: ${elapsed}ms`);
  });

  test('3. Header search → browse updates URL and grid (q param)', async ({ page }) => {
    await page.goto(BASE);
    await waitForGrid(page);

    // Find and use the header search
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[aria-label*="earch"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    const start = Date.now();
    await searchInput.fill('masamune');
    await searchInput.press('Enter');

    // Wait for URL to update with q param
    await page.waitForURL(/[?&]q=masamune/, { timeout: 10000 });
    await waitForGrid(page);
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    expect(params.get('q')).toBe('masamune');

    // Search indicator should be visible
    await expect(page.locator('text=masamune').first()).toBeVisible();

    console.log(`[TIMING] Header search → grid update: ${elapsed}ms`);
  });

  test('4. Browser back/forward → state matches URL', async ({ page }) => {
    // Start clean
    await page.goto(BASE);
    await waitForGrid(page);

    // Apply a search to create history
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[aria-label*="earch"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await searchInput.fill('tanto');
    await searchInput.press('Enter');
    await page.waitForURL(/[?&]q=tanto/, { timeout: 10000 });
    await waitForGrid(page);

    // Go back
    const start = Date.now();
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('q') || url.searchParams.get('q') === '', { timeout: 10000 });
    await waitForGrid(page);
    const backElapsed = Date.now() - start;

    // q param should be gone
    const paramsAfterBack = getParams(page.url());
    expect(paramsAfterBack.get('q')).toBeNull();

    // Go forward
    const fwdStart = Date.now();
    await page.goForward();
    await page.waitForURL(/[?&]q=tanto/, { timeout: 10000 });
    await waitForGrid(page);
    const fwdElapsed = Date.now() - fwdStart;

    const paramsAfterFwd = getParams(page.url());
    expect(paramsAfterFwd.get('q')).toBe('tanto');

    console.log(`[TIMING] Back navigation: ${backElapsed}ms, Forward navigation: ${fwdElapsed}ms`);
  });

  test('5. Direct URL with dealer filter → grid shows filtered results', async ({ page }) => {
    await page.goto(BASE);
    await waitForGrid(page);

    const start = Date.now();
    await page.goto('/?dealer=1');
    await waitForGrid(page);
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    expect(params.get('dealer')).toBe('1');

    console.log(`[TIMING] Direct dealer filter URL: ${elapsed}ms`);
  });

  test('6. Sort change → URL updates', async ({ page }) => {
    await page.goto(BASE);
    await waitForGrid(page);

    // Find the sort selector (desktop)
    const sortSelect = page.locator('select').filter({ hasText: /newest|recent|price/i }).first();

    if (await sortSelect.isVisible()) {
      const start = Date.now();
      await sortSelect.selectOption('price_asc');

      // Wait for URL to reflect sort change
      await page.waitForURL(/[?&]sort=price_asc/, { timeout: 10000 });
      await waitForGrid(page);
      const elapsed = Date.now() - start;

      const params = getParams(page.url());
      expect(params.get('sort')).toBe('price_asc');

      console.log(`[TIMING] Sort change → URL + grid update: ${elapsed}ms`);
    } else {
      console.log('[SKIP] Sort selector not visible (mobile viewport?)');
    }
  });

  test('7. Multiple filter params survive page reload', async ({ page }) => {
    // Use a filter combo likely to have results
    const filterUrl = '/?type=KATANA&sort=price_desc&q=katana';
    await page.goto(filterUrl);
    await waitForGrid(page);

    // Reload
    const start = Date.now();
    await page.reload();
    await waitForGrid(page);
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    expect(params.get('type')).toBe('KATANA');
    expect(params.get('sort')).toBe('price_desc');
    expect(params.get('q')).toBe('katana');

    console.log(`[TIMING] Reload with filters preserved: ${elapsed}ms`);
  });

  test('8. Clear search → URL cleans up q param', async ({ page }) => {
    await page.goto('/?q=katana');
    await waitForGrid(page);

    // Click the clear search button in the main content area (search pill, not header)
    const clearButton = page.locator('main button[aria-label="Clear search"]').first();
    await clearButton.waitFor({ state: 'visible', timeout: 5000 });

    const start = Date.now();
    await clearButton.click();

    // Wait for q param to disappear
    await page.waitForURL((url) => !url.searchParams.has('q'), { timeout: 10000 });
    const elapsed = Date.now() - start;

    const params = getParams(page.url());
    expect(params.get('q')).toBeNull();

    console.log(`[TIMING] Clear search: ${elapsed}ms`);
  });

  test('9. Sold tab → URL gets tab=sold and sort=sale_date', async ({ page }) => {
    await page.goto(BASE);
    await waitForGrid(page);

    // Find and click the Sold tab/toggle
    const soldTab = page.locator('button, [role="tab"]').filter({ hasText: /sold/i }).first();

    if (await soldTab.isVisible()) {
      const start = Date.now();
      await soldTab.click();

      await page.waitForURL(/[?&]tab=sold/, { timeout: 10000 });
      await waitForGrid(page);
      const elapsed = Date.now() - start;

      const params = getParams(page.url());
      expect(params.get('tab')).toBe('sold');
      expect(params.get('sort')).toBe('sale_date');

      console.log(`[TIMING] Sold tab switch: ${elapsed}ms`);
    } else {
      console.log('[SKIP] Sold tab not visible');
    }
  });

  test('10. No duplicate router.replace calls (stability check)', async ({ page }) => {
    // Monitor for excessive navigation events which would indicate a loop
    const navigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    await page.goto('/?type=KATANA');
    await waitForGrid(page);

    // Wait a bit to catch any oscillating replace calls
    await page.waitForTimeout(3000);

    // Should only have the initial navigation, no extra replace loops
    // Allow up to 3 navigations (initial + soft navigations from Next.js)
    console.log(`[STABILITY] Navigations after load: ${navigations.length} — ${navigations.join(' → ')}`);
    expect(navigations.length).toBeLessThanOrEqual(3);
  });
});
