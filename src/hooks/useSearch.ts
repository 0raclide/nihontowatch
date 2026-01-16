'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SEARCH } from '@/lib/constants';
import type { SearchSuggestion, UseSearchOptions, UseSearchReturn } from '@/lib/search/types';

/**
 * Hook for search with debounced suggestions
 * Fetches suggestions from the API as user types
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    minQueryLength = SEARCH.MIN_QUERY_LENGTH,
    debounceMs = SEARCH.DEBOUNCE_MS,
    maxSuggestions = 5,
  } = options;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setTotal(0);
    setError(null);
  }, []);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          q: searchQuery,
          limit: maxSuggestions.toString(),
        });

        const response = await fetch(`/api/search/suggestions?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Ignore abort errors
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setSuggestions([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    },
    [maxSuggestions]
  );

  // Debounced search effect
  useEffect(() => {
    // Clear debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Clear suggestions if query is too short
    if (query.trim().length < minQueryLength) {
      clearSuggestions();
      return;
    }

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query.trim());
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, minQueryLength, debounceMs, fetchSuggestions, clearSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    total,
    isLoading,
    error,
    clearSuggestions,
  };
}
