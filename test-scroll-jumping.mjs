import { chromium } from 'playwright';

const URL = 'https://nihontowatch.com';

async function test() {
  const browser = await chromium.launch({ headless: false }); // Visible to see jumping
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    console.log('=== Scroll Jumping Diagnostic Test ===\n');
    await page.goto(URL, { timeout: 60000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Test 1: Check virtual scroll container behavior
    console.log('=== Test 1: Virtual Scroll Container ===');
    const containerInfo = await page.evaluate(() => {
      const container = document.querySelector('.virtual-scroll-container');
      const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
      return {
        hasContainer: !!container,
        containerHeight: container?.style?.height,
        containerPosition: container?.style?.position,
        gridTransform: grid?.parentElement?.style?.transform,
        documentHeight: document.documentElement.scrollHeight,
      };
    });
    console.log('  Container height:', containerInfo.containerHeight);
    console.log('  Container position:', containerInfo.containerPosition);
    console.log('  Grid transform:', containerInfo.gridTransform);
    console.log('  Document height:', containerInfo.documentHeight);

    // Test 2: Track card positions during scroll
    console.log('\n=== Test 2: Card Position Stability ===');

    // Get initial card positions
    const getCardPositions = async () => {
      return await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="listing-card"]');
        return Array.from(cards).slice(0, 8).map(card => {
          const rect = card.getBoundingClientRect();
          const id = card.getAttribute('data-listing-id');
          return { id, top: rect.top, left: rect.left };
        });
      });
    };

    // Scroll slowly and check for jumps
    let jumpCount = 0;
    let lastPositions = null;

    for (let scrollY = 0; scrollY < 15000; scrollY += 100) {
      await page.evaluate(y => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(50);

      const positions = await getCardPositions();
      const scrollInfo = await page.evaluate(() => ({
        scrollY: window.scrollY,
        transform: document.querySelector('[data-testid="virtual-listing-grid"]')?.parentElement?.style?.transform
      }));

      if (lastPositions) {
        // Check if any visible card jumped unexpectedly
        for (const pos of positions) {
          const lastPos = lastPositions.find(p => p.id === pos.id);
          if (lastPos) {
            // Card should move up by ~100px (our scroll amount)
            const expectedTop = lastPos.top - 100;
            const actualTop = pos.top;
            const diff = Math.abs(actualTop - expectedTop);

            if (diff > 50) { // Allow 50px tolerance
              jumpCount++;
              if (jumpCount <= 5) {
                console.log(`  JUMP at scrollY=${scrollY}: Card ${pos.id} jumped ${diff.toFixed(0)}px`);
                console.log(`    Expected top: ${expectedTop.toFixed(0)}, Actual: ${actualTop.toFixed(0)}`);
                console.log(`    Transform: ${scrollInfo.transform}`);
              }
            }
          }
        }
      }

      lastPositions = positions;

      if (scrollY % 3000 === 0) {
        console.log(`  Scroll ${scrollY}: ${positions.length} cards, transform: ${scrollInfo.transform}`);
      }
    }

    console.log(`\n  Total jumps detected: ${jumpCount}`);

    // Test 3: Check row height consistency
    console.log('\n=== Test 3: Row Height Measurement ===');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const rowHeights = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="listing-card"]');
      const heights = [];
      let lastTop = null;

      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (lastTop !== null && Math.abs(rect.top - lastTop) > 10) {
          // New row
          heights.push(rect.top - lastTop);
        }
        lastTop = rect.top;
      }

      // Also measure actual card height
      const firstCard = cards[0];
      const cardHeight = firstCard?.getBoundingClientRect().height;

      return { rowGaps: heights.slice(0, 5), cardHeight };
    });

    console.log('  Card height:', rowHeights.cardHeight?.toFixed(0), 'px');
    console.log('  Row gaps (first 5):', rowHeights.rowGaps.map(h => h.toFixed(0)).join(', '), 'px');

    // Test 4: Check for layout shifts during load
    console.log('\n=== Test 4: Layout Shift During Load ===');
    await page.evaluate(() => window.scrollTo(0, 5000));
    await page.waitForTimeout(300);

    // Measure positions before and after content loads
    const beforeLoad = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="listing-card"]');
      const first = cards[0];
      return {
        scrollY: window.scrollY,
        firstCardTop: first?.getBoundingClientRect().top,
        cardCount: cards.length,
        containerHeight: document.querySelector('.virtual-scroll-container')?.style?.height
      };
    });

    // Scroll more to trigger loading
    await page.evaluate(() => window.scrollTo(0, 8000));
    await page.waitForTimeout(1500); // Wait for potential load

    const afterLoad = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="listing-card"]');
      const first = cards[0];
      return {
        scrollY: window.scrollY,
        firstCardTop: first?.getBoundingClientRect().top,
        cardCount: cards.length,
        containerHeight: document.querySelector('.virtual-scroll-container')?.style?.height
      };
    });

    console.log('  Before: scrollY=%s, container=%s', beforeLoad.scrollY, beforeLoad.containerHeight);
    console.log('  After: scrollY=%s, container=%s', afterLoad.scrollY, afterLoad.containerHeight);

    // Test 5: Frame-by-frame scroll analysis
    console.log('\n=== Test 5: Smooth Scroll Analysis ===');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);

    const smoothScrollData = [];
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.scrollBy(0, 50));

      const frame = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
        const transform = grid?.parentElement?.style?.transform;
        const match = transform?.match(/translateY\((\d+)px\)/);
        return {
          scrollY: window.scrollY,
          offsetY: match ? parseInt(match[1]) : 0,
          transform
        };
      });

      smoothScrollData.push(frame);
      await page.waitForTimeout(16); // ~60fps
    }

    // Analyze for sudden offset changes
    let suddenChanges = 0;
    for (let i = 1; i < smoothScrollData.length; i++) {
      const prev = smoothScrollData[i-1];
      const curr = smoothScrollData[i];
      const offsetDiff = Math.abs(curr.offsetY - prev.offsetY);

      if (offsetDiff > 100) {
        suddenChanges++;
        console.log(`  Sudden offset change at frame ${i}: ${prev.offsetY} -> ${curr.offsetY} (diff: ${offsetDiff})`);
      }
    }
    console.log(`  Sudden offset changes: ${suddenChanges}`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Visual card jumps detected: ${jumpCount}`);
    console.log(`Row boundary crossings (expected): ${suddenChanges}`);
    console.log(`Card height: ${rowHeights.cardHeight?.toFixed(0)}px`);
    console.log(`Row height used: 372px`);

    // The key metric is jumpCount (Test 2), not suddenChanges (Test 5)
    // Offset changes of exactly rowHeight (372px) are EXPECTED when crossing row boundaries
    // What matters is whether these cause VISUAL jumping (detected in Test 2)
    if (jumpCount > 0) {
      console.log('\n❌ VISUAL JUMPING DETECTED');
      console.log('Cards are visually teleporting during scroll.');
      console.log('Likely causes:');
      console.log('  1. offsetY change not synchronized with scroll position');
      console.log('  2. Threshold-based state update causing lag');
      console.log('  3. Container height changing during scroll');
    } else {
      console.log('\n✅ NO VISUAL JUMPING - Virtual scroll working correctly');
      if (suddenChanges > 0) {
        console.log(`   (${suddenChanges} row boundary crossings detected - this is expected behavior)`);
      }
    }

    // Keep browser open for manual inspection
    console.log('\nKeeping browser open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

  } finally {
    await browser.close();
  }
}

test().catch(console.error);
