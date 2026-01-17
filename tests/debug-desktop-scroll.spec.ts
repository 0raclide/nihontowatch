/**
 * Test: Debug Desktop QuickView scroll functionality
 *
 * The user reports that scrolling through images on desktop in the QuickView modal
 * is broken. This test attempts to:
 * 1. Open QuickView on a listing with multiple images
 * 2. Try to scroll the image area
 * 3. Verify scroll position changes
 */
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// Desktop viewport
test.use({
  viewport: { width: 1280, height: 800 },
});

test.describe('Desktop QuickView Scroll', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to browse page
    await page.goto('http://localhost:3000/browse');

    // Wait for listings to load
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().waitFor({ timeout: 15000 });

    console.log('Page loaded, listings visible');
  });

  test('image scroll area is scrollable on desktop', async ({ page }) => {
    // Click first listing card to open modal
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400); // Wait for animation
    console.log('Modal opened');

    // Get the desktop image scroll container (the one with overflow-y-auto inside lg:flex)
    // Desktop layout selector: hidden lg:flex -> inside it: flex-1 min-h-0 w-3/5 overflow-y-auto
    const desktopScrollContainer = page.locator('.lg\\:flex .overflow-y-auto').first();

    // Wait for it to be visible
    await expect(desktopScrollContainer).toBeVisible();
    console.log('Desktop scroll container found');

    // Get scroll metrics
    const scrollHeight = await desktopScrollContainer.evaluate(el => el.scrollHeight);
    const clientHeight = await desktopScrollContainer.evaluate(el => el.clientHeight);
    const initialScrollTop = await desktopScrollContainer.evaluate(el => el.scrollTop);

    console.log(`Scroll metrics: scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, initialScrollTop=${initialScrollTop}`);
    console.log(`Content overflows: ${scrollHeight > clientHeight}`);

    // Check if content is actually scrollable (has overflow)
    if (scrollHeight <= clientHeight) {
      console.log('WARNING: Content does not overflow - need a listing with multiple images');
      // Try to find if there are images
      const imageCount = await desktopScrollContainer.locator('img').count();
      console.log(`Number of images in scroll area: ${imageCount}`);

      // Still check if scroll area is properly configured
      const computedStyle = await desktopScrollContainer.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          overflowY: style.overflowY,
          height: style.height,
          maxHeight: style.maxHeight,
          display: style.display,
          position: style.position,
        };
      });
      console.log('Computed styles:', computedStyle);

      // Verify scroll-related styles are correct
      expect(['auto', 'scroll']).toContain(computedStyle.overflowY);
    }

    // Try to scroll programmatically
    await desktopScrollContainer.evaluate(el => {
      el.scrollTo({ top: 200, behavior: 'instant' });
    });
    await page.waitForTimeout(100);

    const scrollTopAfterProgrammatic = await desktopScrollContainer.evaluate(el => el.scrollTop);
    console.log(`Scroll position after programmatic scroll: ${scrollTopAfterProgrammatic}`);

    // If there was scrollable content, verify it scrolled
    if (scrollHeight > clientHeight) {
      expect(scrollTopAfterProgrammatic).toBeGreaterThan(0);
      console.log('Programmatic scroll succeeded');
    }

    // Reset scroll position
    await desktopScrollContainer.evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));

    // Try wheel scroll simulation
    const box = await desktopScrollContainer.boundingBox();
    if (box) {
      // Position mouse in the center of the scroll area
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.mouse.move(centerX, centerY);

      // Simulate mouse wheel scroll
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);

      const scrollTopAfterWheel = await desktopScrollContainer.evaluate(el => el.scrollTop);
      console.log(`Scroll position after mouse wheel: ${scrollTopAfterWheel}`);

      // This is the key test - wheel scroll should work
      if (scrollHeight > clientHeight) {
        if (scrollTopAfterWheel === 0) {
          console.error('BUG CONFIRMED: Mouse wheel scroll did not work!');
        } else {
          console.log('Mouse wheel scroll succeeded');
        }
        // For now, just log the result rather than fail - we want to understand the issue
        expect(scrollTopAfterWheel).toBeGreaterThan(0);
      }
    }
  });

  test('check CSS properties that could block scrolling', async ({ page }) => {
    // Click first listing card to open modal
    const listingCards = page.locator('[role="button"]');
    await listingCards.first().click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Check the scroll container and its parents for CSS issues
    const desktopScrollContainer = page.locator('.lg\\:flex .overflow-y-auto').first();

    // Get the entire hierarchy of computed styles
    const styleHierarchy = await desktopScrollContainer.evaluate(el => {
      const styles: Array<{ tag: string; className: string; overflow: string; overflowY: string; height: string; maxHeight: string; pointerEvents: string; position: string; zIndex: string }> = [];
      let current: HTMLElement | null = el as HTMLElement;

      while (current && current !== document.body) {
        const computed = window.getComputedStyle(current);
        styles.push({
          tag: current.tagName,
          className: current.className.slice(0, 100), // Truncate long class names
          overflow: computed.overflow,
          overflowY: computed.overflowY,
          height: computed.height,
          maxHeight: computed.maxHeight,
          pointerEvents: computed.pointerEvents,
          position: computed.position,
          zIndex: computed.zIndex,
        });
        current = current.parentElement;
      }

      return styles;
    });

    console.log('Style hierarchy (from scroll container to body):');
    styleHierarchy.forEach((style, i) => {
      console.log(`${i}: ${style.tag} - overflow: ${style.overflow}, overflowY: ${style.overflowY}, height: ${style.height}, pointer-events: ${style.pointerEvents}`);
    });

    // Check for common issues:
    // 1. overflow: hidden on a parent that clips scroll
    // 2. pointer-events: none blocking interaction
    // 3. Missing height constraints

    const hasOverflowHiddenParent = styleHierarchy.some((style, i) =>
      i > 0 && (style.overflow === 'hidden' || style.overflowY === 'hidden')
    );

    const hasPointerEventsNone = styleHierarchy.some(style =>
      style.pointerEvents === 'none'
    );

    console.log(`Has overflow:hidden parent: ${hasOverflowHiddenParent}`);
    console.log(`Has pointer-events:none: ${hasPointerEventsNone}`);

    // The scroll container itself should have overflow-y: auto or scroll
    const scrollContainerStyle = styleHierarchy[0];
    expect(['auto', 'scroll']).toContain(scrollContainerStyle.overflowY);
    console.log(`Scroll container has correct overflowY: ${scrollContainerStyle.overflowY}`);
  });

  test('test scroll on listing with multiple images', async ({ page }) => {
    // Click first listing card
    const listingCards = page.locator('[role="button"]');

    // Try to find a listing with multiple images by checking several
    let foundMultiImage = false;
    let desktopScrollContainer: ReturnType<typeof page.locator> | null = null;

    for (let i = 0; i < Math.min(10, await listingCards.count()); i++) {
      await listingCards.nth(i).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await page.waitForTimeout(300);

      desktopScrollContainer = page.locator('.lg\\:flex .overflow-y-auto').first();
      const imageCount = await desktopScrollContainer.locator('img').count();
      const scrollHeight = await desktopScrollContainer.evaluate(el => el.scrollHeight);
      const clientHeight = await desktopScrollContainer.evaluate(el => el.clientHeight);

      console.log(`Listing ${i + 1}: ${imageCount} images, scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`);

      if (scrollHeight > clientHeight && imageCount > 1) {
        foundMultiImage = true;
        console.log(`Found listing with scrollable content at index ${i}`);
        break;
      }

      // Close modal and try next
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    if (!foundMultiImage || !desktopScrollContainer) {
      console.log('Could not find a listing with multiple images that overflow');
      // Skip the scroll test but don't fail
      return;
    }

    // Now test actual scrolling on this multi-image listing
    const initialScroll = await desktopScrollContainer.evaluate(el => el.scrollTop);

    // Test wheel scroll
    const box = await desktopScrollContainer.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(300);

      const afterWheelScroll = await desktopScrollContainer.evaluate(el => el.scrollTop);
      console.log(`Scroll after wheel: ${initialScroll} -> ${afterWheelScroll}`);

      if (afterWheelScroll === initialScroll) {
        console.error('BUG: Wheel scroll failed to change scroll position!');

        // Debug: Check if scroll events are being captured
        const scrollHandled = await desktopScrollContainer.evaluate(el => {
          return new Promise<boolean>(resolve => {
            let handled = false;
            const handler = () => { handled = true; };
            el.addEventListener('scroll', handler, { once: true });
            el.scrollTop += 10;
            setTimeout(() => {
              el.removeEventListener('scroll', handler);
              resolve(handled);
            }, 100);
          });
        });
        console.log(`Scroll event fires on programmatic scroll: ${scrollHandled}`);
      }

      expect(afterWheelScroll).toBeGreaterThan(initialScroll);
    }
  });
});
