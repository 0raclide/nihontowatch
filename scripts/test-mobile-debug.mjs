import { chromium } from 'playwright';

async function debugMobileScroll() {
  console.log('Starting mobile scroll debug test...\n');

  const browser = await chromium.launch({ headless: false });
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
          timeSinceStart: timestamp - startTime
        });

        console.log(`[API] Page ${pageNumber} | Items: ${items} | ${timestamp - startTime}ms`);
      } catch (e) {
        // Ignore
      }
    }
  });

  console.log('Navigating to https://nihontowatch.com...');
  await page.goto('https://nihontowatch.com', { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForTimeout(3000);

  // Try different selectors
  console.log('\nTrying different selectors:');

  const selectors = [
    'article',
    '[data-testid="listing-card"]',
    '.listing-card',
    '[class*="card"]',
    '[class*="Card"]',
    'a[href*="/listing/"]'
  ];

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    console.log(`  ${selector}: ${count} elements`);
  }

  // Get the HTML structure
  console.log('\nPage structure:');
  const mainContent = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 'No main element found';

    const children = Array.from(main.children).map(child => {
      return {
        tag: child.tagName,
        classes: child.className,
        children: child.children.length,
        id: child.id
      };
    });

    return JSON.stringify(children, null, 2);
  });

  console.log(mainContent);

  // Check for listing grid/container
  const gridInfo = await page.evaluate(() => {
    const selectors = [
      '[class*="grid"]',
      '[class*="Grid"]',
      '[class*="listing"]',
      '[class*="Listing"]',
      '[class*="browse"]',
      '[class*="Browse"]'
    ];

    const results = {};
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        results[sel] = {
          children: el.children.length,
          classes: el.className,
          childTags: Array.from(el.children).map(c => c.tagName).slice(0, 5)
        };
      }
    });

    return results;
  });

  console.log('\nGrid/Container info:');
  console.log(JSON.stringify(gridInfo, null, 2));

  await page.waitForTimeout(5000);
  await browser.close();
}

debugMobileScroll().catch(console.error);
