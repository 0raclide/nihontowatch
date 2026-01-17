/**
 * DEBUG: Test all QuickView close methods on desktop
 *
 * Tests:
 * 1. Escape key
 * 2. Backdrop click (click outside modal content)
 * 3. X button click
 * 4. Multiple rapid close attempts
 * 5. Close after interaction
 */
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// Force desktop viewport
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('QuickView Desktop Close Methods', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to browse page
    await page.goto('http://localhost:3000/browse');

    // Wait for listings to load
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });

    // Click first listing card to open modal
    await listingCards.first().click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Wait for animation to complete
    await page.waitForTimeout(350);

    // Verify modal is open
    const modalCount = await page.locator('[role="dialog"]').count();
    expect(modalCount).toBe(1);
    console.log('Modal opened successfully');
  });

  test('ESCAPE key should close the modal', async ({ page }) => {
    console.log('Testing: Escape key close');

    // Press Escape
    await page.keyboard.press('Escape');
    console.log('Pressed Escape key');

    // Wait for close animation (250ms) plus buffer
    await page.waitForTimeout(400);

    // Check if modal is closed
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log(`Modal count after Escape: ${modalCount}`);

    // Wait additional time to check for re-opening
    await page.waitForTimeout(500);
    const finalCount = await page.locator('[role="dialog"]').count();
    console.log(`Final modal count: ${finalCount}`);

    expect(finalCount).toBe(0);
    console.log('ESCAPE: PASS');
  });

  test('BACKDROP CLICK should close the modal', async ({ page }) => {
    console.log('Testing: Backdrop click close');

    // Get the modal dialog element
    const modal = page.locator('[role="dialog"]');
    const modalBox = await modal.boundingBox();

    if (!modalBox) {
      throw new Error('Could not get modal bounding box');
    }

    console.log(`Modal bounding box: x=${modalBox.x}, y=${modalBox.y}, width=${modalBox.width}, height=${modalBox.height}`);

    // Get viewport size
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Could not get viewport size');
    }
    console.log(`Viewport: ${viewport.width}x${viewport.height}`);

    // Find the content container (the actual white modal content)
    // On desktop, the content is a centered container - we need to click OUTSIDE it
    // The modal content has class "max-w-4xl" which is roughly 896px
    // It's centered, so the backdrop areas are on the left and right edges

    // Click on the far left edge of the modal (which should be backdrop area)
    const clickX = 20; // Far left - should be backdrop
    const clickY = viewport.height / 2; // Middle of screen vertically

    console.log(`Clicking backdrop at coordinates: (${clickX}, ${clickY})`);

    // Use mouse.click for precise positioning
    await page.mouse.click(clickX, clickY);
    console.log('Clicked on backdrop area');

    // Wait for close animation
    await page.waitForTimeout(400);

    // Check if modal is closed
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log(`Modal count after backdrop click: ${modalCount}`);

    // Wait additional time to check for re-opening
    await page.waitForTimeout(500);
    const finalCount = await page.locator('[role="dialog"]').count();
    console.log(`Final modal count: ${finalCount}`);

    expect(finalCount).toBe(0);
    console.log('BACKDROP CLICK: PASS');
  });

  test('X BUTTON should close the modal', async ({ page }) => {
    console.log('Testing: X button click close');

    // Find the close button
    // It has aria-label="Close quick view" and is visible on desktop (lg:flex)
    const closeButton = page.locator('[aria-label="Close quick view"]');

    // Check if button is visible
    const isVisible = await closeButton.isVisible();
    console.log(`Close button visible: ${isVisible}`);

    if (!isVisible) {
      // Log all buttons for debugging
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} buttons total`);
      for (let i = 0; i < allButtons.length; i++) {
        const ariaLabel = await allButtons[i].getAttribute('aria-label');
        const visible = await allButtons[i].isVisible();
        console.log(`Button ${i}: aria-label="${ariaLabel}", visible=${visible}`);
      }
      throw new Error('Close button (X) is not visible on desktop');
    }

    // Get button position for debugging
    const buttonBox = await closeButton.boundingBox();
    console.log(`Close button position: x=${buttonBox?.x}, y=${buttonBox?.y}`);

    // Click the close button
    await closeButton.click();
    console.log('Clicked X button');

    // Wait for close animation
    await page.waitForTimeout(400);

    // Check if modal is closed
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log(`Modal count after X button click: ${modalCount}`);

    // Wait additional time to check for re-opening
    await page.waitForTimeout(500);
    const finalCount = await page.locator('[role="dialog"]').count();
    console.log(`Final modal count: ${finalCount}`);

    expect(finalCount).toBe(0);
    console.log('X BUTTON: PASS');
  });

  test('DEBUG: Inspect modal structure', async ({ page }) => {
    console.log('Inspecting modal DOM structure...');

    // Get the modal structure
    const modalHtml = await page.locator('[role="dialog"]').innerHTML();
    console.log('Modal inner HTML (truncated):', modalHtml.substring(0, 500));

    // Check what elements have pointer-events
    const elementsWithPointerEvents = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];

      const results: { tag: string; classes: string; pointerEvents: string }[] = [];
      const walk = (el: Element) => {
        const style = window.getComputedStyle(el);
        const pe = style.pointerEvents;
        if (pe !== 'auto') {
          results.push({
            tag: el.tagName,
            classes: el.className,
            pointerEvents: pe
          });
        }
        for (const child of el.children) {
          walk(child);
        }
      };
      walk(dialog);
      return results;
    });

    console.log('Elements with non-auto pointer-events:');
    elementsWithPointerEvents.forEach(el => {
      console.log(`  ${el.tag}.${el.classes.substring(0, 50)}: pointer-events=${el.pointerEvents}`);
    });

    // Check z-index layers
    const zIndexLayers = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];

      const results: { tag: string; classes: string; zIndex: string }[] = [];
      const walk = (el: Element) => {
        const style = window.getComputedStyle(el);
        const zi = style.zIndex;
        if (zi !== 'auto') {
          results.push({
            tag: el.tagName,
            classes: el.className.substring(0, 60),
            zIndex: zi
          });
        }
        for (const child of el.children) {
          walk(child);
        }
      };
      walk(dialog);
      return results;
    });

    console.log('Elements with z-index:');
    zIndexLayers.forEach(el => {
      console.log(`  ${el.tag}: z-index=${el.zIndex}`);
    });

    // This test is for debugging only - always pass
    expect(true).toBe(true);
  });
});
