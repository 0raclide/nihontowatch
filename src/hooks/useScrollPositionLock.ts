'use client';

import { useRef, useCallback } from 'react';

interface UseScrollPositionLockResult {
  /** Save current scroll position. Call before content changes. */
  lockScrollPosition: () => void;
  /** Restore saved scroll position. Call after content renders. */
  unlockScrollPosition: () => void;
  /** Whether a scroll position is currently locked */
  isLocked: boolean;
}

/**
 * Preserves scroll position during dynamic content changes.
 *
 * Use this hook to prevent scroll jumping/bouncing when content is
 * added to the page (e.g., infinite scroll loading more items).
 *
 * Pattern:
 * 1. Call lockScrollPosition() BEFORE triggering the content change
 * 2. Call unlockScrollPosition() AFTER the new content has rendered
 *
 * The hook uses 'instant' scroll behavior to avoid animation.
 *
 * @example
 * const { lockScrollPosition, unlockScrollPosition } = useScrollPositionLock();
 *
 * const loadMore = async () => {
 *   lockScrollPosition();
 *   await fetchMoreItems();
 *   // unlockScrollPosition() called after render in useEffect
 * };
 */
export function useScrollPositionLock(): UseScrollPositionLockResult {
  const savedPositionRef = useRef<number | null>(null);
  const isLockedRef = useRef(false);

  const lockScrollPosition = useCallback(() => {
    // Idempotent: don't overwrite if already locked
    if (!isLockedRef.current) {
      savedPositionRef.current = window.scrollY;
      isLockedRef.current = true;
    }
  }, []);

  const unlockScrollPosition = useCallback(() => {
    if (isLockedRef.current && savedPositionRef.current !== null) {
      // Use instant scroll to avoid visible animation
      window.scrollTo({
        top: savedPositionRef.current,
        behavior: 'instant' as ScrollBehavior,
      });
      savedPositionRef.current = null;
      isLockedRef.current = false;
    }
  }, []);

  return {
    lockScrollPosition,
    unlockScrollPosition,
    isLocked: isLockedRef.current,
  };
}
