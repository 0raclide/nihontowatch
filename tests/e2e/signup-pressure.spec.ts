import { test, expect, Page } from '@playwright/test';

/**
 * Signup Pressure System E2E Tests
 *
 * Tests the signup modal trigger logic, dismissal, cooldown, and UI behavior.
 * The system works as follows:
 * - After viewing 5 items in QuickView AND spending 3 minutes on site, a signup modal appears
 * - Modal can be dismissed by clicking backdrop, "Continue browsing", or pressing Escape
 * - Dismissing starts a 48hr cooldown (stored in localStorage)
 * - State is persisted in localStorage under key 'nihontowatch_signup_pressure'
 */

// Constants matching src/lib/signup/config.ts
const STORAGE_KEY = 'nihontowatch_signup_pressure';
const QUICK_VIEW_THRESHOLD = 5;
const TIME_THRESHOLD_SECONDS = 180; // 3 minutes

// Helper to clear signup pressure state
async function clearSignupPressureState(page: Page) {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, STORAGE_KEY);
}

// Helper to set signup pressure state
async function setSignupPressureState(
  page: Page,
  state: {
    quickViewCount?: number;
    sessionStartTime?: number;
    lastDismissedAt?: number | null;
    dismissCount?: number;
    hasSignedUp?: boolean;
    localFavorites?: string[];
    sessionId?: string;
  }
) {
  const defaultState = {
    quickViewCount: 0,
    sessionStartTime: Date.now(),
    lastDismissedAt: null,
    dismissCount: 0,
    hasSignedUp: false,
    localFavorites: [],
    sessionId: `test-${Date.now()}`,
  };

  await page.evaluate(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state: { ...defaultState, ...state } }
  );
}

// Helper to get signup pressure state
async function getSignupPressureState(page: Page) {
  return page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }, STORAGE_KEY);
}

// Helper to open quick views by clicking listing cards
async function openQuickViews(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    // Wait for listing cards to be visible
    const cards = page.locator('[data-testid="listing-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Click on different cards if possible, cycling through available ones
    const cardCount = await cards.count();
    const cardIndex = i % cardCount;
    await cards.nth(cardIndex).click();

    // Wait for QuickView to open
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 5000,
    });

    // Close the QuickView
    await page.keyboard.press('Escape');

    // Wait for modal to close
    await page.waitForTimeout(350); // Animation time
  }
}

