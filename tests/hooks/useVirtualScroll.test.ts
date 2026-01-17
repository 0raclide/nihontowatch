import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';

describe('useVirtualScroll', () => {
  const defaultOptions = {
    itemHeight: 320,
    overscan: 3,
    totalItems: 100,
    enabled: true,
  };

  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 844, // iPhone 14 Pro height
    });

    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visible range calculation', () => {
    it('calculates visible range correctly at scroll position 0', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      // At scroll 0, with viewport 844px and item height 320px:
      // Visible items: ceil(844 / 320) = 3 items
      // With overscan 3: start = max(0, 0 - 3) = 0, end = min(100, 0 + 3 + 3) = 6
      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.end).toBe(6);
      expect(result.current.offsetY).toBe(0);
    });

    it('calculates visible range correctly mid-scroll', () => {
      // Set scroll position to 1000px
      Object.defineProperty(window, 'scrollY', { value: 1000 });

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      // Trigger scroll update
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // At scroll 1000px with item height 320px:
      // startIndex = floor(1000 / 320) = 3
      // With overscan 3: start = max(0, 3 - 3) = 0, end = min(100, 3 + 3 + 3) = 9
      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.end).toBe(9);
    });

    it('calculates visible range at deep scroll position', () => {
      // Set scroll position to 10000px
      Object.defineProperty(window, 'scrollY', { value: 10000 });

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // At scroll 10000px with item height 320px:
      // startIndex = floor(10000 / 320) = 31
      // With overscan 3: start = max(0, 31 - 3) = 28, end = min(100, 31 + 3 + 3) = 37
      expect(result.current.visibleRange.start).toBe(28);
      expect(result.current.visibleRange.end).toBe(37);
      expect(result.current.offsetY).toBe(28 * 320);
    });
  });

  describe('overscan buffer', () => {
    it('includes overscan buffer items', () => {
      Object.defineProperty(window, 'scrollY', { value: 3200 }); // Start at item 10

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // startIndex = floor(3200 / 320) = 10
      // With overscan 3: should render from 7 to 16
      expect(result.current.visibleRange.start).toBe(7);
      expect(result.current.visibleRange.end).toBe(16);
    });

    it('respects custom overscan value', () => {
      Object.defineProperty(window, 'scrollY', { value: 3200 });

      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultOptions, overscan: 5 })
      );

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // startIndex = 10, with overscan 5: start = 5, end = 18
      expect(result.current.visibleRange.start).toBe(5);
      expect(result.current.visibleRange.end).toBe(18);
    });
  });

  describe('edge cases', () => {
    it('handles edge case at start of list (no negative indices)', () => {
      Object.defineProperty(window, 'scrollY', { value: 100 }); // Near top

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // Should never go below 0
      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.start).toBeGreaterThanOrEqual(0);
    });

    it('handles edge case at end of list', () => {
      // Scroll to near end
      const scrollPosition = 95 * 320; // Near item 95
      Object.defineProperty(window, 'scrollY', { value: scrollPosition });

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // Should not exceed totalItems
      expect(result.current.visibleRange.end).toBeLessThanOrEqual(100);
    });

    it('handles empty list', () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultOptions, totalItems: 0 })
      );

      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.end).toBe(0);
      expect(result.current.totalHeight).toBe(0);
    });

    it('handles disabled state', () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultOptions, enabled: false })
      );

      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.end).toBe(0);
    });
  });

  describe('total height calculation', () => {
    it('calculates total scrollable height correctly', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      expect(result.current.totalHeight).toBe(100 * 320);
    });

    it('updates total height when items change', () => {
      const { result, rerender } = renderHook(
        ({ totalItems }) => useVirtualScroll({ ...defaultOptions, totalItems }),
        { initialProps: { totalItems: 100 } }
      );

      expect(result.current.totalHeight).toBe(32000);

      rerender({ totalItems: 150 });

      expect(result.current.totalHeight).toBe(48000);
    });
  });

  describe('scroll anchoring', () => {
    it('preserves scroll position when items are added', () => {
      Object.defineProperty(window, 'scrollY', { value: 1000 });

      const { result, rerender } = renderHook(
        ({ totalItems }) => useVirtualScroll({ ...defaultOptions, totalItems }),
        { initialProps: { totalItems: 100 } }
      );

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      const rangeBefore = result.current.visibleRange;

      // Add more items (simulating infinite scroll load)
      rerender({ totalItems: 200 });

      // Visible range should be the same since items are added at bottom
      expect(result.current.visibleRange.start).toBe(rangeBefore.start);
    });
  });

  describe('performance optimizations', () => {
    it('uses requestAnimationFrame for scroll updates', () => {
      renderHook(() => useVirtualScroll(defaultOptions));

      // Trigger scroll
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it('cancels pending animation frame on new scroll', () => {
      // Mock requestAnimationFrame to return incrementing IDs and NOT call callback immediately
      let rafId = 0;
      const pendingCallbacks = new Map<number, FrameRequestCallback>();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafId++;
        pendingCallbacks.set(rafId, cb);
        return rafId;
      });

      renderHook(() => useVirtualScroll(defaultOptions));

      // Trigger multiple scrolls rapidly (without executing callbacks)
      act(() => {
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('scroll'));
      });

      // Should cancel previous frame since we sent two scrolls
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('adds scroll listener with passive option', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useVirtualScroll(defaultOptions));

      const scrollCall = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'scroll'
      );

      expect(scrollCall).toBeDefined();
      expect(scrollCall?.[2]).toEqual({ passive: true });
    });
  });

  describe('viewport resize handling', () => {
    it('updates visible range on viewport resize', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      const initialEnd = result.current.visibleRange.end;

      // Resize viewport to be taller
      act(() => {
        Object.defineProperty(window, 'innerHeight', { value: 1200 });
        window.dispatchEvent(new Event('resize'));
      });

      // Should show more items with taller viewport
      expect(result.current.visibleRange.end).toBeGreaterThanOrEqual(initialEnd);
    });
  });

  describe('offset calculation', () => {
    it('calculates correct offset for visible items', () => {
      Object.defineProperty(window, 'scrollY', { value: 5000 });

      const { result } = renderHook(() => useVirtualScroll(defaultOptions));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // Offset should be start index * item height
      expect(result.current.offsetY).toBe(result.current.visibleRange.start * 320);
    });
  });
});
