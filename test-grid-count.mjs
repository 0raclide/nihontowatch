#!/usr/bin/env node

// Test script to check how many items are rendered in the grid
// Uses Puppeteer since Playwright's web server conflicts with running dev server
// Run with: node test-grid-count.mjs

import puppeteer from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testGridRendering() {
  console.log(`\nTesting grid rendering at: ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Track API response
    let apiListingsCount = 0;
    page.on('response', async (response) => {
      if (response.url().includes('/api/browse')) {
        try {
          const data = await response.json();
          apiListingsCount = data.listings?.length || 0;
          console.log(`API Response: ${apiListingsCount} listings`);
        } catch (e) {}
      }
    });

    console.log('Loading page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for grid to render
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 10000 });

    // Wait a bit more for React to finish rendering
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Count items in the grid
    const gridInfo = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="virtual-listing-grid"]');
      if (!grid) return { error: 'Grid not found' };

      const children = grid.children.length;

      // Check for "Showing X of Y" text
      const showingText = document.querySelector('.text-sm.text-muted')?.textContent || '';

      // Check if virtualized
      const virtualContainer = document.querySelector('.virtual-scroll-container');

      return {
        gridChildren: children,
        showingText,
        isVirtualized: !!virtualContainer,
        gridClassName: grid.className,
      };
    });

    console.log('\n=== Grid Rendering Results ===');
    console.log(`  API returned: ${apiListingsCount} items`);
    console.log(`  Grid children: ${gridInfo.gridChildren}`);
    console.log(`  Showing text: ${gridInfo.showingText}`);
    console.log(`  Is virtualized: ${gridInfo.isVirtualized}`);
    console.log('');

    // Take screenshot
    await page.screenshot({ path: 'test-grid-screenshot.png', fullPage: true });
    console.log('Screenshot saved: test-grid-screenshot.png');

    if (gridInfo.gridChildren === apiListingsCount && apiListingsCount === 100) {
      console.log('\n✅ SUCCESS: Grid renders all 100 items');
    } else if (gridInfo.gridChildren < apiListingsCount) {
      console.log(`\n❌ FAIL: Grid only renders ${gridInfo.gridChildren} of ${apiListingsCount} items`);
      console.log('   → Issue is in the frontend rendering, not the API');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testGridRendering();
