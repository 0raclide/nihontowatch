/**
 * Debug test: Glossary tooltips in QuickView
 *
 * Issue: User reports that clicking glossary terms in QuickView doesn't show tooltips
 */
import { test, expect } from '@playwright/test';

test.describe('Glossary tooltip debugging', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('debug: check if glossary terms exist in QuickView setsumei', async ({ page }) => {
    // Navigate and open a listing with setsumei content (Juyo/Tokubetsu Juyo)
    // First, let's just go to browse and look for any listing with setsumei
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click first card
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Check if SetsumeiSection exists
    const setsumeiHeader = page.locator('text=NBTHK Zufu Commentary');
    const hasSetsumei = await setsumeiHeader.count() > 0;
    console.log('Has setsumei section:', hasSetsumei);

    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/quickview-debug-1.png', fullPage: false });

    // Look for any gold-colored buttons (glossary terms)
    const glossaryButtons = page.locator('button.text-gold');
    const buttonCount = await glossaryButtons.count();
    console.log('Number of gold buttons (potential glossary terms):', buttonCount);

    // If no setsumei on first listing, try to find one that has Juyo certification
    if (!hasSetsumei) {
      console.log('First listing has no setsumei, looking for Juyo listing...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Look for a Juyo badge in the grid
      const juyoCard = page.locator('[data-testid="listing-card"]:has-text("Juyo")').first();
      if (await juyoCard.count() > 0) {
        await juyoCard.click();
        await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
        await page.waitForTimeout(500);

        const hasSetsumeiNow = await setsumeiHeader.count() > 0;
        console.log('Juyo listing has setsumei:', hasSetsumeiNow);
      }
    }
  });

  test('debug: inspect DOM for glossary term buttons', async ({ page }) => {
    // Go directly to a listing detail page instead of QuickView
    // to see if glossary works there
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Get all buttons within the quickview content
    const quickviewContent = page.locator('[data-testid="quickview-content"]');

    // Find buttons that look like glossary terms (text-gold class)
    const allButtons = quickviewContent.locator('button');
    const buttonCount = await allButtons.count();
    console.log('Total buttons in QuickView:', buttonCount);

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const btn = allButtons.nth(i);
      const text = await btn.textContent();
      const className = await btn.getAttribute('class');
      console.log(`Button ${i}: "${text}" - class: ${className}`);
    }

    // Screenshot the current state
    await page.screenshot({ path: 'tests/screenshots/quickview-debug-buttons.png' });
  });

  test('debug: try clicking a glossary term', async ({ page }) => {
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Get the scrollable content area
    const scrollableContent = page.locator('[data-testid="quickview-scrollable-content"]');

    // Look for glossary term buttons (they have aria-haspopup="true")
    const glossaryTerms = page.locator('button[aria-haspopup="true"]');
    const termCount = await glossaryTerms.count();
    console.log('Glossary terms found:', termCount);

    if (termCount > 0) {
      // Get the first term
      const firstTerm = glossaryTerms.first();
      const termText = await firstTerm.textContent();
      console.log('Clicking on term:', termText);

      // Scroll the term into view within the QuickView modal
      await firstTerm.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      // Verify it's now visible
      const isVisible = await firstTerm.isVisible();
      console.log('Term visible after scroll:', isVisible);

      // Take screenshot before click
      await page.screenshot({ path: 'tests/screenshots/before-term-click.png' });

      // Click it
      await firstTerm.click({ force: false });
      await page.waitForTimeout(500);

      // Check if tooltip appeared (it should be in document.body as a portal)
      const tooltip = page.locator('[role="tooltip"]');
      const tooltipCount = await tooltip.count();
      console.log('Tooltip count after click:', tooltipCount);

      if (tooltipCount > 0) {
        const tooltipVisible = await tooltip.isVisible();
        console.log('Tooltip visible after click:', tooltipVisible);

        const tooltipText = await tooltip.textContent();
        console.log('Tooltip content:', tooltipText);

        // Check z-index of tooltip
        const zIndex = await tooltip.evaluate(el => window.getComputedStyle(el).zIndex);
        console.log('Tooltip z-index:', zIndex);
      }

      // Screenshot
      await page.screenshot({ path: 'tests/screenshots/glossary-term-clicked.png' });
    }
  });

  test('debug: check glossary on standalone glossary page', async ({ page }) => {
    // First verify glossary works on the dedicated page
    await page.goto('/glossary');
    await page.waitForSelector('h1:has-text("Glossary")', { timeout: 10000 });

    // Find a term card
    const termCards = page.locator('button:has-text("Hamon")');
    if (await termCards.count() > 0) {
      console.log('Found Hamon term on glossary page');
      await termCards.first().click();
      await page.waitForTimeout(300);

      // Check if it expanded
      const expanded = page.locator('button[aria-expanded="true"]');
      const isExpanded = await expanded.count() > 0;
      console.log('Term expanded on glossary page:', isExpanded);
    }

    await page.screenshot({ path: 'tests/screenshots/glossary-page-debug.png' });
  });
});
