import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdaptiveVirtualScroll } from '@/hooks/useAdaptiveVirtualScroll';

// Mock window properties
const mockWindowProperties = (width: number, height: number, scrollY: number = 0) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true });
};

// Helper to simulate scroll and trigger RAF
const simulateScroll = async (scrollY: number) => {
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true });
  window.dispatchEvent(new Event('scroll'));
  // Advance timers to process RAF callback
  await vi.advanceTimersByTimeAsync(16);
};

describe('useAdaptiveVirtualScroll', () => {
  const createItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i, name: `Item ${i}` }));

  beforeEach(() => {
    vi.useFakeTimers();
    // Default to desktop dimensions
    mockWindowProperties(1280, 800);
    // Reset scroll lock flag
    window.__scrollLockActive = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('SSR safety', () => {
    it('returns all items when disabled (pagination mode)', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2, enabled: false })
      );

      // When disabled, shows all items without virtualization (for desktop pagination)
      expect(result.current.isVirtualized).toBe(false);
      expect(result.current.visibleItems.length).toBe(100); // All items
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

      // Mobile should have taller rows (437px)
      expect(result.current.rowHeight).toBe(437);
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

      // Desktop xl (4 columns) should have 372px rows
      expect(result.current.rowHeight).toBe(372);
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
      // 25 rows * 372px = 9300px
      expect(result.current.totalHeight).toBe(9300);
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

      // With 800px viewport, 372px rows, and 2 overscan
      // visible rows = ceil(800/372) + 4 = 7 rows
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
      expect(result.current.visibleItems.length).toBe(100); // All items (pagination mode)
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

  describe('scroll jumping fix', () => {
    it('updates startRow only when crossing row boundary', async () => {
      mockWindowProperties(1280, 800); // 4 columns, 372px row height
      const items = createItems(200);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.startIndex).toBe(0);
      expect(result.current.offsetY).toBe(0);

      // Scroll within same row boundary (less than rowHeight)
      await act(async () => {
        await simulateScroll(100); // Well below 372px threshold
      });

      // startRow should still be 0 (with overscan: 2, startRow stays 0 until scroll > 3*372)
      expect(result.current.startIndex).toBe(0);

      // Scroll past the row boundary that would change startRow
      // With overscan: 2, startRow changes when floor(scrollY/372) - 2 > 0
      // That's when floor(scrollY/372) > 2, meaning scrollY >= 3*372 = 1116
      await act(async () => {
        await simulateScroll(1116);
      });

      // Now startRow should be 1
      expect(result.current.startIndex).toBe(4); // 1 row * 4 columns
      expect(result.current.offsetY).toBe(372); // 1 row * 372px
    });

    it('offsetY only jumps in row-height increments', async () => {
      mockWindowProperties(1280, 800); // 4 columns, 372px row height
      const items = createItems(200);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const scrollPositions = [0, 100, 500, 1000, 1116, 1488, 2000];
      const offsetHistory: number[] = [];

      for (const scrollY of scrollPositions) {
        await act(async () => {
          await simulateScroll(scrollY);
        });
        offsetHistory.push(result.current.offsetY);
      }

      // Verify offsetY only increases in rowHeight (372px) increments
      for (let i = 1; i < offsetHistory.length; i++) {
        const diff = offsetHistory[i] - offsetHistory[i - 1];
        // Difference should either be 0 (same row) or a multiple of 372
        if (diff !== 0) {
          expect(diff % 372).toBe(0);
        }
      }
    });

    it('does not update during scroll lock (modal open)', async () => {
      mockWindowProperties(1280, 800);
      const items = createItems(200);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 2 })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const initialOffset = result.current.offsetY;

      // Simulate scroll lock (modal open)
      window.__scrollLockActive = true;

      // Try to scroll while locked
      await act(async () => {
        await simulateScroll(2000);
      });

      // Offset should NOT have changed
      expect(result.current.offsetY).toBe(initialOffset);

      // Unlock and scroll
      window.__scrollLockActive = false;
      await act(async () => {
        await simulateScroll(2000);
      });

      // Now offset should update
      expect(result.current.offsetY).toBeGreaterThan(initialOffset);
    });

    it('responds to every row boundary crossing without threshold delay', async () => {
      mockWindowProperties(1280, 800); // 4 columns, 372px row height
      const items = createItems(200);
      const { result } = renderHook(() =>
        useAdaptiveVirtualScroll({ items, overscan: 0 }) // No overscan for clearer test
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // With overscan: 0, startRow = floor(scrollY/372)
      // At scrollY = 371, startRow = 0
      // At scrollY = 372, startRow = 1

      await act(async () => {
        await simulateScroll(371);
      });
      expect(result.current.offsetY).toBe(0);

      await act(async () => {
        await simulateScroll(372);
      });
      expect(result.current.offsetY).toBe(372);

      await act(async () => {
        await simulateScroll(743);
      });
      expect(result.current.offsetY).toBe(372);

      await act(async () => {
        await simulateScroll(744);
      });
      expect(result.current.offsetY).toBe(744);
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
      // 50 rows * 372px = 18600px
      expect(result.current.totalHeight).toBe(18600);
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
      // 13 rows * 372px = 4836px
      expect(result.current.totalHeight).toBe(4836);
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
