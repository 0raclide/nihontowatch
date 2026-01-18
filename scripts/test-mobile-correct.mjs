import { chromium } from 'playwright';

async function testMobileInfiniteScroll() {
  console.log('='.repeat(80));
  console.log('MOBILE INFINITE SCROLL PAGINATION TEST');
  console.log('Testing API calls and listing accumulation (not DOM nodes)');
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
          `[API ${apiCalls.length}] ` +
          `Page ${pageNumber} | ` +
          `Items: ${items} | ` +
          `+${call.timeSincePrevious}ms`
        );
      } catch (e) {
        console.error(`[ERROR] Failed to parse API response: ${e.message}`);
      }
    }
  });

  console.log('Navigating to https://nihontowatch.com...');
  await page.goto('https://nihontowatch.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for React to mount
  console.log('Waiting for app to load...');
  await page.waitForTimeout(3000);

  // Helper to count visible cards (in viewport)
  const getVisibleCardCount = async () => {
    return await page.locator('[data-testid="listing-card"]').count();
  };

  // Helper to get the total accumulated listings from React state
  const getTotalAccumulatedListings = async () => {
    return await page.evaluate(() => {
      // Try to find the grid container and count all listing IDs that have been loaded
      // This is a proxy - we're checking the internal state indirectly
      const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
      if (!grid) return 0;

      // Count unique listing IDs in data attributes or similar
      // Note: This is approximate since virtual scroll removes items from DOM
      // The real source of truth is the API call count
      return grid.querySelectorAll('[data-testid="listing-card"]').length;
    });
  };

  const initialVisible = await getVisibleCardCount();
  console.log(`✓ Initial load: ${initialVisible} cards visible in viewport`);
  console.log(`  API calls so far: ${apiCalls.length}`);
  console.log('');

  // Perform scrolls
  const scrollResults = [];

  for (let i = 1; i <= 6; i++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`SCROLL ${i}`);
    console.log(`${'─'.repeat(80)}`);

    const beforeApiCalls = apiCalls.length;
    const beforeVisible = await getVisibleCardCount();

    console.log(`Before: ${beforeVisible} visible cards, ${beforeApiCalls} total API calls`);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for potential API call
    await page.waitForTimeout(3000);

    const afterApiCalls = apiCalls.length;
    const afterVisible = await getVisibleCardCount();
    const newApiCalls = afterApiCalls - beforeApiCalls;

    const result = {
      scrollNumber: i,
      beforeVisible,
      afterVisible,
      beforeApiCalls,
      afterApiCalls,
      newApiCalls
    };

    scrollResults.push(result);

    console.log(`After:  ${afterVisible} visible cards, ${afterApiCalls} total API calls`);
    console.log(`New API calls: ${newApiCalls}`);
    console.log('');

    // If no new API calls, we've likely reached the end
    if (newApiCalls === 0 && i > 2) {
      console.log('No new API calls - likely reached end or throttled');
      break;
    }
  }

  const finalVisible = await getVisibleCardCount();

  // Final Report
  console.log('');
  console.log('='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));
  console.log('');

  console.log('SUMMARY:');
  console.log(`  Total API calls:        ${apiCalls.length}`);
  console.log(`  Initial visible cards:  ${initialVisible}`);
  console.log(`  Final visible cards:    ${finalVisible}`);
  console.log(`  Scrolls performed:      ${scrollResults.length}`);
  console.log('');

  console.log('NOTE: Virtual scrolling removes cards from DOM when scrolled out of view.');
  console.log('The "visible cards" count reflects viewport rendering, not total loaded data.');
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

    // 1. Sequential page numbers (after initial load)
    const pages = apiCalls.map(c => c.page);

    // Skip duplicate Page 1 calls (initial hydration issue)
    const relevantPages = pages.slice(pages.lastIndexOf(1) + 1);
    const expectedSequence = Array.from({ length: relevantPages.length }, (_, i) => i + 2);
    const isSequential = relevantPages.length === 0 ||
      JSON.stringify(relevantPages) === JSON.stringify(expectedSequence);

    console.log(`1. Sequential Loading (after initial load):`);
    console.log(`   All pages: [${pages.join(', ')}]`);
    if (relevantPages.length > 0) {
      console.log(`   Infinite scroll pages: [${relevantPages.join(', ')}]`);
      console.log(`   Expected: [${expectedSequence.join(', ')}]`);
    }
    console.log(`   Result: ${isSequential ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 2. Check for duplicate pages in infinite scroll (ignore initial Page 1 dupes)
    const scrollPages = relevantPages;
    const uniqueScrollPages = new Set(scrollPages);
    const hasScrollDuplicates = uniqueScrollPages.size !== scrollPages.length;

    console.log(`2. No Duplicate Pages (in infinite scroll):`);
    console.log(`   Unique pages: ${uniqueScrollPages.size}`);
    console.log(`   Total calls:  ${scrollPages.length}`);
    console.log(`   Duplicates:   [${scrollPages.filter((p, i, arr) => arr.indexOf(p) !== i).join(', ') || 'none'}]`);
    console.log(`   Result:       ${!hasScrollDuplicates ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 3. Data accumulation - check that we got new pages
    const dataAccumulated = relevantPages.length > 0;

    console.log(`3. Data Accumulates:`);
    console.log(`   Infinite scroll pages loaded: ${relevantPages.length}`);
    console.log(`   Result: ${dataAccumulated ? '✅ PASS' : '⚠️  No additional pages loaded'}`);
    console.log('');

    // 4. Throttling check (between scroll-triggered calls)
    const scrollTimings = [];
    for (let i = 1; i < apiCalls.length; i++) {
      const call = apiCalls[i];
      // Only count calls that are for pages > 1 (scroll-triggered)
      if (call.page > 1 && call.timeSincePrevious > 0) {
        scrollTimings.push(call.timeSincePrevious);
      }
    }

    if (scrollTimings.length > 0) {
      const avg = scrollTimings.reduce((a, b) => a + b, 0) / scrollTimings.length;
      const min = Math.min(...scrollTimings);
      const max = Math.max(...scrollTimings);

      console.log(`4. Throttling (time between scroll-triggered loads):`);
      console.log(`   Average: ${avg.toFixed(0)}ms`);
      console.log(`   Min: ${min}ms`);
      console.log(`   Max: ${max}ms`);
      console.log(`   Result: ${min >= 1000 ? '✅ GOOD (≥1000ms)' : '⚠️  Fast (<1000ms)'}`);
    } else {
      console.log(`4. Throttling:`);
      console.log(`   No scroll-triggered loads detected`);
    }

    console.log('─'.repeat(80));
    console.log('');

    // 5. Expected total items
    const totalItemsFromAPI = apiCalls.reduce((sum, call) => sum + call.items, 0);
    // Subtract duplicates (initial Page 1 calls)
    const duplicatePage1Count = pages.filter(p => p === 1).length - 1;
    const uniqueItemsLoaded = totalItemsFromAPI - (duplicatePage1Count * 30);

    console.log('DATA TOTALS:');
    console.log(`  Total items returned by all API calls: ${totalItemsFromAPI}`);
    console.log(`  Duplicate Page 1 calls: ${duplicatePage1Count}`);
    console.log(`  Unique items loaded: ${uniqueItemsLoaded}`);
    console.log('');
  }

  // Scroll-by-scroll breakdown
  console.log('SCROLL BREAKDOWN:');
  console.log('─'.repeat(80));
  scrollResults.forEach(result => {
    console.log(
      `Scroll ${result.scrollNumber}: ` +
      `${result.newApiCalls} new API call(s) | ` +
      `Visible: ${result.beforeVisible} → ${result.afterVisible}`
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
