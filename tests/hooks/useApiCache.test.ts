import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiCache, clearApiCache, invalidateCache } from '@/hooks/useApiCache';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useApiCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    // Default mock implementation to prevent unhandled rejections during cleanup
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );
    clearApiCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic functionality', () => {
    it('fetches data on mount', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useApiCache<typeof mockData>('/api/test'));

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useApiCache('/api/error'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useApiCache('/api/network-error'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Network error');
    });

    it('does not fetch when URL is null', () => {
      renderHook(() => useApiCache(null));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not fetch when enabled is false', () => {
      renderHook(() => useApiCache('/api/test', { enabled: false }));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Caching behavior', () => {
    it('returns cached data on subsequent calls', async () => {
      const mockData = { id: 1, name: 'Cached' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result: result1 } = renderHook(() => useApiCache<typeof mockData>('/api/cached'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result1.current.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second hook with same URL should use cache
      const { result: result2 } = renderHook(() => useApiCache<typeof mockData>('/api/cached'));

      expect(result2.current.data).toEqual(mockData);
      expect(result2.current.isLoading).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses fresh cache without refetching', async () => {
      const mockData = { id: 1, version: 1 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() =>
        useApiCache<typeof mockData>('/api/ttl-fresh', { ttl: 5000 })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual(mockData);

      // Second hook with same URL - should use cache
      mockFetch.mockClear();
      const { result: result2 } = renderHook(() =>
        useApiCache<typeof mockData>('/api/ttl-fresh', { ttl: 5000 })
      );

      expect(result2.current.data).toEqual(mockData);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Refetch functionality', () => {
    it('allows manual refetch', async () => {
      const mockData1 = { id: 1, version: 1 };
      const mockData2 = { id: 1, version: 2 };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData2),
        });

      const { result } = renderHook(() => useApiCache<typeof mockData1>('/api/refetch'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual(mockData1);

      // Manual refetch
      await act(async () => {
        result.current.refetch();
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual(mockData2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache management', () => {
    it('clearApiCache clears all cached data', async () => {
      const mockData = { id: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useApiCache<typeof mockData>('/api/clear-test'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual(mockData);

      // Clear cache
      clearApiCache();

      // New hook should fetch again
      mockFetch.mockClear();
      const { result: result2 } = renderHook(() => useApiCache<typeof mockData>('/api/clear-test'));

      expect(result2.current.isLoading).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache clears specific URL', async () => {
      const mockData1 = { id: 1, url: 'url1' };
      const mockData2 = { id: 2, url: 'url2' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData2),
        });

      // Cache two URLs
      renderHook(() => useApiCache('/api/url1'));
      renderHook(() => useApiCache('/api/url2'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Invalidate only url1
      invalidateCache('/api/url1');

      // url1 should need refetch, url2 should still be cached
      mockFetch.mockClear();

      const { result: result1b } = renderHook(() => useApiCache('/api/url1'));
      expect(result1b.current.isLoading).toBe(true);

      const { result: result2b } = renderHook(() => useApiCache('/api/url2'));
      expect(result2b.current.data).toEqual(mockData2);
    });
  });

  describe('Return values', () => {
    it('returns isStale flag', async () => {
      const mockData = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useApiCache<typeof mockData>('/api/stale-test'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Fresh data should not be stale
      expect(result.current.isStale).toBe(false);
      expect(result.current.data).toEqual(mockData);
    });

    it('returns refetch function', async () => {
      const mockData = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useApiCache<typeof mockData>('/api/refetch-fn'));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });
});
