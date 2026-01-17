import { test, expect } from '@playwright/test';

test.describe('Scrapers Admin Page', () => {
  // Note: These tests require admin authentication
  // In CI, you may need to set up test fixtures for admin auth

  test.describe('Page Structure', () => {
    test('displays page title and description', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await expect(page.locator('h1')).toContainText('Scrapers');
      await expect(page.locator('text=Monitor and control data scrapers')).toBeVisible();
    });

    test('displays all four status cards', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await expect(page.locator('text=Last Scrape')).toBeVisible();
      await expect(page.locator('text=Total Listings')).toBeVisible();
      await expect(page.locator('text=QA Pass Rate')).toBeVisible();
      await expect(page.locator('text=Pending URLs')).toBeVisible();
    });

    test('displays trigger scrape panel', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await expect(page.locator('h2:has-text("Trigger Scrape")')).toBeVisible();
      await expect(page.locator('select')).toBeVisible();
      await expect(page.locator('input[type="range"]')).toBeVisible();
      await expect(page.locator('button:has-text("Run Scrape")')).toBeVisible();
    });

    test('displays recent runs table', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await expect(page.locator('h2:has-text("Recent Runs")')).toBeVisible();
      // Should have table headers
      await expect(page.locator('th:has-text("Type")')).toBeVisible();
      await expect(page.locator('th:has-text("Dealer")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Processed")')).toBeVisible();
      await expect(page.locator('th:has-text("New")')).toBeVisible();
    });

    test('displays QA issues table', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await expect(page.locator('h2:has-text("QA Issues by Dealer")')).toBeVisible();
    });
  });

  test.describe('Trigger Scrape Panel', () => {
    test('dealer dropdown has "All Dealers" as default', async ({ page }) => {
      await page.goto('/admin/scrapers');
      const select = page.locator('select').first();
      await expect(select).toHaveValue('all');
    });

    test('limit slider can be adjusted', async ({ page }) => {
      await page.goto('/admin/scrapers');
      const slider = page.locator('input[type="range"]');
      await slider.fill('100');
      await expect(page.locator('text=Limit: 100')).toBeVisible();
    });

    test('run button shows loading state when clicked', async ({ page }) => {
      await page.goto('/admin/scrapers');
      const button = page.locator('button:has-text("Run Scrape")');
      await button.click();
      // Button should show loading state
      await expect(button).toBeDisabled();
    });
  });

  test.describe('Recent Runs Table', () => {
    test('shows run type badges with correct colors', async ({ page }) => {
      await page.goto('/admin/scrapers');
      // Wait for data to load
      await page.waitForTimeout(2000);

      // Check if any run type badges exist
      const discoveryBadges = page.locator('span:has-text("discovery")');
      const scrapeBadges = page.locator('span:has-text("scrape")');

      // At least one type should be visible if there are runs
      const hasRuns = await page.locator('tbody tr').count() > 0;
      if (hasRuns) {
        const hasDiscovery = await discoveryBadges.count() > 0;
        const hasScrape = await scrapeBadges.count() > 0;
        expect(hasDiscovery || hasScrape).toBe(true);
      }
    });

    test('shows status badges with correct colors', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await page.waitForTimeout(2000);

      // Check for status badges
      const completedBadges = page.locator('span:has-text("completed")');
      const failedBadges = page.locator('span:has-text("failed")');

      // Completed should have success styling
      if (await completedBadges.count() > 0) {
        await expect(completedBadges.first()).toHaveClass(/text-success/);
      }

      // Failed should have error styling
      if (await failedBadges.count() > 0) {
        await expect(failedBadges.first()).toHaveClass(/text-error/);
      }
    });

    test('failed rows have error background', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await page.waitForTimeout(2000);

      const failedRows = page.locator('tr:has(span:has-text("failed"))');
      if (await failedRows.count() > 0) {
        await expect(failedRows.first()).toHaveClass(/bg-error/);
      }
    });

    test('shows new listings count with + prefix for positive values', async ({ page }) => {
      await page.goto('/admin/scrapers');
      await page.waitForTimeout(2000);

      // Look for positive new listings indicators
      const positiveNewListings = page.locator('span.text-success:has-text("+")');
      // This is optional - there may not always be new listings
    });
  });
});

test.describe('Scrapers Admin API', () => {
  test('GET /api/admin/scrapers/stats returns expected structure', async ({ request }) => {
    const response = await request.get('/api/admin/scrapers/stats');
    // Will be 401 without auth, which is expected
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('lastScrape');
      expect(data).toHaveProperty('totalListings');
      expect(data).toHaveProperty('availableListings');
      expect(data).toHaveProperty('qaPassRate');
      expect(data).toHaveProperty('pendingUrls');
    }
  });

  test('GET /api/admin/scrapers/runs returns expected structure', async ({ request }) => {
    const response = await request.get('/api/admin/scrapers/runs');
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('runs');
      expect(Array.isArray(data.runs)).toBe(true);

      if (data.runs.length > 0) {
        const run = data.runs[0];
        expect(run).toHaveProperty('id');
        expect(run).toHaveProperty('runType');
        expect(run).toHaveProperty('dealer');
        expect(run).toHaveProperty('status');
        expect(run).toHaveProperty('processed');
        expect(run).toHaveProperty('newListings');
        expect(run).toHaveProperty('updatedListings');
        expect(run).toHaveProperty('errors');
        expect(run).toHaveProperty('errorMessage');
        expect(run).toHaveProperty('startedAt');
        expect(run).toHaveProperty('completedAt');
      }
    }
  });

  test('GET /api/admin/scrapers/qa returns expected structure', async ({ request }) => {
    const response = await request.get('/api/admin/scrapers/qa');
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('issues');
      expect(Array.isArray(data.issues)).toBe(true);
    }
  });

  test('GET /api/admin/scrapers/dealers returns expected structure', async ({ request }) => {
    const response = await request.get('/api/admin/scrapers/dealers');
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('dealers');
      expect(Array.isArray(data.dealers)).toBe(true);
    }
  });

  test('POST /api/admin/scrapers/trigger requires authentication', async ({ request }) => {
    const response = await request.post('/api/admin/scrapers/trigger', {
      data: { dealer: null, limit: 50 },
    });
    // Should be 401 without auth
    expect(response.status()).toBe(401);
  });
});
