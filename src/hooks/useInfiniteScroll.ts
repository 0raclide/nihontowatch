'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number; // pixels from bottom to trigger
  enabled?: boolean;
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 400,
  enabled = true,
}: UseInfiniteScrollOptions) {
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

  const handleScroll = useCallback(() => {
    if (!enabled || isLoading || !hasMore) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Check if user is near the bottom
    if (scrollTop + windowHeight >= docHeight - threshold) {
      loadMoreRef.current();
    }
  }, [enabled, isLoading, hasMore, threshold]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll, enabled]);

  return { handleScroll };
}
