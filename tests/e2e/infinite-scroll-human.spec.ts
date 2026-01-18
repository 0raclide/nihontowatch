import { test, expect } from '@playwright/test';

/**
 * Human-like Infinite Scroll Test
 *
 * Simulates real user behavior on mobile to identify scroll issues.
 * Logs observations for analysis.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Human-like Infinite Scroll Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('simulate human scrolling to bottom and observe behavior', async ({ page }) => {
    const observations: string[] = [];
    let loadMoreCount = 0;
    let apiCallCount = 0;

    // Track network requests to /api/browse
    page.on('request', (request) => {
      if (request.url().includes('/api/browse')) {
        apiCallCount++;
        const url = new URL(request.url());
        const pageNum = url.searchParams.get('page') || '1';
        observations.push(`[${Date.now()}] API call #${apiCallCount} - page=${pageNum}`);
      }
    });

    // Track console logs for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('load')) {
        observations.push(`[console] ${msg.text()}`);
      }
    });

    // Navigate and wait for initial load
    observations.push('--- Starting test ---');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for listings
    await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible({ timeout: 15000 });

    const initialCardCount = await page.locator('[data-testid="listing-card"]').count();
    observations.push(`Initial cards loaded: ${initialCardCount}`);

    // Get initial document metrics
    const initialMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    }));
    observations.push(`Initial metrics: scrollHeight=${initialMetrics.scrollHeight}, viewport=${initialMetrics.viewportHeight}`);

    // Simulate human-like gradual scrolling
    observations.push('--- Beginning scroll simulation ---');

    const scrollSteps = 10;
    const targetScroll = initialMetrics.scrollHeight - initialMetrics.viewportHeight;
    const scrollIncrement = targetScroll / scrollSteps;

    for (let i = 1; i <= scrollSteps; i++) {
      const targetY = Math.min(scrollIncrement * i, targetScroll);

      // Human-like smooth scroll
      await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }, targetY);

      // Wait like a human would (reading content)
      await page.waitForTimeout(300);

      const currentMetrics = await page.evaluate(() => ({
        scrollY: Math.round(window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
        atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 50,
      }));

      observations.push(`Scroll step ${i}: scrollY=${currentMetrics.scrollY}, height=${currentMetrics.scrollHeight}, atBottom=${currentMetrics.atBottom}`);
    }

    // Now we should be near the bottom - wait and observe
    observations.push('--- At bottom, observing for 5 seconds ---');

    const startApiCount = apiCallCount;
    const startTime = Date.now();

    // Sit at the bottom for 5 seconds and count API calls
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);

      const currentCards = await page.locator('[data-testid="listing-card"]').count();
      const loadingVisible = await page.locator('text="Loading more..."').isVisible().catch(() => false);

      observations.push(`[${Date.now() - startTime}ms] cards=${currentCards}, loading=${loadingVisible}, apiCalls=${apiCallCount}`);
    }

    const apiCallsWhileAtBottom = apiCallCount - startApiCount;
    observations.push(`--- Summary ---`);
    observations.push(`API calls while at bottom: ${apiCallsWhileAtBottom}`);
    observations.push(`Total API calls: ${apiCallCount}`);

    const finalCardCount = await page.locator('[data-testid="listing-card"]').count();
    observations.push(`Final card count: ${finalCardCount}`);

    // Print all observations
    console.log('\n========== OBSERVATIONS ==========');
    observations.forEach((obs) => console.log(obs));
    console.log('==================================\n');

    // Assertions based on what we observed
    // If more than 3 API calls happen while sitting at bottom, that's a problem
    if (apiCallsWhileAtBottom > 3) {
      console.log('❌ PROBLEM: Too many API calls while at bottom - continuous loading detected');
    } else {
      console.log('✅ OK: API calls at bottom within acceptable range');
    }

    // The test should fail if we see excessive API calls
    // With the throttle fix, we expect at most 2-3 calls (initial trigger + maybe one more)
    expect(apiCallsWhileAtBottom).toBeLessThanOrEqual(3);
  });

  test('scroll to absolute bottom and stay there', async ({ page }) => {
    const observations: string[] = [];
    let apiCallCount = 0;

    page.on('request', (request) => {
      if (request.url().includes('/api/browse')) {
        apiCallCount++;
        observations.push(`API call #${apiCallCount}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible({ timeout: 15000 });

    observations.push(`Initial API calls: ${apiCallCount}`);

    // Jump straight to the bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    observations.push('Jumped to bottom');

    // Wait 3 seconds at the bottom
    const startApiCount = apiCallCount;
    await page.waitForTimeout(3000);
    const apiCallsDuringWait = apiCallCount - startApiCount;

    observations.push(`API calls during 3s wait at bottom: ${apiCallsDuringWait}`);

    // Check if "end of list" message appears
    const endMessage = await page.locator('text=/You\'ve seen all/').isVisible().catch(() => false);
    observations.push(`End of list message visible: ${endMessage}`);

    console.log('\n========== BOTTOM BEHAVIOR ==========');
    observations.forEach((obs) => console.log(obs));
    console.log('=====================================\n');

    // Should not make more than 2 API calls after reaching bottom
    // (1 for initial load, maybe 1 more for load-more trigger)
    expect(apiCallsDuringWait).toBeLessThanOrEqual(2);
  });
});
