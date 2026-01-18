import { chromium } from 'playwright';

async function testMobileScroll() {
  console.log('Starting mobile scroll test...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  const apiCalls = [];
  let startTime = Date.now();

  // Track API calls
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/browse')) {
      try {
        const urlObj = new URL(url);
        const pageParam = urlObj.searchParams.get('page');
        const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;

        const json = await response.json();
        const items = json.listings?.length || 0;
        const timestamp = Date.now();

        apiCalls.push({
          page: pageNumber,
          items,
          timestamp,
          timeSinceStart: timestamp - startTime,
          url: url.substring(0, 100)
        });

        console.log(`[API CALL] Page ${pageNumber} | Items: ${items} | Time: ${timestamp - startTime}ms`);
      } catch (e) {
        console.error('Failed to parse response:', e.message);
      }
    }
  });

  console.log('Navigating to https://nihontowatch.com...');
  await page.goto('https://nihontowatch.com', { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting for cards to load...');
  await page.waitForSelector('[data-testid="listing-card"], .listing-card, article', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const getCardCount = async () => {
    return await page.locator('[data-testid="listing-card"], .listing-card, article').count();
  };

  const initialCards = await getCardCount();
  console.log(`\n✓ Initial cards loaded: ${initialCards}\n`);

  // Perform scrolls
  for (let i = 1; i <= 5; i++) {
    const beforeCards = await getCardCount();
    console.log(`\n--- SCROLL ${i} ---`);
    console.log(`Cards before scroll: ${beforeCards}`);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    console.log('Scrolled to bottom, waiting...');

    await page.waitForTimeout(3000);

    const afterCards = await getCardCount();
    console.log(`Cards after scroll: ${afterCards} (added: ${afterCards - beforeCards})`);
  }

  const finalCards = await getCardCount();

  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));

  console.log(`\nCard Counts:`);
  console.log(`  Initial: ${initialCards}`);
  console.log(`  Final:   ${finalCards}`);
  console.log(`  Added:   ${finalCards - initialCards}`);

  console.log(`\nAPI Calls: ${apiCalls.length}`);

  if (apiCalls.length > 0) {
    console.log('\nAPI Call Details:');
    console.log('─'.repeat(80));
    apiCalls.forEach((call, idx) => {
      const timeDiff = idx > 0 ? call.timestamp - apiCalls[idx - 1].timestamp : 0;
      console.log(
        `  ${idx + 1}. Page ${call.page} | ` +
        `Items: ${call.items.toString().padStart(3)} | ` +
        `Time since previous: ${timeDiff.toString().padStart(5)}ms | ` +
        `Total time: ${call.timeSinceStart}ms`
      );
    });
    console.log('─'.repeat(80));

    // Analysis
    const pages = apiCalls.map(c => c.page);
    const uniquePages = new Set(pages);
    const isSequential = pages.every((p, i) => i === 0 || p === pages[i - 1] + 1);
    const hasDuplicates = uniquePages.size !== pages.length;

    console.log('\nValidation:');
    console.log(`  Pages requested: [${pages.join(', ')}]`);
    console.log(`  Sequential: ${isSequential ? '✅ YES' : '❌ NO'}`);
    console.log(`  Duplicates: ${hasDuplicates ? '❌ YES (FAIL)' : '✅ NO (PASS)'}`);
    console.log(`  Cards accumulating: ${finalCards > initialCards ? '✅ YES' : '❌ NO'}`);

    // Timing analysis
    const timings = apiCalls.slice(1).map((call, idx) => call.timestamp - apiCalls[idx].timestamp);
    if (timings.length > 0) {
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      console.log('\nTiming Analysis:');
      console.log(`  Average time between calls: ${avg.toFixed(0)}ms`);
      console.log(`  Min: ${min}ms`);
      console.log(`  Max: ${max}ms`);
      console.log(`  Throttling: ${min > 500 ? '✅ Good' : '⚠️  Very fast'}`);
    }

    // Expected vs actual items
    const totalItemsReturned = apiCalls.reduce((sum, call) => sum + call.items, 0);
    const expectedCards = initialCards + totalItemsReturned - apiCalls[0].items; // Subtract first call (initial load)
    console.log('\nItem Reconciliation:');
    console.log(`  Total items returned by API: ${totalItemsReturned}`);
    console.log(`  Expected cards: ${expectedCards}`);
    console.log(`  Actual cards: ${finalCards}`);
    console.log(`  Match: ${Math.abs(expectedCards - finalCards) < 5 ? '✅ YES' : '⚠️  Discrepancy'}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await browser.close();
}

testMobileScroll().catch(console.error);
