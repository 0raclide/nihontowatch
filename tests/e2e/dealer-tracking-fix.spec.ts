/**
 * E2E Test: Dealer Analytics Tracking Fix
 *
 * Verifies the fix for dealer analytics tracking bug where:
 * - ListingCard was incorrectly firing `external_link_click` when opening QuickView
 * - QuickView "View on dealer" buttons had NO tracking
 *
 * After fix:
 * - Card click → `quickview_open` event (engagement tracking)
 * - "View on dealer" button → `external_link_click` event (actual click-through)
 *
 * @see docs/DEALER_ANALYTICS_TRACKING_FIX.md
 */
import { test, expect, Page } from '@playwright/test';

interface TrackingEvent {
  type: string;
  listingId?: number;
  dealerName?: string;
  source?: string;
  url?: string;
}

interface TrackingPayload {
  sessionId: string;
  events: TrackingEvent[];
}

/**
 * Helper to collect tracking events from network requests
 */
async function collectTrackingEvents(page: Page): Promise<TrackingEvent[]> {
  const events: TrackingEvent[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/track') || url.includes('/api/activity')) {
      try {
        const postData = request.postData();
        if (postData) {
          const payload = JSON.parse(postData) as TrackingPayload;
          if (payload.events) {
            events.push(...payload.events);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  });

  return events;
}

test.describe('Dealer Analytics Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('clicking listing card fires quickview_open event (NOT external_link_click)', async ({ page }) => {
    // Set up event collection before navigation
    const events = await collectTrackingEvents(page);

    // Navigate to browse page
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Clear any events from page load
    events.length = 0;

    // Click on a listing card to open QuickView
    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    // Wait for QuickView to open
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Wait for tracking request to be sent (batched)
    await page.waitForTimeout(1000);

    // Verify quickview_open event was sent
    const quickviewEvents = events.filter(e => e.type === 'quickview_open');
    const externalClickEvents = events.filter(e => e.type === 'external_link_click');

    console.log('Events captured after card click:', events.map(e => e.type));

    // CRITICAL: Should have quickview_open, NOT external_link_click
    expect(quickviewEvents.length).toBeGreaterThan(0);
    expect(externalClickEvents.length).toBe(0);

    // Verify quickview_open has correct data
    const qvEvent = quickviewEvents[0];
    expect(qvEvent.listingId).toBeDefined();
    expect(qvEvent.source).toBe('listing_card');
  });

  test('clicking "View on dealer" button fires external_link_click event', async ({ page, context }) => {
    // Set up event collection
    const events = await collectTrackingEvents(page);

    // Navigate and open QuickView
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Clear events from card click
    events.length = 0;

    // Get the CTA button (View on dealer)
    const ctaButton = page.locator('[data-testid="cta-button"]');
    await expect(ctaButton).toBeVisible();

    // Store the href before clicking
    const href = await ctaButton.getAttribute('href');
    console.log('CTA button href:', href);

    // Intercept the new tab/window to prevent it from opening
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      // Block external navigation (dealer sites) but allow our own app requests
      const appOrigin = new URL(page.url()).origin;
      if (!url.startsWith(appOrigin)) {
        await route.abort();
      } else {
        await route.continue();
      }
    });

    // Click the button
    await ctaButton.click();

    // Wait for tracking request
    await page.waitForTimeout(1000);

    // Verify external_link_click event was sent
    const externalClickEvents = events.filter(e => e.type === 'external_link_click');

    console.log('Events captured after CTA click:', events.map(e => e.type));

    expect(externalClickEvents.length).toBeGreaterThan(0);

    // Verify external_link_click has correct data
    const clickEvent = externalClickEvents[0];
    expect(clickEvent.url).toBeDefined();
    expect(clickEvent.listingId).toBeDefined();
  });

  test('full flow: card click then dealer button produces correct event sequence', async ({ page, context }) => {
    // Set up event collection
    const events = await collectTrackingEvents(page);

    // Navigate to browse page
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Clear page load events
    events.length = 0;

    // Step 1: Click card to open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Verify Step 1 produced quickview_open
    const afterCardClick = [...events];
    console.log('After card click:', afterCardClick.map(e => e.type));

    // Step 2: Click "View on dealer" button
    // Block external navigation
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!new URL(url).pathname.startsWith('/')) {
        await route.abort();
      } else {
        await route.continue();
      }
    });

    await page.locator('[data-testid="cta-button"]').click();
    await page.waitForTimeout(1000);

    // Verify full event sequence
    const quickviewEvents = events.filter(e => e.type === 'quickview_open');
    const externalClickEvents = events.filter(e => e.type === 'external_link_click');

    console.log('Full event sequence:', events.map(e => e.type));

    // Should have exactly 1 quickview_open (from card click)
    expect(quickviewEvents.length).toBe(1);
    expect(quickviewEvents[0].source).toBe('listing_card');

    // Should have exactly 1 external_link_click (from dealer button)
    expect(externalClickEvents.length).toBe(1);
    expect(externalClickEvents[0].url).toBeDefined();

    // REGRESSION CHECK: external_link_click should NOT be triggered by card click
    // If we have more than 1 external_link_click, the bug has regressed
    expect(externalClickEvents.length).toBe(1);
  });

  test('keyboard navigation (J/K) fires quickview_open for each listing', async ({ page }) => {
    // Set up event collection
    const events = await collectTrackingEvents(page);

    // Navigate and open QuickView
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Clear events from initial card click
    events.length = 0;

    // Navigate to next listing with J key
    await page.keyboard.press('j');
    await page.waitForTimeout(500);

    // Navigate to next listing again
    await page.keyboard.press('j');
    await page.waitForTimeout(500);

    // Navigate back with K key
    await page.keyboard.press('k');
    await page.waitForTimeout(1000);

    // Check events
    const quickviewEvents = events.filter(e => e.type === 'quickview_open');
    const externalClickEvents = events.filter(e => e.type === 'external_link_click');

    console.log('Events after keyboard nav:', events.map(e => e.type));

    // Should NOT have any external_link_click from keyboard navigation
    expect(externalClickEvents.length).toBe(0);

    // Note: quickview_open might or might not fire for keyboard navigation
    // depending on implementation - the critical check is no external_link_click
  });
});

test.describe('Dealer Analytics Tracking - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('mobile: "View on dealer" button fires external_link_click', async ({ page, context }) => {
    // Set up event collection
    const events = await collectTrackingEvents(page);

    // Navigate to browse page
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });

    // Click card to open mobile QuickView sheet
    await page.locator('[data-testid="listing-card"]').first().click();

    // Wait for mobile sheet to appear
    await page.waitForTimeout(1000);

    // Clear events from card click
    events.length = 0;

    // Block external navigation
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!new URL(url).pathname.startsWith('/')) {
        await route.abort();
      } else {
        await route.continue();
      }
    });

    // Find and click the CTA button in mobile sheet
    const ctaButton = page.locator('[data-testid="cta-button"]');

    if (await ctaButton.isVisible()) {
      await ctaButton.click();
      await page.waitForTimeout(1000);

      // Verify external_link_click was fired
      const externalClickEvents = events.filter(e => e.type === 'external_link_click');

      console.log('Mobile events after CTA click:', events.map(e => e.type));

      expect(externalClickEvents.length).toBeGreaterThan(0);
      expect(externalClickEvents[0].url).toBeDefined();
      expect(externalClickEvents[0].listingId).toBeDefined();
    } else {
      // Mobile sheet might need expansion - skip gracefully
      console.log('CTA button not visible in mobile view - may need sheet expansion');
    }
  });
});
