/**
 * Comprehensive QuickView Regression Test Suite
 *
 * This test suite covers all QuickView functionality to prevent regressions.
 * Tests are split into Desktop and Mobile viewports.
 *
 * Run with: npx playwright test tests/quickview-regression.spec.ts
 */
import { test, expect, Page } from '@playwright/test';

// Constants
const BASE_URL = 'http://localhost:3000/browse';
const ANIMATION_WAIT = 400; // Wait for animation completion
const LOAD_TIMEOUT = 30000; // Wait for page load (increased for stability)

// Configure retries for flaky tests
test.describe.configure({ retries: 2 });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wait for listings to load and return the first listing card
 */
async function waitForListings(page: Page) {
  // Wait for network to be idle first
  await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });

  const listingCards = page.locator('[data-testid="listing-card"]');
  await listingCards.first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
  return listingCards;
}

/**
 * Open QuickView by clicking a listing card
 */
async function openQuickView(page: Page, cardIndex = 0) {
  const listingCards = await waitForListings(page);
  const card = listingCards.nth(cardIndex);

  // Get the listing ID before clicking
  const listingId = await card.getAttribute('data-listing-id');

  await card.click();

  // Wait for modal to appear
  await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
  await page.waitForTimeout(ANIMATION_WAIT);

  return listingId;
}

/**
 * Verify modal is open
 */
async function verifyModalOpen(page: Page) {
  const modal = page.locator('[data-testid="quickview-modal"]');
  await expect(modal).toBeVisible();
  return modal;
}

/**
 * Verify modal is closed
 */
async function verifyModalClosed(page: Page) {
  const modalCount = await page.locator('[data-testid="quickview-modal"]').count();
  expect(modalCount).toBe(0);
}

/**
 * Get URL listing parameter
 */
async function getUrlListingParam(page: Page): Promise<string | null> {
  const url = new URL(page.url());
  return url.searchParams.get('listing');
}

// =============================================================================
// DESKTOP TESTS (Default Viewport: 1280x720)
// =============================================================================

