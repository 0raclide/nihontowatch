import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDealerStatusChange } from '@/components/listing/quickview-slots/useDealerStatusChange';

// =============================================================================
// useDealerStatusChange — Golden Tests
//
// This hook manages dealer status changes (Mark Sold, Withdraw, Relist).
// It was extracted to fix silent API failures where the UI showed no error
// feedback on failed PATCH requests.
// =============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDealerStatusChange', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts with isUpdating=false and error=null', () => {
    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Successful status change
  // -------------------------------------------------------------------------

  it('calls PATCH with correct URL and body for SOLD', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 456, onStatusChange })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/dealer/listings/456', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SOLD' }),
    });
    expect(onStatusChange).toHaveBeenCalledWith('SOLD');
  });

  it('calls onStatusChange for WITHDRAWN', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 789, onStatusChange })
    );

    await act(async () => {
      await result.current.handleStatusChange('WITHDRAWN');
    });

    expect(onStatusChange).toHaveBeenCalledWith('WITHDRAWN');
  });

  it('calls onStatusChange for AVAILABLE (relist)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 100, onStatusChange })
    );

    await act(async () => {
      await result.current.handleStatusChange('AVAILABLE');
    });

    expect(onStatusChange).toHaveBeenCalledWith('AVAILABLE');
  });

  it('sets isUpdating during request', async () => {
    let resolvePromise: (value: any) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    // Start the status change but don't resolve yet
    let changePromise: Promise<void>;
    act(() => {
      changePromise = result.current.handleStatusChange('SOLD');
    });

    // Should be updating
    expect(result.current.isUpdating).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({ ok: true, json: async () => ({}) });
      await changePromise!;
    });

    // Should no longer be updating
    expect(result.current.isUpdating).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Error handling — GOLDEN tests (silent failures were the original bug)
  // -------------------------------------------------------------------------

  it('GOLDEN: sets error on 4xx response (prevents silent failure)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Listing not found' }),
    });
    const onStatusChange = vi.fn();

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 999, onStatusChange })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.error).toBe('Listing not found');
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('GOLDEN: sets fallback error when response.json() fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => { throw new Error('not JSON'); },
    });

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.error).toBe('Request failed');
  });

  it('GOLDEN: sets "Network error" on fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.error).toBe('Network error');
  });

  it('GOLDEN: auto-clears error after 3 seconds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed' }),
    });

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.error).toBe('Failed');

    // Advance timer by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.error).toBeNull();
  });

  it('error stays visible before 3 seconds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });

    expect(result.current.error).toBe('Server error');
  });

  // -------------------------------------------------------------------------
  // onStatusChange is optional
  // -------------------------------------------------------------------------

  it('works without onStatusChange callback', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    // Should not throw
    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isUpdating).toBe(false);
  });

  // -------------------------------------------------------------------------
  // isUpdating resets after error
  // -------------------------------------------------------------------------

  it('resets isUpdating to false after error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    const { result } = renderHook(() =>
      useDealerStatusChange({ listingId: 123 })
    );

    await act(async () => {
      await result.current.handleStatusChange('SOLD');
    });

    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBe('Network error');
  });
});
