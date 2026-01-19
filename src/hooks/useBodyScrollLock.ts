'use client';

import { useEffect, useRef } from 'react';

/**
 * Locks body scroll using overflow:hidden approach.
 *
 * This approach:
 * - Uses overflow:hidden on html/body to prevent scrolling
 * - Does NOT use position:fixed (which can interfere with virtual scroll)
 * - Captures scroll position and restores on unlock
 *
 * @param isLocked - Whether scroll should be locked
 * @param savedScrollPosition - Optional: pre-captured scroll position to restore
 *
 * IMPORTANT: Only one component should use this hook at a time.
 */
export function useBodyScrollLock(isLocked: boolean, savedScrollPosition?: number) {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (!isLocked) return;

    // Use provided scroll position if available, otherwise capture current
    const scrollY = savedScrollPosition ?? window.scrollY;
    scrollPositionRef.current = scrollY;

    const html = document.documentElement;
    const body = document.body;

    // Store original styles
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = body.style.overflow;

    // Apply scroll lock using overflow:hidden
    // Keep document at current scroll position visually
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      // Restore original styles
      html.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked, savedScrollPosition]);
}