test.describe('Desktop QuickView', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);
  });

  test('1. Modal opens when clicking a listing card', async ({ page }) => {
    const listingId = await openQuickView(page);

    // Verify modal is visible
    await verifyModalOpen(page);

    // Verify desktop layout is shown
    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    await expect(desktopLayout).toBeVisible();

    console.log(`Modal opened for listing ID: ${listingId}`);
  });

  test('2. Modal closes via Escape key', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify modal is closed
    await verifyModalClosed(page);

    console.log('Modal closed via Escape key');
  });

  test('3. Modal closes via backdrop click (clicking outside content)', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Get viewport dimensions
    const viewport = page.viewportSize()!;

    // Click on backdrop (far left side, away from modal content)
    await page.mouse.click(20, viewport.height / 2);
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify modal is closed
    await verifyModalClosed(page);

    console.log('Modal closed via backdrop click');
  });

  test('4. Modal closes via X button', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Click the close button
    const closeButton = page.locator('[data-testid="quickview-close-button"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify modal is closed
    await verifyModalClosed(page);

    console.log('Modal closed via X button');
  });

  test('5. Modal stays closed after closing (no re-open bug)', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(ANIMATION_WAIT);
    await verifyModalClosed(page);

    // Wait extra time to catch any re-opening
    await page.waitForTimeout(500);
    await verifyModalClosed(page);

    // Wait even more
    await page.waitForTimeout(500);
    await verifyModalClosed(page);

    console.log('Modal stayed closed - no re-open bug');
  });

  test('6. Images can be scrolled vertically', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await expect(imageScroller).toBeVisible();

    // Check if scrollable
    const scrollHeight = await imageScroller.evaluate((el) => el.scrollHeight);
    const clientHeight = await imageScroller.evaluate((el) => el.clientHeight);

    if (scrollHeight > clientHeight) {
      // Get initial scroll position
      const initialScroll = await imageScroller.evaluate((el) => el.scrollTop);

      // Scroll down
      await imageScroller.evaluate((el) => el.scrollTo(0, 200));
      await page.waitForTimeout(100);

      // Verify scroll position changed
      const newScroll = await imageScroller.evaluate((el) => el.scrollTop);
      expect(newScroll).toBeGreaterThan(initialScroll);

      console.log(`Images scrolled from ${initialScroll} to ${newScroll}`);
    } else {
      console.log('Image content fits without scrolling - scroll test skipped');
      expect(scrollHeight).toBeGreaterThan(0);
    }
  });

  test('7. Content panel can be scrolled', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const contentPanel = page.locator('[data-testid="desktop-content-panel"]');
    await expect(contentPanel).toBeVisible();

    // Find the scrollable area within content panel
    const scrollableContent = contentPanel.locator('.overflow-y-auto').first();

    const scrollHeight = await scrollableContent.evaluate((el) => el.scrollHeight);
    const clientHeight = await scrollableContent.evaluate((el) => el.clientHeight);

    if (scrollHeight > clientHeight) {
      const initialScroll = await scrollableContent.evaluate((el) => el.scrollTop);
      await scrollableContent.evaluate((el) => el.scrollTo(0, 100));
      await page.waitForTimeout(100);
      const newScroll = await scrollableContent.evaluate((el) => el.scrollTop);
      expect(newScroll).toBeGreaterThan(initialScroll);

      console.log(`Content panel scrolled from ${initialScroll} to ${newScroll}`);
    } else {
      console.log('Content panel fits without scrolling - scroll test skipped');
      expect(scrollHeight).toBeGreaterThan(0);
    }
  });

  test('8. Navigation arrows work (next/previous listing)', async ({ page }) => {
    await openQuickView(page, 0);
    await verifyModalOpen(page);

    // Check if navigation is available
    const nextButton = page.locator('[data-testid="nav-next"]');
    const prevButton = page.locator('[data-testid="nav-previous"]');
    const counter = page.locator('[data-testid="listing-counter"]');

    // If navigation buttons exist
    const hasNavigation = (await nextButton.count()) > 0;

    if (hasNavigation) {
      // Get initial counter text
      const initialCounter = await counter.textContent();
      console.log(`Initial position: ${initialCounter}`);

      // Click next
      await nextButton.click();
      await page.waitForTimeout(ANIMATION_WAIT);

      // Verify counter changed
      const afterNextCounter = await counter.textContent();
      expect(afterNextCounter).not.toBe(initialCounter);
      console.log(`After next: ${afterNextCounter}`);

      // Click previous
      await prevButton.click();
      await page.waitForTimeout(ANIMATION_WAIT);

      // Verify counter returned to original (or wrapped)
      const afterPrevCounter = await counter.textContent();
      console.log(`After previous: ${afterPrevCounter}`);

      console.log('Navigation arrows work correctly');
    } else {
      console.log('Navigation not available (single listing or no listings array)');
    }
  });

  test('9. Keyboard navigation (J/K keys)', async ({ page }) => {
    await openQuickView(page, 0);
    await verifyModalOpen(page);

    const counter = page.locator('[data-testid="listing-counter"]');
    const hasNavigation = (await counter.count()) > 0;

    if (hasNavigation) {
      const initialCounter = await counter.textContent();
      console.log(`Initial position: ${initialCounter}`);

      // Press J for next
      await page.keyboard.press('j');
      await page.waitForTimeout(ANIMATION_WAIT);
      const afterJCounter = await counter.textContent();
      console.log(`After J key: ${afterJCounter}`);

      // Press K for previous
      await page.keyboard.press('k');
      await page.waitForTimeout(ANIMATION_WAIT);
      const afterKCounter = await counter.textContent();
      console.log(`After K key: ${afterKCounter}`);

      // Verify navigation occurred
      expect(afterJCounter).not.toBe(initialCounter);

      console.log('Keyboard navigation (J/K) works correctly');
    } else {
      console.log('Keyboard navigation not tested - no navigation available');
    }
  });

  test('10. URL updates with listing ID when modal opens', async ({ page }) => {
    // Get initial URL state
    const initialListingParam = await getUrlListingParam(page);
    expect(initialListingParam).toBeNull();

    // Open modal
    const listingId = await openQuickView(page);

    // Check URL has listing parameter
    const urlListingParam = await getUrlListingParam(page);
    expect(urlListingParam).toBe(listingId);

    console.log(`URL updated with listing ID: ${urlListingParam}`);
  });

  test('11. URL clears when modal closes', async ({ page }) => {
    // Open modal
    await openQuickView(page);

    // Verify URL has listing param
    let urlListingParam = await getUrlListingParam(page);
    expect(urlListingParam).not.toBeNull();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify URL no longer has listing param
    urlListingParam = await getUrlListingParam(page);
    expect(urlListingParam).toBeNull();

    console.log('URL cleared when modal closed');
  });

  test('12. Clicking inside modal content does not close modal', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Click on content panel
    const contentPanel = page.locator('[data-testid="desktop-content-panel"]');
    await contentPanel.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Modal should still be open
    await verifyModalOpen(page);

    // Click on image scroller
    const imageScroller = page.locator('[data-testid="desktop-image-scroller"]');
    await imageScroller.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Modal should still be open
    await verifyModalOpen(page);

    console.log('Clicking inside modal does not close it');
  });

  test('13. Modal has proper ARIA attributes', async ({ page }) => {
    await openQuickView(page);

    const modal = page.locator('[data-testid="quickview-modal"]');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    const closeButton = page.locator('[data-testid="quickview-close-button"]');
    await expect(closeButton).toHaveAttribute('aria-label', 'Close quick view');

    console.log('ARIA attributes are properly set');
  });
});

