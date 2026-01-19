import { test, expect } from '@playwright/test';

/**
 * Test search form against production
 */

test.describe('Production Search Test', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    baseURL: 'https://nihontowatch.com',
  });

  test('form submission works on production', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', err => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`CONSOLE ERROR: ${msg.text()}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('Production page loaded');

    // Check form
    const form = page.locator('header form[role="search"]');
    const formVisible = await form.isVisible({ timeout: 10000 });
    console.log('Form visible:', formVisible);

    if (!formVisible) {
      // Take screenshot
      await page.screenshot({ path: 'tests/screenshots/prod-no-form.png' });
      console.log('Form not visible! Screenshot saved.');
    }

    const input = page.locator('header form[role="search"] input[type="search"]');
    const inputVisible = await input.isVisible({ timeout: 5000 });
    console.log('Input visible:', inputVisible);

    if (inputVisible) {
      await input.click();
      await input.fill('prodtest');

      const urlBefore = page.url();
      console.log('URL before:', urlBefore);

      await input.press('Enter');
      console.log('Pressed Enter');

      // Wait for navigation
      try {
        await page.waitForURL('**/?q=prodtest*', { timeout: 10000 });
        console.log('Navigation successful!');
      } catch (e) {
        console.log('Navigation timeout! Current URL:', page.url());
        await page.screenshot({ path: 'tests/screenshots/prod-nav-failed.png' });
      }

      const urlAfter = page.url();
      console.log('URL after:', urlAfter);

      if (errors.length > 0) {
        console.log('\n=== ERRORS ===');
        errors.forEach(e => console.log(e));
      }

      expect(urlAfter).toContain('q=prodtest');
    }
  });
});
