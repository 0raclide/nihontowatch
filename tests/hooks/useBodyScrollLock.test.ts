import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBodyScrollLock, isScrollLockActive, getStableScrollPosition } from '@/hooks/useBodyScrollLock';

describe('useBodyScrollLock', () => {
  // Store original values
  let originalScrollY: number;
  let originalInnerWidth: number;
  let originalClientWidth: number;

  beforeEach(() => {
    // Store originals
    originalScrollY = window.scrollY;
    originalInnerWidth = window.innerWidth;
    originalClientWidth = document.documentElement.clientWidth;

    // Reset global state
    window.__scrollLockActive = undefined;
    window.__stableScrollPosition = undefined;
    window.__scrollTrackingInitialized = undefined;

    // Mock window properties
    Object.defineProperty(window, 'scrollY', {
      value: 500,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'innerWidth', {
      value: 1280,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1274, // 6px scrollbar
      writable: true,
      configurable: true,
    });

    // Reset body styles
    document.body.style.cssText = '';

    // Mock scrollTo
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

    // Mock getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === document.body) {
        return {
          paddingRight: '0px',
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
  });

  afterEach(() => {
    // Restore mocks
    vi.restoreAllMocks();

    // Restore originals
    Object.defineProperty(window, 'scrollY', {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: originalClientWidth,
      writable: true,
      configurable: true,
    });

    // Reset body styles
    document.body.style.cssText = '';

    // Clear global state
    window.__scrollLockActive = undefined;
    window.__stableScrollPosition = undefined;
  });

  describe('isScrollLockActive', () => {
    it('returns false when scroll lock is not active', () => {
      window.__scrollLockActive = undefined;
      expect(isScrollLockActive()).toBe(false);
    });

    it('returns false when scroll lock is explicitly false', () => {
      window.__scrollLockActive = false;
      expect(isScrollLockActive()).toBe(false);
    });

    it('returns true when scroll lock is active', () => {
      window.__scrollLockActive = true;
      expect(isScrollLockActive()).toBe(true);
    });
  });

  describe('getStableScrollPosition', () => {
    it('returns stored stable position when available', () => {
      window.__stableScrollPosition = 300;
      expect(getStableScrollPosition()).toBe(300);
    });

    it('returns current scrollY when stable position not set', () => {
      window.__stableScrollPosition = undefined;
      expect(getStableScrollPosition()).toBe(500); // mocked scrollY
    });
  });

  describe('useBodyScrollLock hook', () => {
    it('does nothing when isLocked is false', () => {
      const { result } = renderHook(() => useBodyScrollLock(false));

      expect(document.body.style.position).toBe('');
      expect(window.__scrollLockActive).toBeFalsy();
    });

    it('sets global scroll lock flag when locked', () => {
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(window.__scrollLockActive).toBe(true);
    });

    it('applies position:fixed to body when locked', () => {
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.position).toBe('fixed');
    });

    it('sets correct top offset based on scroll position', () => {
      window.__stableScrollPosition = 500;
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.top).toBe('-500px');
    });

    it('sets overflow:hidden on body when locked', () => {
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('sets width:100% on body when locked', () => {
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.width).toBe('100%');
    });

    it('adds scrollbar width compensation as padding-right', () => {
      // Scrollbar width = innerWidth - clientWidth = 1280 - 1274 = 6px
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.paddingRight).toBe('6px');
    });

    it('does not add padding when no scrollbar present', () => {
      // Set clientWidth equal to innerWidth (no scrollbar)
      Object.defineProperty(document.documentElement, 'clientWidth', {
        value: 1280,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.paddingRight).toBe('');
    });

    it('restores body styles on unlock', () => {
      const { result, rerender } = renderHook(
        ({ isLocked }) => useBodyScrollLock(isLocked),
        { initialProps: { isLocked: true } }
      );

      // Verify locked state
      expect(document.body.style.position).toBe('fixed');

      // Unlock
      rerender({ isLocked: false });

      // Verify styles restored
      expect(document.body.style.position).toBe('');
      expect(document.body.style.top).toBe('');
      expect(document.body.style.overflow).toBe('');
      expect(document.body.style.paddingRight).toBe('');
    });

    it('restores scroll position on unlock', () => {
      window.__stableScrollPosition = 500;

      const { result, rerender } = renderHook(
        ({ isLocked }) => useBodyScrollLock(isLocked),
        { initialProps: { isLocked: true } }
      );

      // Unlock
      rerender({ isLocked: false });

      // Verify scrollTo was called with saved position
      expect(window.scrollTo).toHaveBeenCalledWith(0, 500);
    });

    it('clears scroll lock flag on unlock', () => {
      const { result, rerender } = renderHook(
        ({ isLocked }) => useBodyScrollLock(isLocked),
        { initialProps: { isLocked: true } }
      );

      expect(window.__scrollLockActive).toBe(true);

      rerender({ isLocked: false });

      expect(window.__scrollLockActive).toBe(false);
    });

    it('updates stable scroll position on unlock', () => {
      window.__stableScrollPosition = 500;

      const { result, rerender } = renderHook(
        ({ isLocked }) => useBodyScrollLock(isLocked),
        { initialProps: { isLocked: true } }
      );

      rerender({ isLocked: false });

      // Should update stable position to match restored position
      expect(window.__stableScrollPosition).toBe(500);
    });

    it('handles multiple lock/unlock cycles', () => {
      const { result, rerender } = renderHook(
        ({ isLocked }) => useBodyScrollLock(isLocked),
        { initialProps: { isLocked: false } }
      );

      // First lock
      rerender({ isLocked: true });
      expect(document.body.style.position).toBe('fixed');
      expect(window.__scrollLockActive).toBe(true);

      // First unlock
      rerender({ isLocked: false });
      expect(document.body.style.position).toBe('');
      expect(window.__scrollLockActive).toBe(false);

      // Second lock
      rerender({ isLocked: true });
      expect(document.body.style.position).toBe('fixed');
      expect(window.__scrollLockActive).toBe(true);

      // Second unlock
      rerender({ isLocked: false });
      expect(document.body.style.position).toBe('');
      expect(window.__scrollLockActive).toBe(false);
    });
  });

  describe('scrollbar compensation', () => {
    it('calculates correct scrollbar width', () => {
      // innerWidth = 1280, clientWidth = 1274, scrollbar = 6px
      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.paddingRight).toBe('6px');
    });

    it('adds to existing padding-right', () => {
      // Mock existing padding
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        if (element === document.body) {
          return {
            paddingRight: '16px',
          } as CSSStyleDeclaration;
        }
        return {} as CSSStyleDeclaration;
      });

      const { result } = renderHook(() => useBodyScrollLock(true));

      // Should be original 16px + 6px scrollbar = 22px
      expect(document.body.style.paddingRight).toBe('22px');
    });

    it('handles zero scrollbar width (overlay scrollbars)', () => {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        value: 1280, // Same as innerWidth = no scrollbar
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useBodyScrollLock(true));

      // Should not add padding when scrollbar width is 0
      expect(document.body.style.paddingRight).toBe('');
    });
  });

  describe('stable scroll position tracking', () => {
    it('uses stable position over current scrollY', () => {
      window.__stableScrollPosition = 300;
      Object.defineProperty(window, 'scrollY', {
        value: 100, // Different from stable position
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useBodyScrollLock(true));

      // Should use stable position (300), not current scrollY (100)
      expect(document.body.style.top).toBe('-300px');
    });

    it('falls back to scrollY when stable position not set', () => {
      window.__stableScrollPosition = undefined;
      Object.defineProperty(window, 'scrollY', {
        value: 750,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useBodyScrollLock(true));

      expect(document.body.style.top).toBe('-750px');
    });
  });
});