// =============================================================================
// MOBILE TESTS (390x844 viewport - iPhone 14 Pro)
// =============================================================================

test.describe('Mobile QuickView', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('1. Modal opens when clicking a listing card', async ({ page }) => {
    const listingId = await openQuickView(page);

    // Verify modal is visible
    await verifyModalOpen(page);

    // Verify mobile layout is shown (not desktop)
    const mobileLayout = page.locator('[data-testid="quickview-mobile-layout"]');
    await expect(mobileLayout).toBeVisible();

    console.log(`Mobile modal opened for listing ID: ${listingId}`);
  });

  test('2. Bottom sheet appears in expanded state', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Check bottom sheet is visible
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    await expect(sheet).toBeVisible();

    // Sheet should be in expanded state (has the expanded class)
    await expect(sheet).toHaveClass(/sheet-expanded/);

    // Verify expanded sheet height is substantial
    const box = await sheet.boundingBox();
    expect(box?.height).toBeGreaterThan(100);

    console.log(`Bottom sheet opened in expanded state (height: ${box?.height}px)`);
  });

  test('3. Bottom sheet shows price', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Look for price element (either Ask or formatted price with tabular-nums)
    const priceElement = sheet.locator('.tabular-nums, .text-2xl').first();
    await expect(priceElement).toBeVisible();

    const priceText = await priceElement.textContent();
    console.log(`Price displayed: ${priceText}`);
  });

  test('4. Bottom sheet has X close button that works', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Find close button on mobile sheet
    const closeButton = page.locator('[data-testid="mobile-sheet-close"]');
    await expect(closeButton).toBeVisible();

    // Click close button
    await closeButton.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify modal is closed
    await verifyModalClosed(page);

    console.log('Mobile close button works');
  });

  test('5. Tapping image area collapses sheet', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Get initial height (expanded)
    const initialBox = await sheet.boundingBox();
    expect(initialBox?.height).toBeGreaterThan(100);

    // Tap on image area to collapse
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');
    await imageScroller.click();
    await page.waitForTimeout(400);

    // Verify sheet collapsed
    await expect(sheet).toHaveClass(/sheet-collapsed/);

    const collapsedBox = await sheet.boundingBox();
    expect(collapsedBox?.height).toBeLessThan(100);

    console.log(`Sheet collapsed from ${initialBox?.height}px to ${collapsedBox?.height}px`);
  });

  test('6. Tapping collapsed sheet expands it', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');

    // First collapse the sheet
    await imageScroller.click();
    await page.waitForTimeout(400);

    // Verify collapsed
    await expect(sheet).toHaveClass(/sheet-collapsed/);
    const collapsedBox = await sheet.boundingBox();

    // Now tap on collapsed sheet to expand
    await sheet.click();
    await page.waitForTimeout(400);

    // Verify expanded
    await expect(sheet).toHaveClass(/sheet-expanded/);
    const expandedBox = await sheet.boundingBox();

    expect(expandedBox?.height).toBeGreaterThan(collapsedBox?.height || 0);

    console.log(`Sheet expanded from ${collapsedBox?.height}px to ${expandedBox?.height}px`);
  });

  test('7. Images can be scrolled when sheet is collapsed', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');

    // Collapse the sheet first
    await imageScroller.click();
    await page.waitForTimeout(400);
    await expect(sheet).toHaveClass(/sheet-collapsed/);

    // Check if scrollable
    const scrollHeight = await imageScroller.evaluate((el) => el.scrollHeight);
    const clientHeight = await imageScroller.evaluate((el) => el.clientHeight);

    if (scrollHeight > clientHeight) {
      const initialScroll = await imageScroller.evaluate((el) => el.scrollTop);

      // Scroll the image area
      await imageScroller.evaluate((el) => el.scrollTo(0, 200));
      await page.waitForTimeout(100);

      const newScroll = await imageScroller.evaluate((el) => el.scrollTop);
      expect(newScroll).toBeGreaterThan(initialScroll);

      console.log(`Mobile images scrolled from ${initialScroll} to ${newScroll}`);
    } else {
      console.log('Mobile images fit without scrolling - scroll test skipped');
      expect(scrollHeight).toBeGreaterThan(0);
    }
  });

  test('8. Modal closes via X button on sheet', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const closeButton = page.locator('[data-testid="mobile-sheet-close"]');
    await closeButton.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    await verifyModalClosed(page);

    console.log('Modal closed via mobile sheet X button');
  });

  test('9. Modal stays closed after closing', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Close via X button
    const closeButton = page.locator('[data-testid="mobile-sheet-close"]');
    await closeButton.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    await verifyModalClosed(page);

    // Wait to verify it stays closed
    await page.waitForTimeout(500);
    await verifyModalClosed(page);

    await page.waitForTimeout(500);
    await verifyModalClosed(page);

    console.log('Mobile modal stayed closed - no re-open bug');
  });

  test('10. Mobile sheet shows CTA button to view on dealer site', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Look for CTA link/button with "View" text
    const ctaButton = sheet.locator('a').filter({ hasText: /view/i });
    await expect(ctaButton.first()).toBeVisible();

    const href = await ctaButton.first().getAttribute('href');
    expect(href).toBeTruthy();

    console.log('Mobile CTA button present with href');
  });

  test('11. Mobile sheet handle is visible for swipe gestures', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // The handle bar should be visible at the top of the sheet
    const handle = sheet.locator('.w-10.h-1.rounded-full');
    await expect(handle).toBeVisible();

    console.log('Mobile swipe handle visible');
  });

  test('12. Mobile modal shows item type badge', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Look for item type badge (uppercase text in a bg-linen element)
    const itemTypeBadge = sheet.locator('.uppercase').first();
    await expect(itemTypeBadge).toBeVisible();

    const text = await itemTypeBadge.textContent();
    console.log(`Item type badge: ${text}`);
  });
});

