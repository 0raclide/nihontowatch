import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollPositionLock } from '@/hooks/useScrollPositionLock';

describe('useScrollPositionLock', () => {
  const mockScrollTo = vi.fn();
  let originalScrollY: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Save original scrollY descriptor
    originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', {
      value: 500,
      writable: true,
      configurable: true,
    });

    // Mock window.scrollTo
    window.scrollTo = mockScrollTo;
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Restore original scrollY
    if (originalScrollY) {
      Object.defineProperty(window, 'scrollY', originalScrollY);
    }
  });

  it('saves scroll position on lock and restores on unlock', () => {
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });

    const { result } = renderHook(() => useScrollPositionLock());

    act(() => {
      result.current.lockScrollPosition();
    });

    // Verify by unlocking - should restore to 500
    act(() => {
      result.current.unlockScrollPosition();
    });

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 500,
      behavior: 'instant',
    });
  });

  it('restores scroll position on unlock', () => {
    Object.defineProperty(window, 'scrollY', { value: 750, configurable: true });

    const { result } = renderHook(() => useScrollPositionLock());

    act(() => {
      result.current.lockScrollPosition();
    });

    act(() => {
      result.current.unlockScrollPosition();
    });

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 750,
      behavior: 'instant',
    });
  });

  it('handles multiple lock calls (idempotent)', () => {
    // Start at position 100
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });

    const { result } = renderHook(() => useScrollPositionLock());

    // First lock at 100
    act(() => {
      result.current.lockScrollPosition();
    });

    // Scroll to 200
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });

    // Second lock should NOT overwrite the saved position
    act(() => {
      result.current.lockScrollPosition();
    });

    // Unlock should restore to original 100, not 200
    act(() => {
      result.current.unlockScrollPosition();
    });

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 100,
      behavior: 'instant',
    });
  });

  it('handles unlock without lock (no-op)', () => {
    const { result } = renderHook(() => useScrollPositionLock());

    // Unlock without ever locking
    act(() => {
      result.current.unlockScrollPosition();
    });

    // Should not call scrollTo
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('uses instant scroll behavior', () => {
    const { result } = renderHook(() => useScrollPositionLock());

    act(() => {
      result.current.lockScrollPosition();
    });

    act(() => {
      result.current.unlockScrollPosition();
    });

    // Verify instant behavior (not smooth)
    expect(mockScrollTo).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'instant',
      })
    );
  });

  it('resets lock state after unlock', () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });

    const { result } = renderHook(() => useScrollPositionLock());

    // Lock and unlock
    act(() => {
      result.current.lockScrollPosition();
    });
    act(() => {
      result.current.unlockScrollPosition();
    });

    expect(mockScrollTo).toHaveBeenCalledTimes(1);

    // Now scroll to new position
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });

    // Lock again (should save new position)
    act(() => {
      result.current.lockScrollPosition();
    });
    act(() => {
      result.current.unlockScrollPosition();
    });

    // Should have scrolled to 600 this time
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(mockScrollTo).toHaveBeenLastCalledWith({
      top: 600,
      behavior: 'instant',
    });
  });

  it('handles zero scroll position correctly', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    const { result } = renderHook(() => useScrollPositionLock());

    act(() => {
      result.current.lockScrollPosition();
    });

    act(() => {
      result.current.unlockScrollPosition();
    });

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'instant',
    });
  });
});
