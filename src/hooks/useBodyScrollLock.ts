'use client';

import { useEffect } from 'react';

/**
 * Locks body scroll without using position:fixed.
 *
 * The previous approach (body position:fixed) breaks fixed-positioned
 * children like BottomTabBar because it changes their coordinate system.
 *
 * This approach uses overflow:hidden on html/body which prevents
 * scrolling while keeping position:static, preserving fixed children.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    // Store current scroll position and body styles
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    // Store original styles
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlHeight = html.style.height;
    const originalBodyHeight = body.style.height;

    // Apply scroll lock WITHOUT position:fixed
    // This preserves the coordinate system for fixed children
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.classList.add('drawer-open');

    // Maintain visual scroll position by setting scrollTop
    // (content stays visually in place)
    html.scrollTop = scrollY;

    return () => {
      // Remove scroll lock
      html.style.overflow = originalHtmlOverflow;
      html.style.height = originalHtmlHeight;
      body.style.overflow = originalBodyOverflow;
      body.style.height = originalBodyHeight;
      body.classList.remove('drawer-open');

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
