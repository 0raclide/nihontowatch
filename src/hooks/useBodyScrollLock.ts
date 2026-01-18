'use client';

import { useEffect, useRef } from 'react';

/**
 * Locks body scroll without using position:fixed.
 *
 * The previous approach (body position:fixed) breaks fixed-positioned
 * children like BottomTabBar because it changes their coordinate system.
 *
 * This approach uses overflow:hidden on html/body which prevents
 * scrolling while keeping position:static, preserving fixed children.
 *
 * IMPORTANT: Only one component should use this hook at a time.
 * Don't duplicate scroll locking in multiple places.
 */
export function useBodyScrollLock(isLocked: boolean) {
  // Use ref to store scroll position so it persists across re-renders
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (!isLocked) return;

    // Store current scroll position
    scrollPositionRef.current = window.scrollY;
    const scrollY = scrollPositionRef.current;

    const html = document.documentElement;
    const body = document.body;

    // Store original styles
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = body.style.overflow;

    // Apply scroll lock using only overflow (no height changes)
    // This minimizes layout recalculation when unlocking
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.classList.add('drawer-open');

    return () => {
      // Remove scroll lock
      html.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;
      body.classList.remove('drawer-open');

      // Restore scroll position using requestAnimationFrame
      // This ensures the DOM has settled before we scroll,
      // preventing jarring jumps from virtual scroll recalculation
      requestAnimationFrame(() => {
        // Only scroll if position actually changed (prevents unnecessary events)
        if (Math.abs(window.scrollY - scrollY) > 1) {
          window.scrollTo({ top: scrollY, behavior: 'instant' });
        }
      });
    };
  }, [isLocked]);
}
