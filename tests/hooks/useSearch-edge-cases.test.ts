/**
 * Edge Case Tests for useSearch Hook
 *
 * Tests for rapid input handling, race conditions, network errors,
 * memory leaks, and concurrent hook instances.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearch } from '@/hooks/useSearch';

// =============================================================================
// MOCKS
// =============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
function createMockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

// Helper to create delayed response
function createDelayedResponse(data: unknown, delayMs: number, ok = true) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(createMockResponse(data, ok));
    }, delayMs);
  });
}

// =============================================================================
// TEST SETUP
// =============================================================================

describe('useSearch Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();

    // Default successful response
    mockFetch.mockResolvedValue(
      createMockResponse({
        suggestions: [],
        total: 0,
        query: '',
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // RAPID INPUT TESTS
  // ===========================================================================

  describe('Rapid Input', () => {
    it('handles rapid typing without race conditions', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 300, minQueryLength: 2 })
      );

      // Type rapidly (faster than debounce)
      act(() => {
        result.current.setQuery('k');
      });
      act(() => {
        result.current.setQuery('ka');
      });
      act(() => {
        result.current.setQuery('kat');
      });
      act(() => {
        result.current.setQuery('kata');
      });
      act(() => {
        result.current.setQuery('katan');
      });
      act(() => {
        result.current.setQuery('katana');
      });

      // Before debounce, no requests should be made
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should only make ONE request for the final value
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=katana'),
        expect.any(Object)
      );
    });

    it('debounces properly with intermediate pauses', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 300, minQueryLength: 2 })
      );

      // Type, pause, type more
      act(() => {
        result.current.setQuery('ka');
      });

      // Wait 100ms (not enough for debounce)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('kata');
      });

      // Wait another 100ms (still not enough)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // No request yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Now wait the full debounce period
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should request with final value
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=kata'),
        expect.any(Object)
      );
    });

    it('cancels in-flight requests on new input', async () => {
      const abortSignals: AbortSignal[] = [];

      mockFetch.mockImplementation((url, options) => {
        if (options?.signal) {
          abortSignals.push(options.signal);
        }
        return createDelayedResponse(
          { suggestions: [], total: 0, query: '' },
          500
        );
      });

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      // First query
      act(() => {
        result.current.setQuery('kata');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // First request started
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // New input before first response completes
      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Second request started
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // First request's signal should be aborted
      expect(abortSignals[0]?.aborted).toBe(true);
    });

    it('handles very fast typing (1 char per ms)', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 300, minQueryLength: 2 })
      );

      const word = 'supercalifragilisticexpialidocious';

      // Type extremely fast
      for (let i = 1; i <= word.length; i++) {
        act(() => {
          result.current.setQuery(word.substring(0, i));
        });
        await act(async () => {
          vi.advanceTimersByTime(1);
        });
      }

      // Still no request (haven't waited full debounce)
      expect(mockFetch).not.toHaveBeenCalled();

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Only ONE request with final value
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles backspace/delete rapidly', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 300, minQueryLength: 2 })
      );

      // Type then delete
      act(() => {
        result.current.setQuery('katana');
      });
      act(() => {
        result.current.setQuery('katan');
      });
      act(() => {
        result.current.setQuery('kata');
      });
      act(() => {
        result.current.setQuery('kat');
      });
      act(() => {
        result.current.setQuery('ka');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should only request for 'ka'
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=ka'),
        expect.any(Object)
      );
    });

    it('clears suggestions when query becomes too short', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          suggestions: [{ id: '1', title: 'Test' }],
          total: 1,
          query: 'kata',
        })
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      // Type valid query
      act(() => {
        result.current.setQuery('kata');
      });

      // Advance timers and wait for fetch
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Allow async operations to complete
      await act(async () => {
        await Promise.resolve();
      });

      // Delete to make query too short
      act(() => {
        result.current.setQuery('k');
      });

      // Should clear suggestions immediately when query is too short
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.total).toBe(0);
    });
  });

  // ===========================================================================
  // NETWORK ERROR TESTS
  // ===========================================================================

  describe('Network Errors', () => {
    it('handles network timeout gracefully', async () => {
      // Test that abort errors are handled when requests are cancelled
      // The hook uses AbortController to cancel in-flight requests
      let abortSignalReceived: AbortSignal | null = null;

      mockFetch.mockImplementation((url, options) => {
        abortSignalReceived = options?.signal || null;
        // Never resolves - simulates a slow/timing out request
        return new Promise(() => {});
      });

      const { result, unmount } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('kata');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Verify that the abort signal was passed to fetch
      expect(abortSignalReceived).not.toBeNull();

      // Unmount - this should abort the request
      unmount();

      // The signal should now be aborted
      expect(abortSignalReceived?.aborted).toBe(true);
    });

    it('handles 500 server error', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ error: 'Internal Server Error' }, false, 500)
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Allow async operations to complete
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should have error state
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to fetch suggestions');
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles 404 not found', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ error: 'Not Found' }, false, 404)
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('handles network disconnect (fetch throws)', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.error?.message).toBe('Failed to fetch');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('recovers from error on new search', async () => {
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('kata');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();

      // Second request succeeds
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          suggestions: [{ id: '1', title: 'Katana' }],
          total: 1,
          query: 'katana',
        })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Error should be cleared and new results loaded
      expect(result.current.error).toBeNull();
    });

    it('handles empty response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should handle gracefully with defaults
      expect(result.current.isLoading).toBe(false);
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.total).toBe(0);
    });
  });

  // ===========================================================================
  // MEMORY LEAK TESTS
  // ===========================================================================

  describe('Memory Leaks', () => {
    it('cleans up on unmount during pending request', async () => {
      let resolveRequest: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRequest = resolve;
          })
      );

      const { result, unmount } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Request is pending
      expect(result.current.isLoading).toBe(true);

      // Unmount while request pending
      unmount();

      // Resolve the request after unmount
      resolveRequest!(
        createMockResponse({
          suggestions: [{ id: '1', title: 'Test' }],
          total: 1,
        })
      );

      // Should not throw or cause issues
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    });

    it('does not update state after unmount', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      let resolveRequest: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRequest = resolve;
          })
      );

      const { result, unmount } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Unmount
      unmount();

      // Resolve after unmount
      await act(async () => {
        resolveRequest!(
          createMockResponse({
            suggestions: [{ id: '1', title: 'Test' }],
            total: 1,
          })
        );
        await vi.runAllTimersAsync();
      });

      // Should not have React state update warning
      // (The hook should abort the request on unmount)
      consoleErrorSpy.mockRestore();
    });

    it('clears debounce timer on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { result, unmount } = renderHook(() =>
        useSearch({ debounceMs: 300, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('kata');
      });

      // Unmount before debounce completes
      unmount();

      // clearTimeout should have been called for cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('aborts controller on unmount', async () => {
      let capturedSignal: AbortSignal | null = null;

      mockFetch.mockImplementation((url, options) => {
        capturedSignal = options?.signal || null;
        return new Promise(() => {}); // Never resolves
      });

      const { result, unmount } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('katana');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(capturedSignal).not.toBeNull();

      unmount();

      // Signal should be aborted
      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  // ===========================================================================
  // CONCURRENT HOOKS TESTS
  // ===========================================================================

  describe('Concurrent Hooks', () => {
    it('multiple useSearch hooks work independently', async () => {
      mockFetch.mockImplementation(url => {
        const urlObj = new URL(url, 'http://localhost');
        const query = urlObj.searchParams.get('q');
        return Promise.resolve(
          createMockResponse({
            suggestions: [{ id: query, title: query }],
            total: 1,
            query,
          })
        );
      });

      const { result: result1 } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      const { result: result2 } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      // Set different queries
      act(() => {
        result1.current.setQuery('katana');
        result2.current.setQuery('wakizashi');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Each should have its own query
      expect(result1.current.query).toBe('katana');
      expect(result2.current.query).toBe('wakizashi');
    });

    it('hooks do not share state', async () => {
      const { result: result1 } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      const { result: result2 } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result1.current.setQuery('test');
      });

      // result2 should not be affected
      expect(result2.current.query).toBe('');
    });

    it('hooks with different options work correctly', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          suggestions: [{ id: '1', title: 'Test' }],
          total: 1,
        })
      );

      const { result: shortDebounce } = renderHook(() =>
        useSearch({ debounceMs: 50, minQueryLength: 2 })
      );

      const { result: longDebounce } = renderHook(() =>
        useSearch({ debounceMs: 500, minQueryLength: 2 })
      );

      act(() => {
        shortDebounce.current.setQuery('test');
        longDebounce.current.setQuery('test');
      });

      // After 100ms, only short debounce should have fired
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only short debounce

      // After another 500ms, long debounce should fire
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // OPTIONS EDGE CASES
  // ===========================================================================

  describe('Options Edge Cases', () => {
    it('handles zero debounce', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ suggestions: [], total: 0 })
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 0, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(0);
        await vi.runAllTimersAsync();
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles minQueryLength of 0', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ suggestions: [], total: 0 })
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 0 })
      );

      act(() => {
        result.current.setQuery('a');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      // Should search even with single character
      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles high minQueryLength', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 10 })
      );

      act(() => {
        result.current.setQuery('short');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should not search
      expect(mockFetch).not.toHaveBeenCalled();

      act(() => {
        result.current.setQuery('longenoughquery');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      // Should search now
      expect(mockFetch).toHaveBeenCalled();
    });

    it('respects maxSuggestions parameter', async () => {
      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2, maxSuggestions: 3 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=3'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // CLEAR SUGGESTIONS TESTS
  // ===========================================================================

  describe('clearSuggestions', () => {
    it('clears suggestions and keeps query', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          suggestions: [{ id: '1', title: 'Test' }],
          total: 1,
        })
      );

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      act(() => {
        result.current.clearSuggestions();
      });

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.query).toBe('test'); // Query unchanged
    });

    it('clears error state', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() =>
        useSearch({ debounceMs: 100, minQueryLength: 2 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearSuggestions();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
