'use client';

import { useEffect, useRef } from 'react';

/**
 * Locks body scroll using position:fixed technique.
 *
 * This approach:
 * - Uses position:fixed on body with negative top offset
 * - Maintains visual scroll position during lock (no jump)
 * - Restores exact scroll position on unlock
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

    const body = document.body;

    // Store original styles
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalLeft = body.style.left;
    const originalRight = body.style.right;
    const originalOverflow = body.style.overflow;

    // Apply scroll lock using position:fixed
    // The negative top offset keeps the page visually in the same position
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      // Restore original styles
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.left = originalLeft;
      body.style.right = originalRight;
      body.style.overflow = originalOverflow;

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked, savedScrollPosition]);
}
