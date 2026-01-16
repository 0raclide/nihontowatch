'use client';

import { useEffect } from 'react';

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    // Store current scroll position
    const scrollY = window.scrollY;
    const body = document.body;

    // Apply scroll lock
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    body.classList.add('drawer-open');

    return () => {
      // Remove scroll lock
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      body.classList.remove('drawer-open');

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
