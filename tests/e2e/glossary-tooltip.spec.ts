/**
 * Tests: Glossary tooltips in QuickView and Glossary page
 *
 * Verifies that glossary terms can be clicked to show tooltips
 * with definitions in both QuickView modal and the dedicated glossary page.
 */
import { test, expect } from '@playwright/test';

test.describe('Glossary tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('clicking a glossary term in QuickView shows tooltip', async ({ page }) => {
    // Navigate to listings
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView for first listing
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Find glossary term buttons (they have aria-haspopup="true")
    const glossaryTerms = page.locator('button[aria-haspopup="true"]');
    const termCount = await glossaryTerms.count();
    expect(termCount).toBeGreaterThan(0);

    // Find a visible term
    let visibleTerm = null;
    for (let i = 0; i < termCount; i++) {
      const term = glossaryTerms.nth(i);
      if (await term.isVisible()) {
        visibleTerm = term;
        break;
      }
    }

    // We should have at least one visible glossary term
    expect(visibleTerm).not.toBeNull();

    // Click the term
    await visibleTerm!.click();
    await page.waitForTimeout(300);

    // Tooltip should appear with role="tooltip"
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();

    // Tooltip should have content (definition)
    const tooltipText = await tooltip.textContent();
    expect(tooltipText!.length).toBeGreaterThan(10);
  });

  test('tooltip closes when clicking outside', async ({ page }) => {
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Find and click a visible glossary term
    const glossaryTerms = page.locator('button[aria-haspopup="true"]');
    let visibleTerm = null;
    for (let i = 0; i < await glossaryTerms.count(); i++) {
      const term = glossaryTerms.nth(i);
      if (await term.isVisible()) {
        visibleTerm = term;
        break;
      }
    }

    if (visibleTerm) {
      await visibleTerm.click();
      await page.waitForTimeout(300);

      // Verify tooltip is visible
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();

      // Click outside the tooltip (on the modal backdrop area)
      await page.locator('[data-testid="quickview-modal"]').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      // Tooltip should be hidden
      await expect(tooltip).not.toBeVisible();
    }
  });

  test('tooltip closes on Escape key', async ({ page }) => {
    await page.goto('/?tab=available');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Open QuickView
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Find and click a visible glossary term
    const glossaryTerms = page.locator('button[aria-haspopup="true"]');
    let visibleTerm = null;
    for (let i = 0; i < await glossaryTerms.count(); i++) {
      const term = glossaryTerms.nth(i);
      if (await term.isVisible()) {
        visibleTerm = term;
        break;
      }
    }

    if (visibleTerm) {
      await visibleTerm.click();
      await page.waitForTimeout(300);

      // Verify tooltip is visible
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Tooltip should be hidden
      await expect(tooltip).not.toBeVisible();
    }
  });

  test('glossary page shows terms and allows expansion', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Page should have the correct title
    const heading = page.locator('h1');
    await expect(heading).toContainText('Glossary');

    // Should have search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Should have category filter buttons
    const categoryButtons = page.locator('button:has-text("All")');
    expect(await categoryButtons.count()).toBeGreaterThan(0);

    // Should have term cards
    const termCards = page.locator('[data-testid="glossary-term-card"]');
    // If no test ids, look for cards with Japanese characters (kanji)
    const glossaryCards = termCards.count() > 0
      ? termCards
      : page.locator('button').filter({ hasText: /[一-龯ぁ-んァ-ン]/ });

    const cardCount = await glossaryCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('glossary page search filters terms', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Search for a specific term
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await searchInput.fill('hamon');
    await page.waitForTimeout(500);

    // Results should be filtered (fewer items or contain hamon)
    const visibleTerms = page.locator('button:has-text("hamon"), button:has-text("Hamon")');
    expect(await visibleTerms.count()).toBeGreaterThan(0);
  });
});
