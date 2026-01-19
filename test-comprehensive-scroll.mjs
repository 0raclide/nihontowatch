import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: false }); // Visible for debugging
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Capture all network requests for API calls
  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('/api/browse')) {
      apiCalls.push({ url: req.url(), time: Date.now() });
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/browse')) {
      try {
        const json = await res.json();
        console.log(`API Response: page=${json.page}, totalPages=${json.totalPages}, listings=${json.listings?.length}`);
      } catch (e) {}
    }
  });

  try {
    console.log('=== Comprehensive Infinite Scroll Test ===\n');
    await page.goto('http://localhost:3000/', { timeout: 30000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 20000 });
    await page.waitForTimeout(1500);

    // Get initial state
    const initial = await page.evaluate(() => {
      const showingMatch = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
      const cards = document.querySelectorAll('[data-testid="listing-card"]');
      const virtualContainer = document.querySelector('.virtual-scroll-container');

      return {
        showing: showingMatch ? parseInt(showingMatch[1]) : 0,
        total: showingMatch ? showingMatch[2] : 'unknown',
        cardCount: cards.length,
        containerHeight: virtualContainer?.style?.height,
        documentHeight: document.documentElement.scrollHeight,
        firstCardIds: Array.from(cards).slice(0, 5).map(c => c.getAttribute('data-listing-id')),
      };
    });

    console.log('Initial State:');
    console.log(`  Showing: ${initial.showing} of ${initial.total}`);
    console.log(`  Cards rendered: ${initial.cardCount}`);
    console.log(`  Container height: ${initial.containerHeight}`);
    console.log(`  Document height: ${initial.documentHeight}`);
    console.log(`  First card IDs: ${initial.firstCardIds.join(', ')}`);

    // Track all seen card IDs and their scroll positions
    const seenAtPosition = new Map(); // id -> first scroll position seen
    const duplicatesFound = [];

    console.log('\n=== Scrolling Test ===\n');

    // Scroll in increments and track what we see
    for (let targetScroll = 0; targetScroll < 50000; targetScroll += 1000) {
      await page.evaluate((y) => window.scrollTo(0, y), targetScroll);
      await page.waitForTimeout(400); // Give time for loading and rendering

      const state = await page.evaluate(() => {
        const showingMatch = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
        const cards = document.querySelectorAll('[data-testid="listing-card"]');
        const cardData = Array.from(cards).map(c => ({
          id: c.getAttribute('data-listing-id'),
          rect: c.getBoundingClientRect(),
        }));

        // Get visible cards (in viewport)
        const visibleCards = cardData.filter(c =>
          c.rect.top < window.innerHeight && c.rect.bottom > 0
        );

        const virtualContainer = document.querySelector('.virtual-scroll-container');

        return {
          showing: showingMatch ? parseInt(showingMatch[1]) : 0,
          scrollY: window.scrollY,
          actualScrollY: window.pageYOffset,
          maxScroll: document.documentElement.scrollHeight - window.innerHeight,
          containerHeight: virtualContainer?.style?.height,
          documentHeight: document.documentElement.scrollHeight,
          allCardIds: cardData.map(c => c.id),
          visibleCardIds: visibleCards.map(c => c.id),
          cardCount: cards.length,
        };
      });

      // Check for duplicates in current view
      const currentViewIds = new Set();
      for (const id of state.visibleCardIds) {
        if (currentViewIds.has(id)) {
          duplicatesFound.push({ scrollY: state.scrollY, id, type: 'duplicate-in-view' });
        }
        currentViewIds.add(id);
      }

      // Track when we first saw each card
      for (const id of state.allCardIds) {
        if (!seenAtPosition.has(id)) {
          seenAtPosition.set(id, state.scrollY);
        }
      }

      // Log every 5000px or on significant events
      if (targetScroll % 5000 === 0 || state.showing > initial.showing) {
        console.log(`ScrollY=${state.scrollY.toFixed(0)} (target=${targetScroll}):`);
        console.log(`  Showing: ${state.showing}, Cards: ${state.cardCount}`);
        console.log(`  Container: ${state.containerHeight}, Doc: ${state.documentHeight}`);
        console.log(`  Visible IDs: ${state.visibleCardIds.slice(0, 4).join(', ')}...`);
        console.log(`  Unique items seen so far: ${seenAtPosition.size}`);

        if (state.scrollY >= state.maxScroll - 100) {
          console.log(`  ** AT BOTTOM OF SCROLLABLE AREA **`);
        }
      }

      // Stop if we've loaded enough or can't scroll further
      if (state.scrollY >= state.maxScroll - 50) {
        console.log(`\nReached max scroll at ${state.scrollY}. Waiting for more content...`);
        await page.waitForTimeout(2000);

        const newState = await page.evaluate(() => ({
          showing: parseInt(document.body.innerText.match(/Showing (\d+)/)?.[1] || '0'),
          maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        }));

        if (newState.maxScroll <= state.maxScroll + 100) {
          console.log(`No new content loaded. Breaking.`);
          break;
        }
      }

      // Safety: stop after loading 1000 items
      if (state.showing >= 1000) {
        console.log('Loaded 1000+ items, stopping test.');
        break;
      }
    }

    // Final analysis
    console.log('\n=== Final Analysis ===\n');

    const final = await page.evaluate(() => {
      const showingMatch = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
      return {
        showing: showingMatch ? parseInt(showingMatch[1]) : 0,
        total: showingMatch ? showingMatch[2] : 'unknown',
      };
    });

    console.log(`Total items loaded: ${final.showing} of ${final.total}`);
    console.log(`Unique items seen during scroll: ${seenAtPosition.size}`);
    console.log(`API calls made: ${apiCalls.length}`);

    if (duplicatesFound.length > 0) {
      console.log(`\n*** DUPLICATES FOUND: ${duplicatesFound.length} ***`);
      duplicatesFound.slice(0, 10).forEach(d => {
        console.log(`  At scrollY=${d.scrollY}: ID ${d.id} (${d.type})`);
      });
    } else {
      console.log('\nNo duplicates found in viewport during scroll.');
    }

    // Check if items are repeating by looking at ratio
    const repeatRatio = seenAtPosition.size / final.showing;
    console.log(`\nUnique/Loaded ratio: ${repeatRatio.toFixed(2)}`);
    if (repeatRatio < 0.9) {
      console.log('*** WARNING: Significant item repetition detected! ***');
    }

    await page.waitForTimeout(3000); // Keep browser open briefly

  } finally {
    await browser.close();
  }
}

test().catch(console.error);
