import { test, expect } from '@playwright/test';

/**
 * Detailed debug test for search form submission
 */

test.describe('Search Debug', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('detailed debug of form submission', async ({ page }) => {
    const logs: string[] = [];
    const errors: string[] = [];

    // Capture console messages
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', err => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('Page loaded');

    // Check if header is visible
    const header = page.locator('header');
    const headerVisible = await header.isVisible();
    console.log('Header visible:', headerVisible);

    // Check if form is visible
    const form = page.locator('header form[role="search"]');
    const formVisible = await form.isVisible();
    console.log('Form visible:', formVisible);

    // Check if input is visible and enabled
    const input = page.locator('header form[role="search"] input[type="search"]');
    const inputVisible = await input.isVisible();
    const inputDisabled = await input.isDisabled();
    console.log('Input visible:', inputVisible);
    console.log('Input disabled:', inputDisabled);

    // Get current value
    const currentValue = await input.inputValue();
    console.log('Current input value:', JSON.stringify(currentValue));

    // Try to interact
    await input.click();
    console.log('Clicked input');

    await input.fill('testquery');
    console.log('Filled input');

    const filledValue = await input.inputValue();
    console.log('Filled input value:', JSON.stringify(filledValue));

    // Add event listener to detect form submission
    await page.evaluate(() => {
      const form = document.querySelector('header form[role="search"]');
      if (form) {
        form.addEventListener('submit', (e) => {
          console.log('FORM SUBMIT EVENT FIRED');
        }, { capture: true });
      }
    });

    // Store current URL
    const urlBefore = page.url();
    console.log('URL before submit:', urlBefore);

    // Press Enter
    console.log('About to press Enter...');
    await input.press('Enter');
    console.log('Pressed Enter');

    // Wait a bit
    await page.waitForTimeout(2000);

    // Check URL after
    const urlAfter = page.url();
    console.log('URL after submit:', urlAfter);

    // Check if URL changed
    const urlChanged = urlBefore !== urlAfter;
    console.log('URL changed:', urlChanged);

    // Print any errors
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(e => console.log(e));
    }

    // Print relevant logs
    const relevantLogs = logs.filter(l =>
      l.includes('search') ||
      l.includes('form') ||
      l.includes('submit') ||
      l.includes('error') ||
      l.includes('Error')
    );
    if (relevantLogs.length > 0) {
      console.log('\n=== RELEVANT LOGS ===');
      relevantLogs.forEach(l => console.log(l));
    }

    // The test should pass if URL contains query
    expect(urlAfter).toContain('q=testquery');
  });
});
