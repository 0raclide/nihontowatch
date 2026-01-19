import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto('http://localhost:3000/', { timeout: 30000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 20000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
      const container = grid?.parentElement?.parentElement;
      const cards = document.querySelectorAll('[data-testid="listing-card"]');

      return {
        containerHeight: container?.style?.height,
        documentHeight: document.documentElement.scrollHeight,
        totalCards: cards.length,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight
      };
    });

    console.log('Page info:');
    console.log('  Container height:', info.containerHeight);
    console.log('  Document height:', info.documentHeight);
    console.log('  Max scrollable:', info.maxScroll);
    console.log('  Total cards loaded:', info.totalCards);

    // Scroll to max and check
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);

    const atBottom = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="listing-card"]');
      return {
        scrollY: window.scrollY,
        cardIds: Array.from(cards).slice(0, 5).map(c => c.getAttribute('data-listing-id')),
        totalCards: cards.length
      };
    });

    console.log('\nAt max scroll:');
    console.log('  scrollY:', atBottom.scrollY);
    console.log('  cards:', atBottom.totalCards);
    console.log('  first IDs:', atBottom.cardIds.join(', '));

    // Now scroll past the "end" to see what happens
    for (let extra = 0; extra < 5000; extra += 1000) {
      await page.evaluate((y) => window.scrollTo(0, y), atBottom.scrollY + extra);
      await page.waitForTimeout(100);

      const state = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="listing-card"]');
        return {
          scrollY: window.scrollY,
          firstIds: Array.from(cards).slice(0, 3).map(c => c.getAttribute('data-listing-id'))
        };
      });

      console.log('  +' + extra + ': scrollY=' + state.scrollY + ', first IDs: ' + state.firstIds.join(', '));
    }

  } finally {
    await browser.close();
  }
}
test();
