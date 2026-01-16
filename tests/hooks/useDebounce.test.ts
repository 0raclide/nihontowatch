import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Update value
    rerender({ value: 'updated' });

    // Before delay, value should still be initial
    expect(result.current).toBe('initial');

    // After delay, value should be updated
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'v1' } }
    );

    // Rapid value changes
    rerender({ value: 'v2' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'v3' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'v4' });

    // Value should still be initial (timer keeps resetting)
    expect(result.current).toBe('v1');

    // After waiting the full delay, should be the latest value
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('v4');
  });

  it('handles different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // At 300ms, still initial
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    // At 500ms, should be updated
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('updated');
  });

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);
  });

  it('works with object values', () => {
    const initial = { name: 'initial' };
    const updated = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: initial } }
    );

    rerender({ value: updated });
    expect(result.current).toBe(initial);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(updated);
  });

  it('works with null values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' as string | null } }
    );

    rerender({ value: null });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(null);
  });

  it('cleans up timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useDebounce('value', 300));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Even with 0 delay, needs to advance timers
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('updated');
  });

  it('maintains value during intermediate changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    // Change to 'b', wait halfway
    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Change to 'c', wait full delay
    rerender({ value: 'c' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should be 'c', not 'b'
    expect(result.current).toBe('c');
  });

  it('handles same value updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'same' } }
    );

    // Re-render with same value
    rerender({ value: 'same' });
    expect(result.current).toBe('same');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('same');
  });
});