test.describe('Signup Pressure System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to browse page which has listings
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Clear any existing signup pressure state
    await clearSignupPressureState(page);

    // Reload to ensure clean state
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Threshold Logic', () => {
    test('modal does NOT appear before thresholds are met', async ({ page }) => {
      // Set state with only 3 quick views and only 1 minute elapsed
      const oneMinuteAgo = Date.now() - 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: 3,
        sessionStartTime: oneMinuteAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Modal should not be visible
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal does NOT appear with only quick views threshold met (no time threshold)', async ({
      page,
    }) => {
      // Set state with 5 quick views but only 1 minute elapsed
      const oneMinuteAgo = Date.now() - 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: oneMinuteAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Modal should not be visible (requireBoth: true)
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal does NOT appear with only time threshold met (no quick views)', async ({
      page,
    }) => {
      // Set state with 0 quick views but 4 minutes elapsed
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: 0,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Modal should not be visible (requireBoth: true)
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal appears after opening 5 quick views + 3 min elapsed (using page.clock)', async ({
      page,
    }) => {
      // Install fake timers
      await page.clock.install({ time: new Date('2024-01-15T10:00:00') });

      // Set initial state with session start at current time
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD - 1, // One less than threshold
        sessionStartTime: new Date('2024-01-15T10:00:00').getTime(),
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Fast forward time by 3 minutes
      await page.clock.fastForward(TIME_THRESHOLD_SECONDS * 1000);

      // Open one more quick view to meet the threshold
      const cards = page.locator('[data-testid="listing-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
      await cards.first().click();

      // Wait for QuickView to open
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({
        timeout: 5000,
      });

      // Close the QuickView
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // Wait for signup modal to appear (after QuickView closes)
      await page.waitForTimeout(500);

      // Signup modal should now be visible
      const signupModal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(signupModal).toBeVisible({ timeout: 5000 });
    });

    test('modal appears when both thresholds are pre-met and page loads', async ({
      page,
    }) => {
      // Set state with both thresholds already met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Modal should appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Modal Dismissal', () => {
    test.beforeEach(async ({ page }) => {
      // Set state with both thresholds met to trigger modal
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('modal can be dismissed by clicking backdrop', async ({ page }) => {
      // Click on the backdrop (the semi-transparent overlay)
      const backdrop = page.locator('[aria-hidden="true"].bg-black\\/50');
      await backdrop.click({ position: { x: 10, y: 10 } });

      // Wait for animation
      await page.waitForTimeout(300);

      // Modal should be hidden
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal can be dismissed by clicking "Continue browsing"', async ({
      page,
    }) => {
      // Find and click the dismiss button
      const dismissButton = page.getByRole('button', {
        name: /continue browsing/i,
      });
      await expect(dismissButton).toBeVisible();
      await dismissButton.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Modal should be hidden
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal can be dismissed by pressing Escape', async ({ page }) => {
      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for animation
      await page.waitForTimeout(300);

      // Modal should be hidden
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal can be dismissed by clicking close button', async ({ page }) => {
      // Find and click the close button (X button)
      const closeButton = page.getByRole('button', { name: /close/i });
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Modal should be hidden
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Modal Content', () => {
    test.beforeEach(async ({ page }) => {
      // Set state with both thresholds met to trigger modal
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('modal has correct copy ("Track what matters." headline)', async ({
      page,
    }) => {
      // Check headline
      const headline = page.getByRole('heading', { name: 'Track what matters.' });
      await expect(headline).toBeVisible();
    });

    test('modal has email input field', async ({ page }) => {
      const emailInput = page.locator('input#signup-email');
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(emailInput).toHaveAttribute('placeholder', 'email@example.com');
    });

    test('modal has Google OAuth button', async ({ page }) => {
      const googleButton = page.getByRole('button', {
        name: /continue with google/i,
      });
      await expect(googleButton).toBeVisible();
    });

    test('modal has Apple OAuth button', async ({ page }) => {
      const appleButton = page.getByRole('button', {
        name: /continue with apple/i,
      });
      await expect(appleButton).toBeVisible();
    });

    test('modal has "Continue browsing" dismiss link', async ({ page }) => {
      const dismissButton = page.getByRole('button', {
        name: /continue browsing/i,
      });
      await expect(dismissButton).toBeVisible();
    });

    test('modal has social proof text', async ({ page }) => {
      const socialProof = page.getByText('Aggregating 27 dealers worldwide');
      await expect(socialProof).toBeVisible();
    });

    test('email input works and enables submit button', async ({ page }) => {
      const emailInput = page.locator('input#signup-email');
      const submitButton = page.getByRole('button', { name: 'Create Account' });

      // Button should be disabled initially
      await expect(submitButton).toBeDisabled();

      // Enter email
      await emailInput.fill('test@example.com');

      // Button should be enabled
      await expect(submitButton).toBeEnabled();

      // Clear email
      await emailInput.clear();

      // Button should be disabled again
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe('Cooldown Logic', () => {
    test('after dismissal, modal does not reappear immediately (cooldown)', async ({
      page,
    }) => {
      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Dismiss the modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await expect(modal).not.toBeVisible();

      // Check that dismissCount was incremented
      const state = await getSignupPressureState(page);
      expect(state.dismissCount).toBe(1);
      expect(state.lastDismissedAt).toBeTruthy();

      // Reload the page - modal should not appear due to cooldown
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Modal should not be visible
      await expect(modal).not.toBeVisible();
    });

    test('modal does not appear if max dismissals exceeded', async ({ page }) => {
      // Set state with max dismissals already reached (3)
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
        dismissCount: 3,
        lastDismissedAt: null, // No cooldown active
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Modal should not appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Set state with both thresholds met to trigger modal
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('dialog has aria-modal attribute', async ({ page }) => {
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    test('close button has accessible label', async ({ page }) => {
      const closeButton = page.getByRole('button', { name: /close/i });
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    test('email input has accessible label', async ({ page }) => {
      // Check for sr-only label
      const label = page.locator('label[for="signup-email"]');
      await expect(label).toContainText('Email address');
    });

    test('OAuth buttons have accessible labels', async ({ page }) => {
      const googleButton = page.getByRole('button', {
        name: /continue with google/i,
      });
      const appleButton = page.getByRole('button', {
        name: /continue with apple/i,
      });

      await expect(googleButton).toHaveAttribute(
        'aria-label',
        'Continue with Google'
      );
      await expect(appleButton).toHaveAttribute(
        'aria-label',
        'Continue with Apple'
      );
    });
  });
});

test.describe('Signup Pressure - Responsive Design', () => {
  test.describe('Mobile viewport (bottom sheet)', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 size

    test('modal appears as bottom sheet on mobile', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // On mobile, the sheet should be positioned at bottom
      // Check for the mobile sheet container (has rounded-t-2xl and bottom-0 classes)
      const mobileSheet = page.locator('.rounded-t-2xl.bottom-0, [class*="rounded-t"]');
      const sheetCount = await mobileSheet.count();

      // Either the mobile sheet specific styles are present, or we verify via bounding box
      const dialogBox = await modal.boundingBox();
      expect(dialogBox).toBeTruthy();

      if (dialogBox) {
        // On mobile, the sheet should be near the bottom of the viewport
        // The top of the sheet should be at least 100px from the top (allowing for content)
        expect(dialogBox.y).toBeGreaterThan(50);
      }
    });

    test('mobile sheet has drag handle', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Check for drag handle element (the small bar at the top of the sheet)
      const dragHandle = page.locator('.w-10.h-1.rounded-full, [class*="w-10"][class*="h-1"]');
      await expect(dragHandle.first()).toBeVisible();
    });
  });

  test.describe('Desktop viewport (centered modal)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('modal appears as centered dialog on desktop', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // On desktop, the modal should be centered (has flex items-center justify-center)
      const dialogBox = await modal.boundingBox();
      expect(dialogBox).toBeTruthy();

      if (dialogBox) {
        // Modal should be roughly centered horizontally
        const viewportWidth = 1440;
        const modalCenter = dialogBox.x + dialogBox.width / 2;
        const viewportCenter = viewportWidth / 2;

        // Allow 100px tolerance for centering
        expect(Math.abs(modalCenter - viewportCenter)).toBeLessThan(100);

        // Modal should be roughly centered vertically (or at least not at bottom)
        const viewportHeight = 900;
        const modalVerticalCenter = dialogBox.y + dialogBox.height / 2;

        // Modal should be in the middle third of the viewport
        expect(modalVerticalCenter).toBeGreaterThan(viewportHeight / 4);
        expect(modalVerticalCenter).toBeLessThan((viewportHeight * 3) / 4);
      }
    });

    test('desktop modal has rounded corners', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Check for rounded corners class on the modal container
      const roundedModal = page.locator('.rounded-2xl, [class*="rounded-2xl"]');
      await expect(roundedModal.first()).toBeVisible();
    });

    test('email input is auto-focused on desktop', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForLoadState('networkidle');

      // Set state with both thresholds met
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      await setSignupPressureState(page, {
        quickViewCount: QUICK_VIEW_THRESHOLD,
        sessionStartTime: fourMinutesAgo,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Wait a moment for focus to be set
      await page.waitForTimeout(200);

      // Email input should be focused (on desktop only)
      const emailInput = page.locator('input#signup-email');
      await expect(emailInput).toBeFocused();
    });
  });
});

test.describe('Signup Pressure - Integration with QuickView', () => {
  test('quick view opens increment the quick view counter', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Clear state
    await clearSignupPressureState(page);

    // Set initial state with 0 quick views
    await setSignupPressureState(page, {
      quickViewCount: 0,
      sessionStartTime: Date.now(),
    });

    // Reload to apply state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open a quick view
    const cards = page.locator('[data-testid="listing-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await cards.first().click();

    // Wait for QuickView to open
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 5000,
    });

    // Close QuickView
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);

    // Check that quick view count was incremented
    const state = await getSignupPressureState(page);
    expect(state.quickViewCount).toBe(1);
  });
});

test.describe('Signup Pressure - Authenticated Users', () => {
  test('modal does not appear for signed up users', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Set state with thresholds met BUT user has signed up
    const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
    await setSignupPressureState(page, {
      quickViewCount: QUICK_VIEW_THRESHOLD,
      sessionStartTime: fourMinutesAgo,
      hasSignedUp: true,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Modal should not appear
    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).not.toBeVisible();
  });
});
