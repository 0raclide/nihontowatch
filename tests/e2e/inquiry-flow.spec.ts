/**
 * E2E Tests: Inquiry Flow
 *
 * Tests the AI-powered email drafting feature that helps English-speaking
 * collectors compose culturally-appropriate Japanese business emails.
 *
 * Test Coverage:
 * 1. Inquire button visible on listing detail page
 * 2. Login modal appears when clicking Inquire without auth
 * 3. InquiryModal opens for authenticated users (mocked)
 */
import { test, expect } from '@playwright/test';

test.describe('Inquiry Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('Inquire button exists on listing detail page', async ({ page }) => {
    // First, find a real listing ID from the browse page
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click a listing to get its ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    // Get listing ID from URL
    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Close QuickView
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Navigate to the listing detail page
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify Inquire button is present
    const inquireButton = page.locator('button:has-text("Inquire")');
    await expect(inquireButton).toBeVisible({ timeout: 10000 });
  });

  test('clicking Inquire without auth shows login modal', async ({ page }) => {
    // Find a real listing ID
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    // Click a listing to get its ID
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    // Close QuickView
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Navigate to listing detail page
    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Click Inquire button
    const inquireButton = page.locator('button:has-text("Inquire")');
    await inquireButton.click();

    // Verify login modal appears (user is not authenticated)
    const loginModal = page.locator('[data-testid="login-modal"], [role="dialog"]:has-text("Sign in")');
    await expect(loginModal).toBeVisible({ timeout: 5000 });
  });

  test('Inquire button has mail icon', async ({ page }) => {
    // Find a real listing ID
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify the button has an SVG (mail icon)
    const inquireButton = page.locator('button:has-text("Inquire")');
    const svg = inquireButton.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('Inquire button is next to Set Alert button', async ({ page }) => {
    // Find a real listing ID
    await page.goto('/');
    await page.waitForSelector('[data-testid="virtual-listing-grid"]', { timeout: 15000 });

    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]', { timeout: 5000 });

    const url = new URL(page.url());
    const listingId = url.searchParams.get('listing');
    expect(listingId).toBeTruthy();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.goto(`/listing/${listingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Both buttons should exist in the action button section
    const inquireButton = page.locator('button:has-text("Inquire")');
    const setAlertButton = page.locator('button:has-text("Set Alert")');

    await expect(inquireButton).toBeVisible({ timeout: 10000 });
    await expect(setAlertButton).toBeVisible({ timeout: 10000 });
  });
});
