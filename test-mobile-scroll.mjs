import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const SCROLL_INCREMENT = 500;
const SCROLL_DELAY = 1500; // Wait 1.5s between scrolls to observe behavior

async function testMobileScroll() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  const screenshotsDir = '/Users/christopherhill/Desktop/Claude_project/nihontowatch/scroll-test-screenshots';

  // Create screenshots directory
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('='.repeat(80));
  console.log('MOBILE SCROLL TEST - nihontowatch.com');
  console.log('='.repeat(80));
  console.log(`Viewport: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`);
  console.log(`Scroll increment: ${SCROLL_INCREMENT}px`);
  console.log('');

  try {
    // Navigate to the site
    console.log('Navigating to https://nihontowatch.com...');
    await page.goto('https://nihontowatch.com', { waitUntil: 'networkidle' });

    // Wait for initial load
    console.log('Waiting for listings to load...');
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: path.join(screenshotsDir, 'scroll-00-initial.png'), fullPage: false });

    // Get initial state
    const initialState = await page.evaluate(() => {
      const listingCards = document.querySelectorAll('[data-testid="listing-card"], .listing-card, [class*="ListingCard"], article');
      const body = document.body;
      const html = document.documentElement;

      return {
        scrollY: window.scrollY,
        documentHeight: Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        ),
        viewportHeight: window.innerHeight,
        listingCount: listingCards.length,
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        bodyClasses: body.className,
        visibleListings: Array.from(listingCards).filter(card => {
          const rect = card.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        }).length
      };
    });

    console.log('INITIAL STATE:');
    console.log(`  Scroll Position: ${initialState.scrollY}px`);
    console.log(`  Document Height: ${initialState.documentHeight}px`);
    console.log(`  Viewport Height: ${initialState.viewportHeight}px`);
    console.log(`  Total Listing Cards in DOM: ${initialState.listingCount}`);
    console.log(`  Visible Listing Cards: ${initialState.visibleListings}`);
    console.log(`  Body Background: ${initialState.backgroundColor}`);
    console.log(`  Body Classes: ${initialState.bodyClasses}`);
    console.log('');

    // Scroll down incrementally
    let scrollPosition = 0;
    let scrollStep = 1;
    const maxScrolls = 20; // Prevent infinite loop

    while (scrollStep <= maxScrolls) {
      scrollPosition += SCROLL_INCREMENT;

      console.log(`SCROLL STEP ${scrollStep} - Scrolling to ${scrollPosition}px...`);

      // Perform scroll
      await page.evaluate((pos) => {
        window.scrollTo({ top: pos, behavior: 'smooth' });
      }, scrollPosition);

      // Wait for scroll to complete and content to load
      await page.waitForTimeout(SCROLL_DELAY);

      // Capture state after scroll
      const state = await page.evaluate(() => {
        const listingCards = document.querySelectorAll('[data-testid="listing-card"], .listing-card, [class*="ListingCard"], article');
        const body = document.body;
        const html = document.documentElement;

        // Check for loading indicators
        const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="skeleton"], [class*="spinner"]');

        // Check for blue backgrounds or anomalies
        const allElements = document.querySelectorAll('*');
        const blueBackgrounds = Array.from(allElements).filter(el => {
          const bg = window.getComputedStyle(el).backgroundColor;
          return bg.includes('rgb') && bg.match(/rgb\(.*,.*,.*\)/) &&
                 bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) &&
                 parseInt(bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)[3]) > 200; // High blue value
        });

        // Get visible area background
        const centerElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        const centerBg = centerElement ? window.getComputedStyle(centerElement).backgroundColor : 'N/A';

        return {
          scrollY: window.scrollY,
          documentHeight: Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          ),
          maxScroll: Math.max(
            body.scrollHeight - window.innerHeight,
            html.scrollHeight - window.innerHeight
          ),
          listingCount: listingCards.length,
          visibleListings: Array.from(listingCards).filter(card => {
            const rect = card.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
          }).length,
          loadingIndicatorCount: loadingIndicators.length,
          blueBackgroundCount: blueBackgrounds.length,
          centerBackgroundColor: centerBg,
          bodyBackgroundColor: window.getComputedStyle(body).backgroundColor,

          // Check for blank areas (large divs with no content)
          blankAreas: Array.from(document.querySelectorAll('div')).filter(div => {
            const rect = div.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            const isLarge = rect.height > 200;
            const hasNoContent = div.children.length === 0 && !div.textContent.trim();
            return isVisible && isLarge && hasNoContent;
          }).length,

          // Get visible listing IDs or titles for debugging
          visibleListingTitles: Array.from(listingCards)
            .filter(card => {
              const rect = card.getBoundingClientRect();
              return rect.top < window.innerHeight && rect.bottom > 0;
            })
            .slice(0, 3)
            .map(card => {
              const title = card.querySelector('h2, h3, [class*="title"]');
              return title ? title.textContent.substring(0, 50) : 'No title';
            })
        };
      });

      console.log(`  Actual Scroll Position: ${state.scrollY}px`);
      console.log(`  Document Height: ${state.documentHeight}px`);
      console.log(`  Max Scroll: ${state.maxScroll}px`);
      console.log(`  Total Listing Cards in DOM: ${state.listingCount}`);
      console.log(`  Visible Listing Cards: ${state.visibleListings}`);
      console.log(`  Loading Indicators: ${state.loadingIndicatorCount}`);
      console.log(`  Blue Background Elements: ${state.blueBackgroundCount}`);
      console.log(`  Blank Areas (>200px): ${state.blankAreas}`);
      console.log(`  Center Background Color: ${state.centerBackgroundColor}`);
      console.log(`  Body Background Color: ${state.bodyBackgroundColor}`);

      if (state.visibleListingTitles && state.visibleListingTitles.length > 0) {
        console.log(`  Sample Visible Listings:`);
        state.visibleListingTitles.forEach((title, i) => {
          console.log(`    ${i + 1}. ${title}`);
        });
      }

      // Take screenshot
      const screenshotName = `scroll-${String(scrollStep).padStart(2, '0')}-pos-${state.scrollY}.png`;
      await page.screenshot({ path: path.join(screenshotsDir, screenshotName), fullPage: false });
      console.log(`  Screenshot: ${screenshotName}`);
      console.log('');

      // Check if we've reached the bottom
      if (state.scrollY >= state.maxScroll - 100) {
        console.log('Reached bottom of page.');
        break;
      }

      // Check if scroll didn't actually move (stuck)
      if (scrollStep > 1 && state.scrollY === state.scrollY) {
        console.log('Scroll position not changing. May have reached end.');
      }

      scrollStep++;
    }

    // Final state
    console.log('='.repeat(80));
    console.log('FINAL STATE:');
    const finalState = await page.evaluate(() => {
      const listingCards = document.querySelectorAll('[data-testid="listing-card"], .listing-card, [class*="ListingCard"], article');
      return {
        scrollY: window.scrollY,
        totalListings: listingCards.length,
        visibleListings: Array.from(listingCards).filter(card => {
          const rect = card.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        }).length
      };
    });
    console.log(`  Final Scroll Position: ${finalState.scrollY}px`);
    console.log(`  Total Listings Loaded: ${finalState.totalListings}`);
    console.log(`  Visible at End: ${finalState.visibleListings}`);
    console.log('='.repeat(80));
    console.log(`\nScreenshots saved to: ${screenshotsDir}`);

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testMobileScroll();
