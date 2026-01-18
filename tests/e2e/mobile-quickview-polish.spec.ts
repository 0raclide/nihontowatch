import { test, expect } from '@playwright/test';

/**
 * Mobile QuickView UI polish test
 * Captures screenshots to analyze:
 * 1. CTA button visibility (should not be obscured by browser bar)
 * 2. Header layout (favorite button position)
 * 3. Dealer row display
 */

// Configure mobile viewport (using chromium with mobile dimensions)
test.use({
  viewport: { width: 393, height: 852 }, // iPhone 14 Pro dimensions
  isMobile: true,
  hasTouch: true,
});

test.describe('Mobile QuickView Polish', () => {

  test('capture mobile quickview expanded state', async ({ page }) => {
    // Navigate to browse page
    await page.goto('/browse', { waitUntil: 'networkidle' });

    // Wait for listings to load
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });

    // Click first listing to open QuickView
    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    // Wait for mobile sheet to appear and be expanded
    await page.waitForSelector('[data-testid="mobile-sheet"]', { timeout: 5000 });

    // Give animation time to complete
    await page.waitForTimeout(500);

    // Capture full mobile view
    await page.screenshot({
      path: 'tests/screenshots/mobile-quickview-full.png',
      fullPage: false
    });

    // Get the mobile sheet element
    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    await mobileSheet.screenshot({
      path: 'tests/screenshots/mobile-quickview-sheet.png'
    });

    // Log the sheet height
    const sheetHeight = await mobileSheet.evaluate(el => el.clientHeight);
    console.log(`Mobile sheet height: ${sheetHeight}px`);

    // Check viewport height
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    console.log(`Viewport height: ${viewportHeight}px`);

    // Calculate remaining space below sheet
    const sheetBottom = await mobileSheet.boundingBox();
    console.log(`Sheet bottom position: ${sheetBottom?.y ?? 0 + (sheetBottom?.height ?? 0)}px`);

    // Look for the CTA button
    const ctaButton = mobileSheet.locator('a:has-text("See Full Listing")');
    if (await ctaButton.isVisible()) {
      const ctaBox = await ctaButton.boundingBox();
      console.log(`CTA button position: y=${ctaBox?.y}, height=${ctaBox?.height}`);
      console.log(`CTA button bottom edge: ${(ctaBox?.y ?? 0) + (ctaBox?.height ?? 0)}px`);

      // Check if CTA is potentially obscured (bottom edge close to viewport)
      const ctaBottomEdge = (ctaBox?.y ?? 0) + (ctaBox?.height ?? 0);
      const obscuredRisk = viewportHeight - ctaBottomEdge < 20;
      console.log(`CTA potentially obscured: ${obscuredRisk}`);
    }

    // Check header layout
    const headerRow = mobileSheet.locator('.flex.items-center.justify-between').first();
    await headerRow.screenshot({
      path: 'tests/screenshots/mobile-quickview-header.png'
    });

    // Log all interactive elements in header
    const favoriteButton = mobileSheet.locator('[aria-label*="favorite"], [aria-label*="Favorite"]').first();
    const closeButton = mobileSheet.locator('[aria-label="Close quick view"]');

    if (await favoriteButton.isVisible()) {
      const favBox = await favoriteButton.boundingBox();
      console.log(`Favorite button position: x=${favBox?.x}`);
    }

    if (await closeButton.isVisible()) {
      const closeBox = await closeButton.boundingBox();
      console.log(`Close button position: x=${closeBox?.x}`);
    }

    // Look for dealer row (may not exist if no real dealer name)
    const dealerLocator = mobileSheet.locator('text=Dealer').first();
    const hasDealerRow = await dealerLocator.isVisible().catch(() => false);
    console.log(`Dealer row visible: ${hasDealerRow}`);
    if (hasDealerRow) {
      const dealerText = await dealerLocator.textContent();
      console.log(`Dealer text content: "${dealerText}"`);
    }

    // Get all text content in the expanded sheet for analysis
    const sheetText = await mobileSheet.textContent();
    console.log(`Sheet text content: ${sheetText?.substring(0, 500)}...`);
  });

  test('capture collapsed state', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });

    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    await page.waitForSelector('[data-testid="mobile-sheet"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Tap on image area to collapse the sheet
    const imageScroller = page.locator('[data-testid="mobile-image-scroller"]');
    await imageScroller.click();

    await page.waitForTimeout(400);

    // Capture collapsed state
    await page.screenshot({
      path: 'tests/screenshots/mobile-quickview-collapsed.png',
      fullPage: false
    });

    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');
    const collapsedHeight = await mobileSheet.evaluate(el => el.clientHeight);
    console.log(`Collapsed sheet height: ${collapsedHeight}px`);
  });

  test('analyze header element positions', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });

    const firstCard = page.locator('[data-testid="listing-card"]').first();
    await firstCard.click();

    await page.waitForSelector('[data-testid="mobile-sheet"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const mobileSheet = page.locator('[data-testid="mobile-sheet"]');

    // Analyze all elements and their positions
    const analysis = await mobileSheet.evaluate((sheet) => {
      const results: Record<string, unknown> = {};

      // Get all elements with their positions
      const allElements = sheet.querySelectorAll('*');
      const interactiveElements: Array<{tag: string, text: string, x: number, y: number, width: number, ariaLabel: string | null}> = [];

      allElements.forEach(el => {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
          const rect = el.getBoundingClientRect();
          interactiveElements.push({
            tag: el.tagName,
            text: (el.textContent || '').substring(0, 30),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            ariaLabel: el.getAttribute('aria-label')
          });
        }
      });

      results.interactiveElements = interactiveElements;
      results.sheetHeight = sheet.clientHeight;
      results.sheetWidth = sheet.clientWidth;

      // Find the CTA button specifically
      const cta = sheet.querySelector('a[href*="http"]');
      if (cta) {
        const ctaRect = cta.getBoundingClientRect();
        results.ctaPosition = {
          y: ctaRect.y,
          bottom: ctaRect.bottom,
          height: ctaRect.height
        };
      }

      return results;
    });

    console.log('UI Analysis:', JSON.stringify(analysis, null, 2));
  });
});