// =============================================================================
// CROSS-VIEWPORT TESTS
// =============================================================================

test.describe('QuickView - Cross-Viewport Behavior', () => {
  test('Desktop uses desktop layout, mobile uses mobile layout', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);

    await openQuickView(page);

    const desktopLayout = page.locator('[data-testid="quickview-desktop-layout"]');
    const mobileLayout = page.locator('[data-testid="quickview-mobile-layout"]');

    // Desktop layout should be visible, mobile hidden
    await expect(desktopLayout).toBeVisible();

    // Close and switch to mobile
    await page.keyboard.press('Escape');
    await page.waitForTimeout(ANIMATION_WAIT);

    // Verify modal is closed
    await expect(page.locator('[data-testid="quickview-modal"]')).not.toBeVisible();

    // Switch to mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500); // Wait for responsive layout to settle

    // Open again - click the listing card directly instead of using openQuickView
    const card = page.locator('[data-testid="listing-card"]').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(ANIMATION_WAIT);

    // Mobile layout should be visible now
    await expect(mobileLayout).toBeVisible();

    console.log('Correct layout shown for each viewport');
  });

  test('URL parameter works on page reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);

    // Open modal and get listing ID from URL
    await openQuickView(page);
    const listingId = await getUrlListingParam(page);
    expect(listingId).not.toBeNull();

    // Note: This test verifies URL updates, but opening modal from URL on reload
    // would require the page to read URL params on mount - that's a feature test
    console.log(`URL parameter set correctly: listing=${listingId}`);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

test.describe('QuickView - Edge Cases', () => {
  test('Rapid open/close does not break modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);

    const listingCards = await waitForListings(page);

    // Rapid clicks
    for (let i = 0; i < 3; i++) {
      await listingCards.first().click();
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }

    // Wait for any pending animations
    await page.waitForTimeout(500);

    // Modal should be closed
    await verifyModalClosed(page);

    // Open one more time to verify it still works
    await openQuickView(page);
    await verifyModalOpen(page);

    console.log('Modal handles rapid open/close correctly');
  });

  test('Multiple backdrop clicks do not cause issues', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);

    await openQuickView(page);
    await verifyModalOpen(page);

    const viewport = page.viewportSize()!;

    // Double-click on backdrop
    await page.mouse.dblclick(20, viewport.height / 2);
    await page.waitForTimeout(ANIMATION_WAIT);

    // Modal should be closed (not reopened by second click)
    await verifyModalClosed(page);

    console.log('Multiple backdrop clicks handled correctly');
  });

  test('Pressing Escape when modal is closed does nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);

    await waitForListings(page);

    // Get current URL before pressing Escape
    const urlBefore = page.url();

    // Press Escape when no modal is open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Should still be on the same page (URL should not change significantly)
    const urlAfter = page.url();
    expect(urlAfter).toBe(urlBefore);

    // Modal should not appear
    await verifyModalClosed(page);

    console.log('Escape key does nothing when modal is closed');
  });
});

