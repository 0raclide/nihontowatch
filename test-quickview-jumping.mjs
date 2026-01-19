import { chromium } from 'playwright';

const URL = 'https://nihontowatch.com';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    console.log('=== QuickView Jumping Diagnostic Test ===\n');
    await page.goto(URL, { timeout: 60000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Test 1: Measure initial positions
    console.log('=== Test 1: Initial State ===');
    const getPageState = async () => {
      return await page.evaluate(() => {
        const filterBar = document.querySelector('[data-testid="filter-bar"]') ||
                          document.querySelector('.sticky') ||
                          document.querySelector('[class*="filter"]');
        const firstCard = document.querySelector('[data-testid="listing-card"]');
        const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
        const container = document.querySelector('.virtual-scroll-container');

        return {
          scrollY: window.scrollY,
          filterBarTop: filterBar?.getBoundingClientRect().top,
          filterBarClass: filterBar?.className,
          firstCardTop: firstCard?.getBoundingClientRect().top,
          firstCardId: firstCard?.getAttribute('data-listing-id'),
          gridTransform: grid?.parentElement?.style?.transform,
          containerHeight: container?.style?.height,
          bodyOverflow: document.body.style.overflow,
          htmlOverflow: document.documentElement.style.overflow,
          scrollLockActive: window.__scrollLockActive,
        };
      });
    };

    const initialState = await getPageState();
    console.log('  ScrollY:', initialState.scrollY);
    console.log('  Filter bar top:', initialState.filterBarTop?.toFixed(0), 'px');
    console.log('  First card top:', initialState.firstCardTop?.toFixed(0), 'px');
    console.log('  First card ID:', initialState.firstCardId);
    console.log('  Grid transform:', initialState.gridTransform);
    console.log('  Body overflow:', initialState.bodyOverflow || '(not set)');
    console.log('  Scroll lock:', initialState.scrollLockActive);

    // Test 2: Scroll down a bit first
    console.log('\n=== Test 2: Scroll Down First ===');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);

    // Check scroll position multiple times to see if it's stable
    const scroll1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(100);
    const scroll2 = await page.evaluate(() => window.scrollY);
    console.log('  Scroll check 1:', scroll1, 'Scroll check 2:', scroll2);

    const afterScrollState = await getPageState();
    console.log('  ScrollY:', afterScrollState.scrollY);
    console.log('  Filter bar top:', afterScrollState.filterBarTop?.toFixed(0), 'px');
    console.log('  First card top:', afterScrollState.firstCardTop?.toFixed(0), 'px');
    console.log('  Grid transform:', afterScrollState.gridTransform);

    // Test 3: Click on first card to open QuickView
    console.log('\n=== Test 3: Open QuickView ===');
    const cardToClick = await page.$('[data-testid="listing-card"]');
    if (cardToClick) {
      // Get card position before click
      const beforeClick = await getPageState();
      console.log('  BEFORE CLICK:');
      console.log('    ScrollY:', beforeClick.scrollY);
      console.log('    Filter bar top:', beforeClick.filterBarTop?.toFixed(0), 'px');
      console.log('    First card top:', beforeClick.firstCardTop?.toFixed(0), 'px');

      // Check scroll position RIGHT before click
      const scrollRightBeforeClick = await page.evaluate(() => window.scrollY);
      console.log('    ScrollY right before click:', scrollRightBeforeClick);

      // Check global captured position before click
      const globalBefore = await page.evaluate(() => window.__savedScrollPosition);
      console.log('    Global captured position:', globalBefore);

      // Use force:true to prevent Playwright from scrolling element into view
      await cardToClick.click({ force: true });
      await page.waitForTimeout(100); // Short wait to catch immediate changes

      // Check global captured position after click
      const globalAfter = await page.evaluate(() => window.__savedScrollPosition);
      console.log('    Global captured position after click:', globalAfter);

      const duringOpen = await getPageState();
      console.log('  DURING OPEN (100ms):');
      console.log('    ScrollY:', duringOpen.scrollY);
      console.log('    Filter bar top:', duringOpen.filterBarTop?.toFixed(0), 'px');
      console.log('    First card top:', duringOpen.firstCardTop?.toFixed(0), 'px');
      console.log('    Body overflow:', duringOpen.bodyOverflow || '(not set)');
      console.log('    Scroll lock:', duringOpen.scrollLockActive);

      await page.waitForTimeout(400); // Wait for animation

      const afterOpen = await getPageState();
      console.log('  AFTER OPEN (500ms):');
      console.log('    ScrollY:', afterOpen.scrollY);
      console.log('    Filter bar top:', afterOpen.filterBarTop?.toFixed(0), 'px');
      console.log('    First card top:', afterOpen.firstCardTop?.toFixed(0), 'px');
      console.log('    Body overflow:', afterOpen.bodyOverflow || '(not set)');
      console.log('    HTML overflow:', afterOpen.htmlOverflow || '(not set)');
      console.log('    Scroll lock:', afterOpen.scrollLockActive);
      console.log('    Grid transform:', afterOpen.gridTransform);

      // Check for QuickView modal
      const quickViewVisible = await page.$('[data-testid="quickview-panel"]') ||
                               await page.$('[role="dialog"]') ||
                               await page.$('.quickview');
      console.log('  QuickView visible:', !!quickViewVisible);

      // Calculate jumps
      const filterBarJump = Math.abs((afterOpen.filterBarTop || 0) - (beforeClick.filterBarTop || 0));
      const cardJump = Math.abs((afterOpen.firstCardTop || 0) - (beforeClick.firstCardTop || 0));

      if (filterBarJump > 5) {
        console.log(`  ⚠️ FILTER BAR JUMPED: ${filterBarJump.toFixed(0)}px`);
      }
      if (cardJump > 5) {
        console.log(`  ⚠️ CARD JUMPED: ${cardJump.toFixed(0)}px`);
      }
    }

    // Test 4: Close QuickView
    console.log('\n=== Test 4: Close QuickView ===');

    // Try different close methods
    const closeButton = await page.$('[data-testid="quickview-close"]') ||
                        await page.$('[aria-label="Close"]') ||
                        await page.$('button:has-text("Close")');

    const beforeClose = await getPageState();
    console.log('  BEFORE CLOSE:');
    console.log('    ScrollY:', beforeClose.scrollY);
    console.log('    Filter bar top:', beforeClose.filterBarTop?.toFixed(0), 'px');
    console.log('    First card top:', beforeClose.firstCardTop?.toFixed(0), 'px');

    if (closeButton) {
      await closeButton.click();
    } else {
      // Try pressing Escape
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(100);

    const duringClose = await getPageState();
    console.log('  DURING CLOSE (100ms):');
    console.log('    ScrollY:', duringClose.scrollY);
    console.log('    Filter bar top:', duringClose.filterBarTop?.toFixed(0), 'px');
    console.log('    First card top:', duringClose.firstCardTop?.toFixed(0), 'px');
    console.log('    Scroll lock:', duringClose.scrollLockActive);

    await page.waitForTimeout(400);

    const afterClose = await getPageState();
    console.log('  AFTER CLOSE (500ms):');
    console.log('    ScrollY:', afterClose.scrollY);
    console.log('    Filter bar top:', afterClose.filterBarTop?.toFixed(0), 'px');
    console.log('    First card top:', afterClose.firstCardTop?.toFixed(0), 'px');
    console.log('    Body overflow:', afterClose.bodyOverflow || '(not set)');
    console.log('    Scroll lock:', afterClose.scrollLockActive);
    console.log('    Grid transform:', afterClose.gridTransform);

    // Calculate jumps from before open to after close
    const totalFilterJump = Math.abs((afterClose.filterBarTop || 0) - (afterScrollState.filterBarTop || 0));
    const totalCardJump = Math.abs((afterClose.firstCardTop || 0) - (afterScrollState.firstCardTop || 0));
    const scrollDrift = Math.abs((afterClose.scrollY || 0) - (afterScrollState.scrollY || 0));

    console.log('\n=== Test 5: Position Comparison ===');
    console.log('  Comparing: after scroll (before QuickView) vs after close');
    console.log(`  Filter bar position change: ${totalFilterJump.toFixed(0)}px`);
    console.log(`  Card position change: ${totalCardJump.toFixed(0)}px`);
    console.log(`  Scroll position drift: ${scrollDrift.toFixed(0)}px`);

    // Summary
    console.log('\n=== SUMMARY ===');
    const hasIssues = totalFilterJump > 10 || totalCardJump > 10 || scrollDrift > 10;

    if (hasIssues) {
      console.log('❌ QUICKVIEW JUMPING ISSUES DETECTED');
      if (totalFilterJump > 10) console.log(`   - Filter bar shifted ${totalFilterJump.toFixed(0)}px`);
      if (totalCardJump > 10) console.log(`   - Cards shifted ${totalCardJump.toFixed(0)}px`);
      if (scrollDrift > 10) console.log(`   - Scroll position drifted ${scrollDrift.toFixed(0)}px`);
    } else {
      console.log('✅ No QuickView jumping issues detected');
    }

    // Test 6: Multiple open/close cycles
    console.log('\n=== Test 6: Multiple Cycles ===');
    for (let i = 0; i < 3; i++) {
      const card = await page.$('[data-testid="listing-card"]');
      const beforeState = await getPageState();

      if (card) {
        await card.click();
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const afterState = await getPageState();
        const drift = Math.abs((afterState.scrollY || 0) - (beforeState.scrollY || 0));
        console.log(`  Cycle ${i + 1}: scroll drift = ${drift}px`);
      }
    }

    console.log('\nKeeping browser open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

  } finally {
    await browser.close();
  }
}

test().catch(console.error);
