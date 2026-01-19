import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('load') || text.includes('fetch') || text.includes('items')) {
      console.log('PAGE:', text);
    }
  });

  try {
    await page.goto('http://localhost:3000/', { timeout: 30000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 20000 });
    await page.waitForTimeout(500);

    // Check initial state
    const initial = await page.evaluate(() => {
      // Find the "Showing X of Y items" text
      const showingText = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
      return {
        showing: showingText ? showingText[1] : 'unknown',
        total: showingText ? showingText[2] : 'unknown',
        cardCount: document.querySelectorAll('[data-testid="listing-card"]').length
      };
    });

    console.log('Initial state:');
    console.log('  Showing:', initial.showing, 'of', initial.total, 'items');
    console.log('  Rendered cards:', initial.cardCount);

    // Scroll down slowly to trigger infinite scroll
    console.log('\nScrolling to trigger infinite load...');

    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(200);

      const state = await page.evaluate(() => {
        const showingText = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
        const loadMore = document.querySelector('[data-testid="load-more-trigger"]');
        const loading = document.querySelector('[data-testid="loading-indicator"]');

        return {
          showing: showingText ? showingText[1] : 'unknown',
          scrollY: window.scrollY,
          hasLoadMore: !!loadMore,
          isLoading: !!loading,
          cardCount: document.querySelectorAll('[data-testid="listing-card"]').length
        };
      });

      if (i % 5 === 0) {
        console.log('  Step ' + i + ': scrollY=' + state.scrollY +
          ', showing=' + state.showing +
          ', cards=' + state.cardCount +
          ', hasLoadMore=' + state.hasLoadMore);
      }
    }

    // Final state
    const final = await page.evaluate(() => {
      const showingText = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
      return {
        showing: showingText ? showingText[1] : 'unknown',
        total: showingText ? showingText[2] : 'unknown',
        cardCount: document.querySelectorAll('[data-testid="listing-card"]').length,
        scrollY: window.scrollY
      };
    });

    console.log('\nFinal state:');
    console.log('  Showing:', final.showing, 'of', final.total, 'items');
    console.log('  Rendered cards:', final.cardCount);
    console.log('  ScrollY:', final.scrollY);

  } finally {
    await browser.close();
  }
}
test();
