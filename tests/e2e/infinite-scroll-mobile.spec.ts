import { test, expect } from '@playwright/test';

interface PageLoadMetrics {
  pageNumber: number;
  itemsReturned: number;
  totalCards: number;
  timestamp: number;
  timeSincePrevious: number;
  url: string;
  statusCode: number;
}

test.describe('Mobile Infinite Scroll Pagination', () => {
  test('should load pages sequentially without duplicates', async ({ page }) => {
    // Set mobile viewport (iPhone 14 Pro)
    await page.setViewportSize({ width: 390, height: 844 });

    const apiCalls: PageLoadMetrics[] = [];
    const pageLoadTimestamps: number[] = [];
    let initialCardCount = 0;

    // Track all API calls to /api/browse
    await page.route('**/api/browse*', async (route) => {
      const url = route.request().url();
      const urlObj = new URL(url);
      const pageParam = urlObj.searchParams.get('page');
      const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;

      console.log(`[API CALL] Page ${pageNumber} - ${url}`);

      const timestamp = Date.now();
      const timeSincePrevious = pageLoadTimestamps.length > 0
        ? timestamp - pageLoadTimestamps[pageLoadTimestamps.length - 1]
        : 0;

      pageLoadTimestamps.push(timestamp);

      // Continue the request
      const response = await route.fetch();
      const statusCode = response.status();

      // Parse response to count items
      let itemsReturned = 0;
      try {
        const body = await response.json();
        if (body.listings && Array.isArray(body.listings)) {
          itemsReturned = body.listings.length;
        }
      } catch (e) {
        console.error('Failed to parse API response:', e);
      }

      apiCalls.push({
        pageNumber,
        itemsReturned,
        totalCards: 0, // Will be updated after DOM settles
        timestamp,
        timeSincePrevious,
        url,
        statusCode
      });

      console.log(`[API RESPONSE] Page ${pageNumber} - Status: ${statusCode}, Items: ${itemsReturned}, Time since previous: ${timeSincePrevious}ms`);

      await route.fulfill({ response });
    });

    // Navigate to the site
    console.log('\n=== NAVIGATING TO SITE ===');
    await page.goto('https://nihontowatch.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for initial load
    await page.waitForSelector('[data-testid="listing-card"], .listing-card, article', {
      timeout: 10000
    });

    // Count initial cards
    await page.waitForTimeout(1000); // Let DOM settle
    initialCardCount = await page.locator('[data-testid="listing-card"], .listing-card, article').count();
    console.log(`[INITIAL LOAD] ${initialCardCount} cards loaded`);

    if (apiCalls.length > 0) {
      apiCalls[0].totalCards = initialCardCount;
    }

    // Helper function to count current cards
    const countCards = async () => {
      return await page.locator('[data-testid="listing-card"], .listing-card, article').count();
    };

    // Helper function to scroll and wait for new content
    const scrollAndWait = async (scrollNumber: number) => {
      const beforeCount = await countCards();
      console.log(`\n=== SCROLL ${scrollNumber} ===`);
      console.log(`[BEFORE SCROLL] Cards: ${beforeCount}`);

      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for API call or timeout
      try {
        await page.waitForResponse(
          response => response.url().includes('/api/browse'),
          { timeout: 3000 }
        );
        console.log('[SCROLL] API call detected');
      } catch (e) {
        console.log('[SCROLL] No API call within 3s');
      }

      // Wait for DOM to update
      await page.waitForTimeout(2000);

      const afterCount = await countCards();
      console.log(`[AFTER SCROLL] Cards: ${afterCount}, New cards: ${afterCount - beforeCount}`);

      // Update totalCards for the most recent API call
      if (apiCalls.length > 0) {
        apiCalls[apiCalls.length - 1].totalCards = afterCount;
      }

      return { beforeCount, afterCount, newCards: afterCount - beforeCount };
    };

    // Perform multiple scrolls
    const scrollAttempts = 5;
    for (let i = 1; i <= scrollAttempts; i++) {
      await scrollAndWait(i);

      // Add delay between scrolls to simulate realistic user behavior
      await page.waitForTimeout(1000);
    }

    // Final verification
    const finalCardCount = await countCards();

    // Analysis and reporting
    console.log('\n=== PAGINATION ANALYSIS ===\n');

    console.log('API Call Summary:');
    console.log('─'.repeat(100));
    apiCalls.forEach((call, index) => {
      console.log(
        `Call ${index + 1}: Page ${call.pageNumber} | ` +
        `Status: ${call.statusCode} | ` +
        `Items Returned: ${call.itemsReturned} | ` +
        `Total Cards: ${call.totalCards} | ` +
        `Time Since Previous: ${call.timeSincePrevious}ms`
      );
    });
    console.log('─'.repeat(100));

    // Check for sequential page numbers
    const pageNumbers = apiCalls.map(call => call.pageNumber);
    const expectedSequence = Array.from({ length: pageNumbers.length }, (_, i) => i + 1);
    const isSequential = JSON.stringify(pageNumbers) === JSON.stringify(expectedSequence);

    console.log('\nSequential Loading Check:');
    console.log(`Expected: [${expectedSequence.join(', ')}]`);
    console.log(`Actual:   [${pageNumbers.join(', ')}]`);
    console.log(`Result:   ${isSequential ? '✅ PASS' : '❌ FAIL'}`);

    // Check for duplicate page calls
    const uniquePages = new Set(pageNumbers);
    const hasDuplicates = uniquePages.size !== pageNumbers.length;
    console.log('\nDuplicate Check:');
    console.log(`Unique pages: ${uniquePages.size}`);
    console.log(`Total calls:  ${pageNumbers.length}`);
    console.log(`Result:       ${!hasDuplicates ? '✅ PASS - No duplicates' : '❌ FAIL - Duplicates found'}`);

    // Check item accumulation
    console.log('\nItem Accumulation:');
    let accumulationValid = true;
    apiCalls.forEach((call, index) => {
      if (index > 0) {
        const previous = apiCalls[index - 1];
        const expectedMin = previous.totalCards;
        const expectedMax = previous.totalCards + call.itemsReturned;
        const actualChange = call.totalCards - previous.totalCards;
        const isValid = actualChange >= 0 && actualChange <= call.itemsReturned;

        console.log(
          `Page ${call.pageNumber}: Previous: ${previous.totalCards}, ` +
          `Added: ${actualChange}, Expected: ${call.itemsReturned}, ` +
          `${isValid ? '✅' : '❌'}`
        );

        if (!isValid) accumulationValid = false;
      }
    });
    console.log(`Overall: ${accumulationValid ? '✅ PASS' : '❌ FAIL'}`);

    // Check throttling
    console.log('\nThrottling Analysis:');
    const timings = apiCalls
      .filter(call => call.timeSincePrevious > 0)
      .map(call => call.timeSincePrevious);

    if (timings.length > 0) {
      const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
      const minTime = Math.min(...timings);
      const maxTime = Math.max(...timings);

      console.log(`Average time between loads: ${avgTime.toFixed(0)}ms`);
      console.log(`Min time: ${minTime}ms`);
      console.log(`Max time: ${maxTime}ms`);
      console.log(`Proper throttling: ${minTime > 500 ? '✅ PASS' : '⚠️  WARNING - Very fast'}`);
    }

    // Overall summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Initial cards: ${initialCardCount}`);
    console.log(`Final cards: ${finalCardCount}`);
    console.log(`Total new cards loaded: ${finalCardCount - initialCardCount}`);
    console.log(`Scroll attempts: ${scrollAttempts}`);

    // Assertions
    expect(isSequential, 'Pages should load sequentially').toBe(true);
    expect(hasDuplicates, 'Should not have duplicate page calls').toBe(false);
    expect(finalCardCount, 'Should accumulate cards').toBeGreaterThan(initialCardCount);
    expect(apiCalls.length, 'Should have made API calls').toBeGreaterThan(0);

    // All API calls should return 200
    const allSuccessful = apiCalls.every(call => call.statusCode === 200);
    expect(allSuccessful, 'All API calls should return 200').toBe(true);
  });
});