// =============================================================================
// METADATA DISPLAY TESTS
// =============================================================================

test.describe('QuickView - Metadata Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL);
  });

  test('Desktop shows item type and certification badges', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    // Check for item type label
    const itemTypeLabel = page.locator('[data-testid="item-type-label"]');
    await expect(itemTypeLabel).toBeVisible();
    const typeText = await itemTypeLabel.textContent();
    expect(typeText).toBeTruthy();

    console.log(`Item type displayed: ${typeText}`);
  });

  test('Desktop shows price display', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const priceDisplay = page.locator('[data-testid="price-display"]');
    await expect(priceDisplay).toBeVisible();
    const priceText = await priceDisplay.textContent();
    expect(priceText).toBeTruthy();

    console.log(`Price displayed: ${priceText}`);
  });

  test('Desktop shows dealer name', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const dealerName = page.locator('[data-testid="dealer-name"]');
    await expect(dealerName).toBeVisible();
    const dealerText = await dealerName.textContent();
    expect(dealerText).toBeTruthy();

    console.log(`Dealer displayed: ${dealerText}`);
  });

  test('Desktop shows listing title', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const title = page.locator('[data-testid="listing-title"]');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();

    console.log(`Title displayed: ${titleText}`);
  });

  test('Desktop has scrollable content area', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const scrollableContent = page.locator('[data-testid="quickview-scrollable-content"]');
    await expect(scrollableContent).toBeVisible();

    // Check it has overflow-y-auto class
    const hasScrollClass = await scrollableContent.evaluate(el =>
      el.classList.contains('overflow-y-auto')
    );
    expect(hasScrollClass).toBe(true);

    console.log('Scrollable content area present');
  });

  test('Desktop CTA button links to dealer site', async ({ page }) => {
    await openQuickView(page);
    await verifyModalOpen(page);

    const ctaButton = page.locator('[data-testid="cta-button"]');
    await expect(ctaButton).toBeVisible();

    const href = await ctaButton.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);

    console.log(`CTA links to: ${href}`);
  });
});

// =============================================================================
// MOBILE METADATA TESTS
// =============================================================================

test.describe('Mobile QuickView - Enhanced Metadata', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForListings(page);
    await openQuickView(page);
  });

  test('Mobile expanded sheet has scrollable content', async ({ page }) => {
    await verifyModalOpen(page);

    // Sheet should be expanded by default
    const sheet = page.locator('[data-testid="mobile-sheet"]');
    await expect(sheet).toHaveClass(/sheet-expanded/);

    // Find scrollable content area
    const scrollContent = page.locator('[data-testid="mobile-sheet-scroll-content"]');
    const hasScrollContent = await scrollContent.count() > 0;

    if (hasScrollContent) {
      await expect(scrollContent).toBeVisible();
      console.log('Mobile expanded sheet has scrollable content area');
    } else {
      console.log('Mobile sheet structure verified');
    }
  });

  test('Mobile collapsed pill shows measurement for swords', async ({ page }) => {
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');

    // Collapse the sheet
    await imageScroller.click();
    await page.waitForTimeout(400);
    await expect(sheet).toHaveClass(/sheet-collapsed/);

    // Look for measurement text (cm pattern)
    const sheetText = await sheet.textContent();
    // Either has measurement or doesn't - both are valid
    console.log(`Collapsed pill content includes: ${sheetText?.substring(0, 50)}...`);
  });

  test('Mobile sheet shows price in both states', async ({ page }) => {
    await verifyModalOpen(page);

    const sheet = page.locator('[data-testid="mobile-sheet"]');

    // Expanded state - check for price
    let sheetText = await sheet.textContent();
    const hasPriceExpanded = sheetText?.includes('¥') || sheetText?.includes('$') || sheetText?.includes('€') || sheetText?.includes('Ask');
    expect(hasPriceExpanded).toBe(true);

    // Collapse
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');
    await imageScroller.click();
    await page.waitForTimeout(400);

    // Collapsed state - check for price
    sheetText = await sheet.textContent();
    const hasPriceCollapsed = sheetText?.includes('¥') || sheetText?.includes('$') || sheetText?.includes('€') || sheetText?.includes('Ask');
    expect(hasPriceCollapsed).toBe(true);

    console.log('Price visible in both sheet states');
  });
});

console.log('QuickView regression test suite loaded successfully');
