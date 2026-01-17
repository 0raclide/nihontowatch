'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseVirtualScrollOptions {
  /** Fixed height of each item in pixels */
  itemHeight: number;
  /** Number of extra items to render above/below viewport for smooth scrolling */
  overscan?: number;
  /** Total number of items in the list */
  totalItems: number;
  /** Whether virtual scrolling is enabled */
  enabled?: boolean;
}

interface VisibleRange {
  start: number;
  end: number;
}

interface UseVirtualScrollResult {
  /** Range of items that should be rendered */
  visibleRange: VisibleRange;
  /** Y offset to position the visible items container */
  offsetY: number;
  /** Total height of the scrollable area */
  totalHeight: number;
  /** Current scroll position */
  scrollTop: number;
}

/**
 * Hook for virtual scrolling with fixed-height items.
 * Only renders items visible in the viewport plus an overscan buffer.
 * Handles scroll anchoring when new items are added to prevent layout jumps.
 */
export function useVirtualScroll({
  itemHeight,
  overscan = 3,
  totalItems,
  enabled = true,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);
  // Start with a reasonable default to avoid hydration mismatch
  // Will be updated in useEffect on client
  const [viewportHeight, setViewportHeight] = useState(800);

  // Track previous item count for scroll anchoring
  const prevTotalItemsRef = useRef(totalItems);
  const rafRef = useRef<number | null>(null);

  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback((): VisibleRange => {
    if (!enabled || totalItems === 0) {
      return { start: 0, end: 0 };
    }

    // Calculate which items are visible
    const startIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);

    // Add overscan buffer
    const start = Math.max(0, startIndex - overscan);
    const end = Math.min(totalItems, startIndex + visibleCount + overscan);

    return { start, end };
  }, [scrollTop, viewportHeight, itemHeight, overscan, totalItems, enabled]);

  const visibleRange = calculateVisibleRange();

  // Calculate offset for positioning visible items
  const offsetY = visibleRange.start * itemHeight;

  // Calculate total scrollable height
  const totalHeight = totalItems * itemHeight;

  // Handle scroll events with requestAnimationFrame for performance
  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(window.scrollY);
    });
  }, []);

  // Handle resize events
  const handleResize = useCallback(() => {
    setViewportHeight(window.innerHeight);
  }, []);

  // Set up scroll and resize listeners
  useEffect(() => {
    if (!enabled) return;

    // Initial values
    setScrollTop(window.scrollY);
    setViewportHeight(window.innerHeight);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, handleScroll, handleResize]);

  // Scroll anchoring: preserve position when items are added
  useEffect(() => {
    if (!enabled) return;

    const prevCount = prevTotalItemsRef.current;

    // Only anchor if items were added (not on initial load or removal)
    if (totalItems > prevCount && prevCount > 0) {
      // Items were added - the scroll position should stay the same
      // since new items are appended to the bottom in infinite scroll
      // No adjustment needed for bottom-append pattern
    }

    prevTotalItemsRef.current = totalItems;
  }, [totalItems, enabled]);

  return {
    visibleRange,
    offsetY,
    totalHeight,
    scrollTop,
  };
}
