import { chromium } from 'playwright';

async function testMobileInfiniteScrollDeep() {
  console.log('='.repeat(80));
  console.log('DEEP MOBILE INFINITE SCROLL TEST');
  console.log('='.repeat(80));
  console.log('');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  const apiCalls = [];
  const startTime = Date.now();

  // Track ALL API calls with full details
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/browse')) {
      try {
        const urlObj = new URL(url);
        const pageParam = urlObj.searchParams.get('page');
        const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;

        const json = await response.json();
        const items = json.listings?.length || 0;
        const total = json.total || 0;
        const totalPages = json.totalPages || 0;
        const timestamp = Date.now();

        const call = {
          page: pageNumber,
          items,
          total,
          totalPages,
          timestamp,
          timeSinceStart: timestamp - startTime,
          timeSincePrevious: apiCalls.length > 0 ? timestamp - apiCalls[apiCalls.length - 1].timestamp : 0,
        };

        apiCalls.push(call);

        console.log(
          `[API ${apiCalls.length}] Page ${pageNumber}/${totalPages} | ` +
          `Items: ${items} | Total: ${total} | +${call.timeSincePrevious}ms`
        );
      } catch (e) {
        console.error(`[ERROR] Failed to parse API response: ${e.message}`);
      }
    }
  });

  console.log('Navigating...');
  await page.goto('https://nihontowatch.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Helper functions
  const getCardCount = async () => {
    return await page.locator('[data-testid="listing-card"]').count();
  };

  const getScrollPosition = async () => {
    return await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.body.scrollHeight,
      innerHeight: window.innerHeight,
      percentScrolled: ((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100).toFixed(1)
    }));
  };

  const checkLoadMoreTrigger = async () => {
    return await page.evaluate(() => {
      const trigger = document.querySelector('.load-more-placeholder');
      if (!trigger) return { exists: false };

      const rect = trigger.getBoundingClientRect();
      const visible = rect.top < window.innerHeight && rect.bottom > 0;

      return {
        exists: true,
        visible,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight
      };
    });
  };

  console.log(`Initial: ${await getCardCount()} cards`);
  console.log('');

  // Perform gradual scrolls
  for (let i = 1; i <= 8; i++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`SCROLL ${i}`);
    console.log(`${'─'.repeat(80)}`);

    const beforeCards = await getCardCount();
    const beforePos = await getScrollPosition();
    const beforeApiCalls = apiCalls.length;

    console.log(`Before: ${beforeCards} cards | ${beforePos.percentScrolled}% scrolled`);

    // Check load-more trigger
    const triggerBefore = await checkLoadMoreTrigger();
    console.log(`Load-more trigger: ${triggerBefore.exists ? 'exists' : 'not found'}`);
    if (triggerBefore.exists) {
      console.log(`  Visible: ${triggerBefore.visible}, Top: ${triggerBefore.top.toFixed(0)}px`);
    }

    // Scroll incrementally (not all the way to bottom at once)
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
    });

    console.log('Waiting...');
    await page.waitForTimeout(4000); // Longer wait to ensure API call completes

    const afterCards = await getCardCount();
    const afterPos = await getScrollPosition();
    const afterApiCalls = apiCalls.length;

    console.log(`After:  ${afterCards} cards | ${afterPos.percentScrolled}% scrolled`);
    console.log(`Change: ${afterCards - beforeCards > 0 ? '+' : ''}${afterCards - beforeCards} cards | ${afterApiCalls - beforeApiCalls} API calls`);

    // Check trigger after
    const triggerAfter = await checkLoadMoreTrigger();
    if (triggerAfter.exists) {
      console.log(`Load-more trigger after: Visible: ${triggerAfter.visible}, Top: ${triggerAfter.top.toFixed(0)}px`);
    }

    console.log('');

    // If we're at >90% scrolled and no new data, something's wrong
    if (parseFloat(afterPos.percentScrolled) > 90 && afterApiCalls === beforeApiCalls && i > 2) {
      console.log('⚠️  No new API calls despite being >90% scrolled');
      break;
    }

    // If we have no visible cards, check if that's expected
    if (afterCards === 0) {
      console.log('⚠️  Zero visible cards - investigating...');

      const debugInfo = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
        return {
          gridExists: !!grid,
          gridChildren: grid ? grid.children.length : 0,
          bodyHeight: document.body.scrollHeight,
          scrollY: window.scrollY,
          innerHeight: window.innerHeight
        };
      });

      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

      // Break if multiple scrolls with zero cards
      if (i > 2) {
        console.log('Breaking due to zero visible cards');
        break;
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('FINAL REPORT');
  console.log('='.repeat(80));
  console.log('');

  const finalCards = await getCardCount();
  const finalPos = await getScrollPosition();

  console.log('FINAL STATE:');
  console.log(`  Visible cards: ${finalCards}`);
  console.log(`  Scroll position: ${finalPos.percentScrolled}% (${finalPos.scrollY}px)`);
  console.log(`  Total API calls: ${apiCalls.length}`);
  console.log('');

  console.log('API CALLS:');
  apiCalls.forEach((call, idx) => {
    console.log(
      `  ${idx + 1}. Page ${call.page}/${call.totalPages} | ` +
      `${call.items} items | +${call.timeSincePrevious}ms`
    );
  });

  console.log('');
  console.log('Press Enter to close browser...');

  await new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('', () => {
      readline.close();
      resolve();
    });
  });

  await browser.close();
}

testMobileInfiniteScrollDeep().catch(console.error);
