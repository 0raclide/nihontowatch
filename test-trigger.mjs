import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto('http://localhost:3000/', { timeout: 30000 });
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 20000 });
    await page.waitForTimeout(500);

    // Check the load more area
    const loadMoreInfo = await page.evaluate(() => {
      const placeholder = document.querySelector('.load-more-placeholder');
      if (!placeholder) return { hasPlaceholder: false };

      const children = placeholder.children;
      const html = placeholder.innerHTML;
      const hasSpinner = html.includes('animate-spin');
      const hasTrigger = html.includes('h-4 w-full');
      const hasEndMessage = html.includes("You've seen all");

      return {
        hasPlaceholder: true,
        html: html.substring(0, 200),
        childCount: children.length,
        hasSpinner,
        hasTrigger,
        hasEndMessage
      };
    });

    console.log('Load more area:');
    console.log('  hasPlaceholder:', loadMoreInfo.hasPlaceholder);
    console.log('  hasTrigger (h-4 div):', loadMoreInfo.hasTrigger);
    console.log('  hasSpinner:', loadMoreInfo.hasSpinner);
    console.log('  hasEndMessage:', loadMoreInfo.hasEndMessage);
    console.log('  HTML preview:', loadMoreInfo.html);

    // Check page and totalPages
    const pageInfo = await page.evaluate(() => {
      // Try to find debug info or the showing text
      const showing = document.body.innerText.match(/Showing (\d+) of ([\d,]+) items/);
      return {
        showing: showing ? showing[1] : null,
        total: showing ? showing[2] : null
      };
    });

    console.log('\nPage info:');
    console.log('  Showing:', pageInfo.showing);
    console.log('  Total:', pageInfo.total);

  } finally {
    await browser.close();
  }
}
test();
