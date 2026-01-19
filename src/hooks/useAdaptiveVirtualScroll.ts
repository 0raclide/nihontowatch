'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isScrollLockActive } from './useBodyScrollLock';

/**
 * Responsive breakpoints matching Tailwind defaults.
 * Used to determine column count for virtualization calculations.
 */
const BREAKPOINTS = {
  sm: 640,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * Calculate column count based on viewport width.
 * Matches the CSS grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5
 */
function getColumnCount(width: number): number {
  if (width >= BREAKPOINTS['2xl']) return 5;
  if (width >= BREAKPOINTS.xl) return 4;
  if (width >= BREAKPOINTS.lg) return 3;
  if (width >= BREAKPOINTS.sm) return 2;
  return 1;
}

/**
 * Estimate row height based on column count.
 * Includes card height + gap. Values measured from actual rendered cards.
 *
 * Measurements (card height + gap):
 * - 1 column (mobile): 425px + 12px gap = 437px
 * - 2 columns (sm): 390px + 16px gap = 406px
 * - 3 columns (lg): 354px + 16px gap = 370px
 * - 4 columns (xl): 356px + 16px gap = 372px
 * - 5 columns (2xl): 358px + 16px gap = 374px
 */
function getRowHeight(columns: number): number {
  switch (columns) {
    case 1: return 437;
    case 2: return 406;
    case 3: return 370;
    case 4: return 372;
    case 5: return 374;
    default: return 372; // Fallback to most common
  }
}

interface UseAdaptiveVirtualScrollOptions<T> {
  items: T[];
  /** Total count of all items (for pre-calculating container height) */
  totalCount?: number;
  overscan?: number;
  enabled?: boolean;
}

interface UseAdaptiveVirtualScrollResult<T> {
  /** Items currently visible in the viewport (plus overscan buffer) */
  visibleItems: T[];
  /** Starting index of visible items in the full list */
  startIndex: number;
  /** Total height of the scrollable area in pixels */
  totalHeight: number;
  /** Y offset for positioning the visible items container */
  offsetY: number;
  /** Current number of columns being displayed */
  columns: number;
  /** Current row height in pixels */
  rowHeight: number;
  /** Whether virtualization is active (false during SSR) */
  isVirtualized: boolean;
}

/**
 * Adaptive virtual scroll hook that works for all screen sizes.
 *
 * Key features:
 * - SSR-safe: Uses static defaults during server render
 * - Responsive: Adapts to viewport width changes
 * - Row-based: Virtualizes by rows, not individual items
 *
 * The hook virtualizes by ROWS (not individual items) because a row
 * can contain 1-5 items depending on screen width.
 */
export function useAdaptiveVirtualScroll<T>({
  items,
  totalCount,
  overscan = 2,
  enabled = true,
}: UseAdaptiveVirtualScrollOptions<T>): UseAdaptiveVirtualScrollResult<T> {
  // SSR-safe defaults - assume desktop-ish viewport
  const [dimensions, setDimensions] = useState({
    viewportHeight: 800,
    columns: 3,
    rowHeight: 310,
  });

  const [scrollTop, setScrollTop] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  // Track client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update dimensions on mount and resize
  useEffect(() => {
    if (!enabled) return;

    const updateDimensions = () => {
      const width = window.innerWidth;
      const columns = getColumnCount(width);
      const rowHeight = getRowHeight(columns);

      setDimensions({
        viewportHeight: window.innerHeight,
        columns,
        rowHeight,
      });
    };

    updateDimensions();

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateDimensions, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [enabled]);

  // Scroll position tracking with RAF for smooth performance
  const handleScroll = useCallback(() => {
    // Skip scroll updates when body scroll is locked (modal open)
    // This prevents virtual grid from recalculating during modal transitions
    if (isScrollLockActive()) {
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      // Double-check lock status inside RAF (in case it changed)
      if (isScrollLockActive()) {
        return;
      }

      const newScrollTop = window.scrollY;
      // Only update if scroll changed by threshold amount
      // Use smaller threshold (1/4 row) for more responsive updates on iOS
      const threshold = dimensions.rowHeight / 4;
      if (Math.abs(newScrollTop - lastScrollTopRef.current) > threshold) {
        lastScrollTopRef.current = newScrollTop;
        setScrollTop(newScrollTop);
      }
    });
  }, [dimensions.rowHeight]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll, enabled]);

  // Calculate virtualization parameters
  const { viewportHeight, columns, rowHeight } = dimensions;

  // Use totalCount for height calculation if provided (prevents bounce on load more)
  // This reserves space for ALL items upfront, so loading more doesn't change height
  const itemCountForHeight = totalCount ?? items.length;
  const rowCount = Math.ceil(itemCountForHeight / columns);
  const totalHeight = rowCount * rowHeight;

  // For visible range calculation, use actual loaded items
  const loadedRowCount = Math.ceil(items.length / columns);

  // Calculate visible row range (capped to loaded items, not total)
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleRowCount = Math.ceil(viewportHeight / rowHeight) + (overscan * 2);
  const endRow = Math.min(loadedRowCount, startRow + visibleRowCount);

  // Convert row range to item indices
  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length, endRow * columns);

  // Slice visible items
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startRow * rowHeight;

  // SSR: Show first batch for fast initial render
  if (!isClient) {
    const initialCount = Math.min(items.length, 20);
    return {
      visibleItems: items.slice(0, initialCount),
      startIndex: 0,
      totalHeight: 0,
      offsetY: 0,
      columns: dimensions.columns,
      rowHeight: dimensions.rowHeight,
      isVirtualized: false,
    };
  }

  // Virtualization disabled (e.g., desktop pagination mode): show all items
  if (!enabled) {
    return {
      visibleItems: items,
      startIndex: 0,
      totalHeight: 0,
      offsetY: 0,
      columns,
      rowHeight,
      isVirtualized: false,
    };
  }

  return {
    visibleItems,
    startIndex,
    totalHeight,
    offsetY,
    columns,
    rowHeight,
    isVirtualized: true,
  };
}

export type { UseAdaptiveVirtualScrollOptions, UseAdaptiveVirtualScrollResult };
