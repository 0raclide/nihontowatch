'use client';

import { useLayoutEffect, useRef, useEffect } from 'react';

// Global state for scroll tracking
// This module tracks scroll position continuously so we always have
// the "stable" scroll position from before any click-triggered browser scroll
declare global {
  interface Window {
    __scrollLockActive?: boolean;
    __stableScrollPosition?: number;
    __scrollTrackingInitialized?: boolean;
  }
}

/**
 * Initialize scroll position tracking.
 * This runs once on module load and continuously tracks scroll position
 * with a 150ms lag, so browser-triggered instant scrolls (like scroll-into-view)
 * don't affect the stored position.
 */
function initScrollTracking() {
  if (typeof window === 'undefined') return;
  if (window.__scrollTrackingInitialized) return;
  window.__scrollTrackingInitialized = true;

  // Initialize with current position
  window.__stableScrollPosition = window.scrollY;

  // Track scroll with a delay that's longer than browser instant-scroll duration
  // but short enough that user scrolling feels responsive
  const LAG_MS = 150;
  let updateTimeout: ReturnType<typeof setTimeout> | null = null;

  window.addEventListener('scroll', () => {
    // Always clear pending updates
    if (updateTimeout) clearTimeout(updateTimeout);

    // Schedule update with lag - this ensures instant browser scrolls
    // (like scroll-into-view on click) don't update the stable position
    // because they complete in <50ms
    updateTimeout = setTimeout(() => {
      if (!window.__scrollLockActive) {
        window.__stableScrollPosition = window.scrollY;
      }
    }, LAG_MS);
  }, { passive: true });
}

// Initialize on module load
initScrollTracking();

/**
 * Check if scroll lock is active (for use by other scroll handlers).
 */
export function isScrollLockActive(): boolean {
  return typeof window !== 'undefined' && window.__scrollLockActive === true;
}

/**
 * Get the last stable scroll position (before any click-triggered scroll).
 */
export function getStableScrollPosition(): number {
  return typeof window !== 'undefined' ? (window.__stableScrollPosition ?? window.scrollY) : 0;
}

/**
 * Locks body scroll using position:fixed technique with stable scroll tracking.
 *
 * This approach:
 * - Uses position:fixed on body with top: -scrollY
 * - Uses pre-tracked "stable" scroll position to handle instant browser scrolls
 * - Visually preserves the page position (no jump when opening)
 * - Restores exact scroll position when closing
 * - Sets a global flag to tell other scroll handlers to pause
 *
 * @param isLocked - Whether scroll should be locked
 *
 * IMPORTANT: Only one component should use this hook at a time.
 */
export function useBodyScrollLock(isLocked: boolean) {
  const scrollPositionRef = useRef(0);

  // Ensure tracking is initialized (for dynamic imports)
  useEffect(() => {
    initScrollTracking();
  }, []);

  useLayoutEffect(() => {
    if (!isLocked) return;

    // Use the stable scroll position, which is tracked before any click
    // This avoids the issue where browser scroll-into-view changes scrollY
    // before our effect runs
    const scrollY = window.__stableScrollPosition ?? window.scrollY;
    scrollPositionRef.current = scrollY;

    // Calculate scrollbar width BEFORE applying position:fixed
    // This is the difference between window width and document width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Set global flag FIRST to tell scroll handlers to ignore events
    window.__scrollLockActive = true;

    const body = document.body;

    // Store original styles
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalLeft = body.style.left;
    const originalRight = body.style.right;
    const originalOverflow = body.style.overflow;
    const originalWidth = body.style.width;
    const originalPaddingRight = body.style.paddingRight;

    // Apply scroll lock using position:fixed
    // The negative top offset preserves visual position
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    body.style.width = '100%';

    // Add padding-right to compensate for scrollbar disappearing
    // This prevents layout shift when the scrollbar is removed
    if (scrollbarWidth > 0) {
      const currentPadding = parseInt(getComputedStyle(body).paddingRight, 10) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    return () => {
      // Restore original styles
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.left = originalLeft;
      body.style.right = originalRight;
      body.style.overflow = originalOverflow;
      body.style.width = originalWidth;
      body.style.paddingRight = originalPaddingRight;

      // Restore scroll position BEFORE clearing the flag
      // This ensures virtual scroll doesn't see a scrollY of 0
      window.scrollTo(0, scrollY);

      // Update stable position to match restored position
      window.__stableScrollPosition = scrollY;

      // Clear global flag AFTER scroll is restored
      window.__scrollLockActive = false;
    };
  }, [isLocked]);
}
