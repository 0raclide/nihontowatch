#!/usr/bin/env node
/**
 * Quick script to test infinite scroll behavior against production
 */

import { chromium } from 'playwright';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function testScrollBehavior() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();

  const observations = [];
  let apiCallCount = 0;

  // Track API calls
  page.on('request', (request) => {
    if (request.url().includes('/api/browse')) {
      apiCallCount++;
      const url = new URL(request.url());
      const pageNum = url.searchParams.get('page') || '1';
      observations.push(`[API] Call #${apiCallCount} - page=${pageNum}`);
    }
  });

  try {
    console.log('Navigating to https://nihontowatch.com...');
    await page.goto('https://nihontowatch.com', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for listings
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 15000 });
    const initialCards = await page.locator('[data-testid="listing-card"]').count();
    console.log(`Initial cards: ${initialCards}`);
    console.log(`Initial API calls: ${apiCallCount}`);

    // Get scroll metrics
    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    console.log(`Document height: ${metrics.scrollHeight}px, Viewport: ${metrics.viewportHeight}px`);

    // Scroll to bottom
    console.log('\n--- Scrolling to bottom ---');
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    // Record API count at this moment
    const apiCountAtBottom = apiCallCount;
    console.log(`API calls when reaching bottom: ${apiCountAtBottom}`);

    // Wait and observe for 5 seconds
    console.log('\n--- Waiting at bottom for 5 seconds ---');
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const cards = await page.locator('[data-testid="listing-card"]').count();
      const loadingVisible = await page.locator('text="Loading more..."').isVisible().catch(() => false);
      console.log(`[${i}s] Cards: ${cards}, Loading visible: ${loadingVisible}, Total API calls: ${apiCallCount}`);
    }

    const apiCallsWhileWaiting = apiCallCount - apiCountAtBottom;
    console.log(`\n--- Results ---`);
    console.log(`API calls made while sitting at bottom: ${apiCallsWhileWaiting}`);

    if (apiCallsWhileWaiting > 2) {
      console.log('❌ PROBLEM: Continuous loading detected!');
    } else {
      console.log('✅ OK: Loading behavior is controlled');
    }

    // Check final state
    const finalCards = await page.locator('[data-testid="listing-card"]').count();
    const hasEndMessage = await page.locator('text=/seen all/i').isVisible().catch(() => false);
    console.log(`Final cards: ${finalCards}`);
    console.log(`"End of list" message visible: ${hasEndMessage}`);

    console.log('\n--- All API calls ---');
    observations.forEach(o => console.log(o));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testScrollBehavior();
