import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();

  console.log('📱 Mobile viewport: 390x844');
  console.log('🌐 Navigating to https://nihontowatch.com...\n');

  await page.goto('https://nihontowatch.com', { waitUntil: 'networkidle' });

  // Wait for listings to load
  console.log('⏳ Waiting for listings to load...');
  await page.waitForSelector('[data-testid="listing-card"], .listing-card, article', { timeout: 10000 }).catch(() => {
    console.log('⚠️  No listing cards found with test selectors, trying generic selectors...');
  });

  await page.waitForTimeout(2000);

  // Record initial state
  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const initialScrollY = await page.evaluate(() => window.scrollY);

  console.log('📊 Initial State:');
  console.log(`   Document Height: ${initialHeight}px`);
  console.log(`   Viewport Height: ${viewportHeight}px`);
  console.log(`   Initial Scroll Y: ${initialScrollY}px`);
  console.log(`   Pages to scroll: ${(initialHeight / viewportHeight).toFixed(1)}x\n`);

  // Take screenshot before jump
  await page.screenshot({ path: '/Users/christopherhill/Desktop/Claude_project/nihontowatch/scroll-test-before-jump.png', fullPage: false });
  console.log('📸 Screenshot saved: scroll-test-before-jump.png\n');

  // JUMP to bottom
  console.log('🚀 JUMPING directly to bottom of page...');
  await page.evaluate((docHeight) => {
    window.scrollTo({
      top: docHeight,
      behavior: 'auto' // Instant jump, no smooth scroll
    });
  }, initialHeight);

  await page.waitForTimeout(500);

  // Report what we see at the bottom
  const bottomState = await page.evaluate(() => {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = docHeight - viewportHeight;
    const atBottom = scrollY >= maxScroll - 10;

    // Get background color
    const bgColor = window.getComputedStyle(document.body).backgroundColor;

    // Check for visible content
    const visibleElements = [];
    const allElements = document.querySelectorAll('*');

    for (let el of allElements) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < viewportHeight && rect.height > 0 && rect.width > 0) {
        const tag = el.tagName.toLowerCase();
        const classes = el.className ? '.' + Array.from(el.classList).join('.') : '';
        const text = el.innerText ? el.innerText.substring(0, 50) : '';
        visibleElements.push({
          tag: tag + classes,
          text: text,
          rect: { top: rect.top, height: rect.height }
        });
      }
    }

    // Check for load more triggers
    const loadMoreButtons = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(el => {
      const text = el.innerText.toLowerCase();
      return text.includes('load') || text.includes('more') || text.includes('next');
    });

    // Check for empty space
    const bodyHeight = document.body.scrollHeight;
    const htmlHeight = document.documentElement.scrollHeight;

    return {
      scrollY,
      docHeight,
      viewportHeight,
      maxScroll,
      atBottom,
      bgColor,
      visibleElementCount: visibleElements.length,
      visibleElements: visibleElements.slice(0, 10), // First 10 for brevity
      loadMoreButtons: loadMoreButtons.map(btn => ({
        text: btn.innerText.substring(0, 30),
        tag: btn.tagName,
        visible: btn.getBoundingClientRect().top < viewportHeight
      })),
      bodyHeight,
      htmlHeight
    };
  });

  console.log('📍 AT BOTTOM (immediately after jump):');
  console.log(`   Scroll Position: ${bottomState.scrollY}px`);
  console.log(`   Max Scroll: ${bottomState.maxScroll}px`);
  console.log(`   At Bottom: ${bottomState.atBottom ? '✅ YES' : '❌ NO'}`);
  console.log(`   Background Color: ${bottomState.bgColor}`);
  console.log(`   Visible Elements: ${bottomState.visibleElementCount}`);
  console.log(`   Load More Buttons: ${bottomState.loadMoreButtons.length}`);

  if (bottomState.loadMoreButtons.length > 0) {
    console.log('\n   Load More Buttons Found:');
    bottomState.loadMoreButtons.forEach((btn, i) => {
      console.log(`     ${i + 1}. [${btn.tag}] "${btn.text}" (visible: ${btn.visible})`);
    });
  }

  console.log('\n   Visible Content:');
  bottomState.visibleElements.slice(0, 5).forEach((el, i) => {
    console.log(`     ${i + 1}. <${el.tag}> top:${el.rect.top}px h:${el.rect.height}px - "${el.text}"`);
  });

  await page.screenshot({ path: '/Users/christopherhill/Desktop/Claude_project/nihontowatch/scroll-test-at-bottom.png', fullPage: false });
  console.log('\n📸 Screenshot saved: scroll-test-at-bottom.png');

  // Wait 3 seconds and check for changes
  console.log('\n⏱️  Waiting 3 seconds to see if anything changes...');
  await page.waitForTimeout(3000);

  const afterWaitState = await page.evaluate(() => {
    return {
      scrollY: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
      visibleElementCount: Array.from(document.querySelectorAll('*')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.top < window.innerHeight && rect.height > 0;
      }).length
    };
  });

  console.log('\n📍 AFTER 3 SECONDS:');
  console.log(`   Scroll Position: ${afterWaitState.scrollY}px (changed: ${afterWaitState.scrollY !== bottomState.scrollY})`);
  console.log(`   Document Height: ${afterWaitState.docHeight}px (changed: ${afterWaitState.docHeight !== bottomState.docHeight})`);
  console.log(`   Visible Elements: ${afterWaitState.visibleElementCount} (was: ${bottomState.visibleElementCount})`);

  if (afterWaitState.docHeight !== bottomState.docHeight) {
    console.log(`   ⚠️  PAGE HEIGHT CHANGED by ${afterWaitState.docHeight - bottomState.docHeight}px!`);
  }

  await page.screenshot({ path: '/Users/christopherhill/Desktop/Claude_project/nihontowatch/scroll-test-after-wait.png', fullPage: false });
  console.log('📸 Screenshot saved: scroll-test-after-wait.png');

  // Scroll back up slowly
  console.log('\n⬆️  Scrolling back up slowly...');
  const scrollUpSteps = 10;
  const scrollUpDelay = 300;

  for (let i = 1; i <= scrollUpSteps; i++) {
    const targetScroll = afterWaitState.scrollY * (1 - i / scrollUpSteps);
    await page.evaluate((target) => {
      window.scrollTo({
        top: target,
        behavior: 'smooth'
      });
    }, targetScroll);

    await page.waitForTimeout(scrollUpDelay);

    const currentState = await page.evaluate(() => {
      const scrollY = window.scrollY;
      const visibleListings = Array.from(document.querySelectorAll('[data-testid="listing-card"], .listing-card, article')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }).length;

      return { scrollY, visibleListings };
    });

    if (i === 3 || i === 6 || i === 9) {
      console.log(`   Step ${i}/${scrollUpSteps}: ${Math.round(currentState.scrollY)}px - Visible listings: ${currentState.visibleListings}`);
    }
  }

  await page.screenshot({ path: '/Users/christopherhill/Desktop/Claude_project/nihontowatch/scroll-test-scrolled-up.png', fullPage: false });
  console.log('\n📸 Screenshot saved: scroll-test-scrolled-up.png');

  // Final report
  const finalState = await page.evaluate(() => {
    return {
      scrollY: window.scrollY,
      visibleListings: Array.from(document.querySelectorAll('[data-testid="listing-card"], .listing-card, article')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }).length
    };
  });

  console.log('\n📊 FINAL STATE (after scrolling up):');
  console.log(`   Scroll Position: ${Math.round(finalState.scrollY)}px`);
  console.log(`   Visible Listings: ${finalState.visibleListings}`);

  console.log('\n✅ Test complete! Check screenshots for visual confirmation.');
  console.log('   - scroll-test-before-jump.png (initial state)');
  console.log('   - scroll-test-at-bottom.png (immediately after jump)');
  console.log('   - scroll-test-after-wait.png (after 3 second wait)');
  console.log('   - scroll-test-scrolled-up.png (after scrolling back up)');

  await page.waitForTimeout(2000);
  await browser.close();
})();
