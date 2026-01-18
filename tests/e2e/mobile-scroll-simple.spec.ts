import { test } from '@playwright/test';

test('Mobile infinite scroll analysis', async ({ page }) => {
  // Set mobile viewport (iPhone 14 Pro)
  await page.setViewportSize({ width: 390, height: 844 });

  const apiCalls: Array<{
    page: number;
    items: number;
    timestamp: number;
    url: string;
  }> = [];

  // Intercept API calls
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/browse')) {
      try {
        const urlObj = new URL(url);
        const pageParam = urlObj.searchParams.get('page');
        const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;

        const json = await response.json();
        const items = json.listings?.length || 0;

        apiCalls.push({
          page: pageNumber,
          items,
          timestamp: Date.now(),
          url
        });

        console.log(`API: Page ${pageNumber}, Items: ${items}`);
      } catch (e) {
        // Ignore parsing errors
      }
    }
  });

  console.log('\n=== Starting Mobile Scroll Test ===\n');

  // Navigate
  await page.goto('https://nihontowatch.com');
  await page.waitForLoadState('networkidle');

  // Wait for initial cards
  await page.waitForSelector('[data-testid="listing-card"], .listing-card, article', {
    timeout: 10000
  });

  await page.waitForTimeout(2000);

  const getCardCount = async () => {
    return await page.locator('[data-testid="listing-card"], .listing-card, article').count();
  };

  const initialCards = await getCardCount();
  console.log(`Initial cards: ${initialCards}`);

  // Scroll multiple times
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Scroll ${i} ---`);
    const beforeCards = await getCardCount();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    const afterCards = await getCardCount();
    console.log(`Before: ${beforeCards}, After: ${afterCards}, New: ${afterCards - beforeCards}`);
  }

  const finalCards = await getCardCount();

  console.log('\n=== RESULTS ===\n');
  console.log(`Total API calls: ${apiCalls.length}`);
  console.log(`Initial cards: ${initialCards}`);
  console.log(`Final cards: ${finalCards}`);
  console.log(`Cards added: ${finalCards - initialCards}`);

  console.log('\nAPI Call Details:');
  apiCalls.forEach((call, idx) => {
    const timeDiff = idx > 0 ? call.timestamp - apiCalls[idx - 1].timestamp : 0;
    console.log(
      `${idx + 1}. Page ${call.page} | Items: ${call.items} | ` +
      `Time since previous: ${timeDiff}ms`
    );
  });

  // Check sequence
  const pages = apiCalls.map(c => c.page);
  const isSequential = pages.every((p, i) => i === 0 || p === pages[i - 1] + 1);
  const hasDuplicates = new Set(pages).size !== pages.length;

  console.log('\nValidation:');
  console.log(`Sequential: ${isSequential ? 'YES' : 'NO'} - Pages: [${pages.join(', ')}]`);
  console.log(`Duplicates: ${hasDuplicates ? 'YES - FAIL' : 'NO - PASS'}`);
  console.log(`Cards accumulating: ${finalCards > initialCards ? 'YES' : 'NO'}`);
});
