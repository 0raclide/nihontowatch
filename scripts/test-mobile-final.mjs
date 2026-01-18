import { chromium } from 'playwright';

async function testMobileInfiniteScroll() {
  console.log('='.repeat(80));
  console.log('MOBILE INFINITE SCROLL PAGINATION TEST');
  console.log('='.repeat(80));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  const apiCalls = [];
  const startTime = Date.now();

  // Track ALL API calls
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/browse')) {
      try {
        const urlObj = new URL(url);
        const pageParam = urlObj.searchParams.get('page');
        const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
        const perPage = urlObj.searchParams.get('perPage') || '30';

        const json = await response.json();
        const items = json.listings?.length || 0;
        const timestamp = Date.now();

        const call = {
          page: pageNumber,
          items,
          timestamp,
          timeSinceStart: timestamp - startTime,
          timeSincePrevious: apiCalls.length > 0 ? timestamp - apiCalls[apiCalls.length - 1].timestamp : 0,
          perPage: parseInt(perPage)
        };

        apiCalls.push(call);

        console.log(
          `[API CALL ${apiCalls.length}] ` +
          `Page ${pageNumber} | ` +
          `Items: ${items} | ` +
          `+${call.timeSincePrevious}ms | ` +
          `Total: ${call.timeSinceStart}ms`
        );
      } catch (e) {
        console.error(`[ERROR] Failed to parse API response: ${e.message}`);
      }
    }
  });

  console.log('Navigating to https://nihontowatch.com...');
  await page.goto('https://nihontowatch.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for the grid to appear
  console.log('Waiting for listing grid...');
  await page.waitForSelector('[class*="grid"]', { timeout: 10000 });
  await page.waitForTimeout(2000); // Let initial load settle

  // Helper to count cards
  const getCardCount = async () => {
    return await page.locator('[data-testid="listing-card"]').count();
  };

  // Helper to get grid children count
  const getGridChildCount = async () => {
    return await page.evaluate(() => {
      const grid = document.querySelector('[class*="grid"]');
      return grid ? grid.children.length : 0;
    });
  };

  const initialCards = await getCardCount();
  const initialGridChildren = await getGridChildCount();

  console.log(`✓ Initial load complete`);
  console.log(`  Cards (data-testid): ${initialCards}`);
  console.log(`  Grid children: ${initialGridChildren}`);
  console.log(`  API calls so far: ${apiCalls.length}`);
  console.log('');

  // Perform scrolls
  const scrollResults = [];

  for (let i = 1; i <= 5; i++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`SCROLL ${i}`);
    console.log(`${'─'.repeat(80)}`);

    const beforeCards = await getCardCount();
    const beforeGrid = await getGridChildCount();
    const beforeApiCalls = apiCalls.length;

    console.log(`Before: ${beforeCards} cards, ${beforeGrid} grid children`);

    // Get scroll position before
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const scrollAfter = await page.evaluate(() => window.scrollY);
    console.log(`Scrolled from ${scrollBefore}px to ${scrollAfter}px`);

    // Wait for potential API call and DOM update
    await page.waitForTimeout(3000);

    const afterCards = await getCardCount();
    const afterGrid = await getGridChildCount();
    const afterApiCalls = apiCalls.length;

    const result = {
      scrollNumber: i,
      beforeCards,
      afterCards,
      cardsAdded: afterCards - beforeCards,
      beforeGrid,
      afterGrid,
      gridAdded: afterGrid - beforeGrid,
      newApiCalls: afterApiCalls - beforeApiCalls,
      scrollDistance: scrollAfter - scrollBefore
    };

    scrollResults.push(result);

    console.log(`After:  ${afterCards} cards, ${afterGrid} grid children`);
    console.log(`Change: ${result.cardsAdded > 0 ? '+' : ''}${result.cardsAdded} cards, ${result.gridAdded > 0 ? '+' : ''}${result.gridAdded} grid children`);
    console.log(`New API calls: ${result.newApiCalls}`);
    console.log('');
  }

  const finalCards = await getCardCount();
  const finalGrid = await getGridChildCount();

  // Final Report
  console.log('');
  console.log('='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));
  console.log('');

  console.log('CARD COUNTS:');
  console.log(`  Initial cards:     ${initialCards}`);
  console.log(`  Final cards:       ${finalCards}`);
  console.log(`  Cards added:       ${finalCards - initialCards > 0 ? '+' : ''}${finalCards - initialCards}`);
  console.log(`  Initial grid:      ${initialGridChildren}`);
  console.log(`  Final grid:        ${finalGrid}`);
  console.log(`  Grid items added:  ${finalGrid - initialGridChildren > 0 ? '+' : ''}${finalGrid - initialGridChildren}`);
  console.log('');

  console.log(`TOTAL API CALLS: ${apiCalls.length}`);
  console.log('');

  if (apiCalls.length > 0) {
    console.log('API CALL DETAILS:');
    console.log('─'.repeat(80));
    console.log('Call | Page | Items | Time Since Previous | Total Time');
    console.log('─'.repeat(80));

    apiCalls.forEach((call, idx) => {
      console.log(
        `${(idx + 1).toString().padStart(4)} | ` +
        `${call.page.toString().padStart(4)} | ` +
        `${call.items.toString().padStart(5)} | ` +
        `${call.timeSincePrevious.toString().padStart(19)}ms | ` +
        `${call.timeSinceStart.toString().padStart(10)}ms`
      );
    });
    console.log('─'.repeat(80));
    console.log('');

    // VALIDATION
    console.log('VALIDATION:');
    console.log('─'.repeat(80));

    // 1. Sequential page numbers
    const pages = apiCalls.map(c => c.page);
    const expectedSequence = Array.from({ length: pages.length }, (_, i) => i + 1);
    const isSequential = JSON.stringify(pages) === JSON.stringify(expectedSequence);

    console.log(`1. Sequential Loading:`);
    console.log(`   Expected: [${expectedSequence.join(', ')}]`);
    console.log(`   Actual:   [${pages.join(', ')}]`);
    console.log(`   Result:   ${isSequential ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 2. No duplicate pages
    const uniquePages = new Set(pages);
    const hasDuplicates = uniquePages.size !== pages.length;

    console.log(`2. No Duplicate Pages:`);
    console.log(`   Unique pages: ${uniquePages.size}`);
    console.log(`   Total calls:  ${pages.length}`);
    console.log(`   Duplicates:   [${pages.filter((p, i, arr) => arr.indexOf(p) !== i).join(', ') || 'none'}]`);
    console.log(`   Result:       ${!hasDuplicates ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 3. Items accumulate properly
    const totalItemsReturned = apiCalls.reduce((sum, call) => sum + call.items, 0);
    const itemsAccumulating = finalCards > initialCards;

    console.log(`3. Items Accumulate:`);
    console.log(`   Total items from API: ${totalItemsReturned}`);
    console.log(`   Cards accumulated:    ${finalCards - initialCards}`);
    console.log(`   Result:               ${itemsAccumulating ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 4. Throttling check
    const timings = apiCalls.slice(1).map((call, idx) => call.timestamp - apiCalls[idx].timestamp);

    if (timings.length > 0) {
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      console.log(`4. Throttling:`);
      console.log(`   Average time between calls: ${avg.toFixed(0)}ms`);
      console.log(`   Min time: ${min}ms`);
      console.log(`   Max time: ${max}ms`);
      console.log(`   Result:   ${min > 500 ? '✅ GOOD (>500ms)' : '⚠️  FAST (<500ms)'}`);
    }

    console.log('─'.repeat(80));
    console.log('');
  }

  // Scroll-by-scroll breakdown
  console.log('SCROLL BREAKDOWN:');
  console.log('─'.repeat(80));
  scrollResults.forEach(result => {
    console.log(
      `Scroll ${result.scrollNumber}: ` +
      `${result.cardsAdded > 0 ? '+' : ''}${result.cardsAdded} cards | ` +
      `${result.newApiCalls} API call(s) | ` +
      `${result.scrollDistance}px scrolled`
    );
  });
  console.log('─'.repeat(80));
  console.log('');

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));

  await browser.close();
}

testMobileInfiniteScroll().catch(console.error);
