import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdaptiveVirtualScroll } from '@/hooks/useAdaptiveVirtualScroll';

// Mock window properties
const mockWindowProperties = (width: number, height: number, scrollY: number = 0) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true });
};

describe('useAdaptiveVirtualScroll', () => {
  const createItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i, name: `Item ${i}` }));

  beforeEach(() => {
    vi.useFakeTimers();
    // Default to desktop dimensions
    mockWindowProperties(1280, 800);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('SSR safety', () => {
    it('returns SSR-safe defaults when disabled', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2, enabled: false })
      );

      // When disabled, shows first batch without virtualization (simulates SSR)
      expect(result.current.isVirtualized).toBe(false);
      expect(result.current.visibleItems.length).toBeLessThanOrEqual(20);
      expect(result.current.startIndex).toBe(0);
    });

    it('enables virtualization after client mount', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      // Trigger client-side effect
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isVirtualized).toBe(true);
      expect(result.current.totalHeight).toBeGreaterThan(0);
    });
  });

  describe('column calculation', () => {
    it('uses 1 column for mobile (< 640px)', () => {
      mockWindowProperties(390, 844);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.columns).toBe(1);
    });

    it('uses 2 columns for small tablet (640-1023px)', () => {
      mockWindowProperties(768, 1024);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.columns).toBe(2);
    });

    it('uses 3 columns for desktop (1024-1279px)', () => {
      mockWindowProperties(1024, 768);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.columns).toBe(3);
    });

    it('uses 4 columns for large desktop (1280-1535px)', () => {
      mockWindowProperties(1400, 900);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.columns).toBe(4);
    });

    it('uses 5 columns for extra large desktop (>= 1536px)', () => {
      mockWindowProperties(1920, 1080);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.columns).toBe(5);
    });
  });

  describe('row height calculation', () => {
    it('uses taller rows for mobile (1 column)', () => {
      mockWindowProperties(390, 844);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // Mobile should have taller rows (360px)
      expect(result.current.rowHeight).toBe(360);
    });

    it('uses shorter rows for desktop (2+ columns)', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // Desktop should have shorter rows (310px)
      expect(result.current.rowHeight).toBe(310);
    });
  });

  describe('virtualization calculations', () => {
    it('calculates correct total height', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // 100 items / 4 columns = 25 rows
      // 25 rows * 310px = 7750px
      expect(result.current.totalHeight).toBe(7750);
    });

    it('includes overscan in visible items', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // With 800px viewport, 310px rows, and 2 overscan
      // visible rows = ceil(800/310) + 4 = 7 rows
      // 7 rows * 4 columns = 28 items
      expect(result.current.visibleItems.length).toBeGreaterThan(8);
    });

    it('respects overscan parameter', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(100);

      const { result: result0 } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 0 })
      );

      const { result: result5 } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 5 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result5.current.visibleItems.length).toBeGreaterThan(
        result0.current.visibleItems.length
      );
    });
  });

  describe('enabled option', () => {
    it('disables virtualization when enabled=false', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2, enabled: false })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isVirtualized).toBe(false);
      expect(result.current.visibleItems.length).toBe(20); // SSR batch
    });

    it('enables virtualization when enabled=true (default)', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2, enabled: true })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isVirtualized).toBe(true);
    });
  });

  describe('small lists', () => {
    it('handles empty item list', () => {
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items: [], overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.visibleItems).toHaveLength(0);
      expect(result.current.totalHeight).toBe(0);
    });

    it('handles list smaller than SSR batch', () => {
      const items = createItems(10);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      // Before client mount
      expect(result.current.visibleItems.length).toBe(10);

      act(() => {
        vi.runAllTimers();
      });

      // After client mount, all items should still be visible
      expect(result.current.visibleItems.length).toBe(10);
    });
  });

  describe('resize handling', () => {
    it('updates dimensions on resize', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // Initially desktop (4 columns)
      expect(result.current.columns).toBe(4);

      // Resize to mobile
      act(() => {
        mockWindowProperties(390, 844);
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(150); // Debounce delay
      });

      expect(result.current.columns).toBe(1);
    });
  });

  describe('totalCount for fixed height', () => {
    it('uses totalCount for height calculation when provided', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(50); // Only 50 items loaded
      const totalCount = 200; // But 200 total items exist

      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, totalCount, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // Height should be based on totalCount (200), not items.length (50)
      // 200 items / 4 columns = 50 rows
      // 50 rows * 310px = 15500px
      expect(result.current.totalHeight).toBe(15500);
    });

    it('falls back to items.length when totalCount not provided', () => {
      mockWindowProperties(1280, 800);
      const items = createItems(50);

      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      act(() => {
        vi.runAllTimers();
      });

      // Height should be based on items.length (50)
      // 50 items / 4 columns = 13 rows (ceil)
      // 13 rows * 310px = 4030px
      expect(result.current.totalHeight).toBe(4030);
    });

    it('keeps height stable when more items load with totalCount', () => {
      mockWindowProperties(1280, 800);
      let items = createItems(50);
      const totalCount = 200;

      const { result, rerender } = renderHook(
        ({ items }) => useAdaptiveVirtualScroll({ items, totalCount, overscan: 2 }),
        { initialProps: { items } }
      );

      act(() => {
        vi.runAllTimers();
      });

      const heightBefore = result.current.totalHeight;

      // Load more items
      items = createItems(100);
      rerender({ items });

      act(() => {
        vi.runAllTimers();
      });

      // Height should NOT change - still based on totalCount
      expect(result.current.totalHeight).toBe(heightBefore);
    });
  });
});
