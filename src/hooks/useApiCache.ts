'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Simple API caching hook with in-memory cache and request deduplication.
 *
 * Features:
 * - Module-level cache shared across hook instances
 * - Request deduplication (same URL won't trigger multiple fetches)
 * - Configurable TTL (default 5 minutes)
 * - Stale-while-revalidate pattern
 *
 * This is a lightweight alternative to TanStack Query for basic caching needs.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UseApiCacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Whether to fetch on mount (default: true) */
  enabled?: boolean;
  /** Stale-while-revalidate: return stale data while fetching fresh (default: true) */
  staleWhileRevalidate?: boolean;
}

interface UseApiCacheReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  /** Manually refetch data, bypassing cache */
  refetch: () => Promise<void>;
  /** Check if the current data is stale */
  isStale: boolean;
}

// Module-level cache - survives component remounts
const cache = new Map<string, CacheEntry<unknown>>();
// Track in-flight requests to avoid duplicates
const pendingRequests = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear all cached data (useful for testing or logout)
 */
export function clearApiCache(): void {
  cache.clear();
}

/**
 * Clear a specific cache entry by URL
 */
export function invalidateCache(url: string): void {
  cache.delete(url);
}

/**
 * Hook for fetching and caching API data.
 *
 * @param url - The URL to fetch
 * @param options - Cache configuration options
 * @returns Object with data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useApiCache<Listing>('/api/listing/123');
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <ListingCard listing={data} />;
 * ```
 */
export function useApiCache<T>(
  url: string | null,
  options: UseApiCacheOptions = {}
): UseApiCacheReturn<T> {
  const {
    ttl = DEFAULT_TTL,
    enabled = true,
    staleWhileRevalidate = true,
  } = options;

  const [data, setData] = useState<T | null>(() => {
    // Initialize with cached data if available
    if (url) {
      const cached = cache.get(url);
      if (cached) {
        return cached.data as T;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!data && enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (bypassCache = false) => {
    if (!url || !enabled) return;

    const now = Date.now();
    const cached = cache.get(url);
    const isFresh = cached && (now - cached.timestamp < ttl);

    // Return fresh cached data
    if (isFresh && !bypassCache) {
      if (isMountedRef.current) {
        setData(cached.data as T);
        setIsLoading(false);
        setIsStale(false);
      }
      return;
    }

    // Stale-while-revalidate: return stale data immediately, then fetch
    if (cached && staleWhileRevalidate && !bypassCache) {
      if (isMountedRef.current) {
        setData(cached.data as T);
        setIsStale(true);
      }
    }

    // Check for pending request to avoid duplicates
    const pending = pendingRequests.get(url);
    if (pending) {
      try {
        const result = await pending;
        if (isMountedRef.current) {
          setData(result as T);
          setIsLoading(false);
          setIsStale(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsLoading(false);
        }
      }
      return;
    }

    // Only show loading if we don't have stale data
    if (!cached || !staleWhileRevalidate) {
      if (isMountedRef.current) {
        setIsLoading(true);
      }
    }

    // Create and track the fetch request
    const fetchPromise = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        return json;
      })
      .finally(() => {
        pendingRequests.delete(url);
      });

    pendingRequests.set(url, fetchPromise);

    try {
      const result = await fetchPromise;

      // Update cache
      cache.set(url, { data: result, timestamp: Date.now() });

      if (isMountedRef.current) {
        setData(result as T);
        setError(null);
        setIsStale(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // Keep stale data on error if available
        if (!cached) {
          setData(null);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [url, enabled, ttl, staleWhileRevalidate]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    isStale,
  };
}
