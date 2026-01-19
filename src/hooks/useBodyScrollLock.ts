'use client';

import { useLayoutEffect, useRef } from 'react';

// Global flag to signal scroll handlers to ignore scroll events
// This prevents virtual scroll from recalculating during modal open/close
declare global {
  interface Window {
    __scrollLockActive?: boolean;
    __savedScrollPosition?: number;
  }
}

/**
 * Check if scroll lock is active (for use by other scroll handlers).
 */
export function isScrollLockActive(): boolean {
  return typeof window !== 'undefined' && window.__scrollLockActive === true;
}

/**
 * Capture scroll position globally before any state changes.
 * Call this on mousedown for reliable position capture.
 */
export function captureScrollPosition(): void {
  if (typeof window !== 'undefined' && !window.__scrollLockActive) {
    window.__savedScrollPosition = window.scrollY;
    // Debug: log capture
    console.log('[ScrollCapture] Captured:', window.scrollY, 'at', new Date().toISOString());
  }
}

/**
 * Get the captured scroll position.
 */
export function getCapturedScrollPosition(): number {
  return typeof window !== 'undefined' ? (window.__savedScrollPosition ?? 0) : 0;
}

/**
 * Locks body scroll using overflow:hidden.
 *
 * This approach:
 * - Uses overflow:hidden on html and body
 * - Does NOT use position:fixed (which breaks virtual scroll)
 * - Sets a global flag to tell other scroll handlers to pause
 *
 * @param isLocked - Whether scroll should be locked
 * @param savedScrollPosition - Optional: pre-captured scroll position to restore
 *
 * IMPORTANT: Only one component should use this hook at a time.
 */
export function useBodyScrollLock(isLocked: boolean, savedScrollPosition?: number) {
  const scrollPositionRef = useRef(0);

  useLayoutEffect(() => {
    if (!isLocked) return;

    // Priority for scroll position:
    // 1. Provided savedScrollPosition (from context/prop)
    // 2. Globally captured position (set on mousedown)
    // 3. Current window.scrollY (may be wrong if overflow already applied)
    const scrollY = savedScrollPosition || window.__savedScrollPosition || window.scrollY;
    scrollPositionRef.current = scrollY;

    // Debug: log what we're using
    console.log('[ScrollLock] Using scrollY:', scrollY,
      '(prop:', savedScrollPosition, ', global:', window.__savedScrollPosition, ', current:', window.scrollY, ')');

    // Set global flag FIRST to tell scroll handlers to ignore events
    window.__scrollLockActive = true;

    const html = document.documentElement;
    const body = document.body;

    // Store original styles
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = body.style.overflow;

    // Apply scroll lock using overflow:hidden
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      // Restore original styles
      html.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;

      // Restore scroll position
      window.scrollTo(0, scrollY);

      // Clear global saved position
      window.__savedScrollPosition = undefined;

      // Clear global flag AFTER scroll is restored
      window.__scrollLockActive = false;
    };
  }, [isLocked, savedScrollPosition]);
}
