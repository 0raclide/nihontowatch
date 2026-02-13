import type { Page } from '@playwright/test';

/**
 * Dismiss the cookie consent banner if visible.
 * Should be called in beforeEach for tests that interact with bottom-of-page
 * elements or that use [role="dialog"] selectors.
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const acceptButton = page.locator('button', { hasText: 'Accept' });
  const isVisible = await acceptButton.isVisible({ timeout: 3000 }).catch(() => false);
  if (isVisible) {
    await acceptButton.click();
    // Wait for banner slide-out animation (300ms transition)
    await acceptButton.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}
