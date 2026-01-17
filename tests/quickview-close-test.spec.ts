/**
 * Test: Verify QuickView modal opens, closes on backdrop click, and stays closed
 */
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('QuickView modal opens and closes on backdrop click', async ({ page }) => {
  // Navigate to browse page
  await page.goto('http://localhost:3000/browse');

  // Wait for listings to load
  const listingCards = page.locator('[role="button"]');
  await listingCards.first().waitFor({ timeout: 15000 });

  console.log('Found listing cards');

  // Click first listing card to open modal
  await listingCards.first().click();
  console.log('Clicked first card');

  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  console.log('✓ Modal opened');

  // Wait for animation
  await page.waitForTimeout(350);

  // Verify modal is open
  const modalBefore = await page.locator('[role="dialog"]').count();
  expect(modalBefore).toBe(1);
  console.log(`Modal count before close: ${modalBefore}`);

  // Get viewport size and click on backdrop (left side of screen)
  const viewport = page.viewportSize();
  const clickX = 20;
  const clickY = viewport ? viewport.height / 2 : 400;
  console.log(`Clicking backdrop at (${clickX}, ${clickY})`);

  await page.mouse.click(clickX, clickY);
  console.log('✓ Clicked backdrop');

  // Wait for close animation (250ms) plus buffer
  await page.waitForTimeout(400);

  // Check if modal is closed
  const modalAfterClick = await page.locator('[role="dialog"]').count();
  console.log(`Modal count after backdrop click: ${modalAfterClick}`);

  // Wait a bit more to catch any re-opening
  await page.waitForTimeout(500);

  const modalFinal = await page.locator('[role="dialog"]').count();
  console.log(`Modal count final (after 500ms wait): ${modalFinal}`);

  // Modal should be closed
  expect(modalFinal).toBe(0);
  console.log('✓ Modal stayed closed - SUCCESS!');
});

test('QuickView modal closes on X button click', async ({ page }) => {
  // Navigate to browse page
  await page.goto('http://localhost:3000/browse');

  // Wait for listings to load
  const listingCards = page.locator('[role="button"]');
  await listingCards.first().waitFor({ timeout: 15000 });

  // Click first listing card to open modal
  await listingCards.first().click();

  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  console.log('✓ Modal opened');

  await page.waitForTimeout(350);

  // Click the close button
  const closeButton = page.locator('[aria-label="Close quick view"], [aria-label="Close"]').first();
  await closeButton.click();
  console.log('✓ Clicked close button');

  // Wait for close animation
  await page.waitForTimeout(400);

  // Modal should be closed
  const modalCount = await page.locator('[role="dialog"]').count();
  expect(modalCount).toBe(0);
  console.log('✓ Modal closed via X button');
});
