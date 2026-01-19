import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    console.log('Testing for repeating items...\n');
    await page.goto('http://localhost:3000/', { timeout: 30000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 20000 });
    await page.waitForTimeout(500);

    const seenIds = new Set();
    let repeatFound = false;

    for (let scrollY = 0; scrollY < 15000; scrollY += 500) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(150);

      const visibleIds = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="listing-card"]');
        return Array.from(cards).map(c => c.getAttribute('data-listing-id'));
      });

      // Check for duplicates within current view
      const currentSet = new Set();
      for (const id of visibleIds) {
        if (currentSet.has(id)) {
          console.log('DUPLICATE IN VIEW at scrollY=' + scrollY + ': ' + id);
          repeatFound = true;
        }
        currentSet.add(id);
      }

      // Track all seen IDs
      for (const id of visibleIds) {
        seenIds.add(id);
      }

      if (scrollY % 2000 === 0) {
        console.log('scrollY=' + scrollY + ': ' + visibleIds.length + ' cards, total unique seen: ' + seenIds.size);
        console.log('  First few IDs: ' + visibleIds.slice(0, 5).join(', '));
      }
    }

    console.log('\nFinal: ' + seenIds.size + ' unique items seen');
    console.log(repeatFound ? '❌ DUPLICATES FOUND!' : '✅ No duplicates in view');

  } finally {
    await browser.close();
  }
}
test();
