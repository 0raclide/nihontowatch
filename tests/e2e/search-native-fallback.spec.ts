import { test, expect } from '@playwright/test';

/**
 * Test form is server-rendered and works before JS hydrates
 */

test.describe('Server-Rendered Form', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('form should be in initial server HTML', async ({ page }) => {
    // Intercept the initial HTML response
    let initialHtml = '';
    await page.route('**/*', async route => {
      if (route.request().url().includes('localhost:3000') &&
          route.request().resourceType() === 'document') {
        const response = await route.fetch();
        initialHtml = await response.text();
        route.fulfill({ response });
      } else {
        route.continue();
      }
    });

    await page.goto('/');

    // Check if form is in initial HTML
    const hasForm = initialHtml.includes('role="search"');
    const hasInput = initialHtml.includes('name="q"');
    const hasAction = initialHtml.includes('action="/"');

    console.log('Form[role=search] in initial HTML:', hasForm);
    console.log('Input[name=q] in initial HTML:', hasInput);
    console.log('Form action="/" in initial HTML:', hasAction);

    // Form MUST be server-rendered for native fallback
    expect(hasForm).toBe(true);
    expect(hasInput).toBe(true);
  });
});
