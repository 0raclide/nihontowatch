'use client';

import { useState, useCallback, useEffect } from 'react';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import type {
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  NotificationFrequency,
} from '@/types';

interface UseSavedSearchesOptions {
  activeOnly?: boolean;
  withNotifications?: boolean;
  autoFetch?: boolean;
}

interface UseSavedSearchesReturn {
  savedSearches: SavedSearch[];
  isLoading: boolean;
  error: string | null;
  fetchSavedSearches: () => Promise<void>;
  createSavedSearch: (input: CreateSavedSearchInput) => Promise<SavedSearch | null>;
  toggleSavedSearch: (id: string, isActive: boolean) => Promise<SavedSearch | null>;
  updateSavedSearch: (id: string, updates: UpdateSavedSearchInput) => Promise<SavedSearch | null>;
  updateNotificationFrequency: (id: string, frequency: NotificationFrequency) => Promise<SavedSearch | null>;
  deleteSavedSearch: (id: string) => Promise<boolean>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useSavedSearches(
  options: UseSavedSearchesOptions = {}
): UseSavedSearchesReturn {
  const { activeOnly = false, withNotifications = false, autoFetch = true } = options;

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const activity = useActivityTrackerOptional();

  // Fetch saved searches
  const fetchSavedSearches = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set('active', 'true');
      if (withNotifications) params.set('withNotifications', 'true');

      const url = `/api/saved-searches${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved searches');
      }

      setSavedSearches(data.savedSearches || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setSavedSearches([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly, withNotifications]);

  // Auto-fetch on mount and when options change
  useEffect(() => {
    if (autoFetch) {
      fetchSavedSearches();
    }
  }, [autoFetch, fetchSavedSearches]);

  // Create saved search
  const createSavedSearch = useCallback(
    async (input: CreateSavedSearchInput): Promise<SavedSearch | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch('/api/saved-searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create saved search');
        }

        // Add to local state
        setSavedSearches((prev) => [data.savedSearch, ...prev]);

        // Track alert creation
        activity?.trackAlertAction(
          'create',
          data.savedSearch.id,
          input.notification_frequency || 'none',
          input.search_criteria as Record<string, unknown> | undefined
        );

        return data.savedSearch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [activity]
  );

  // Toggle saved search active state
  const toggleSavedSearch = useCallback(
    async (id: string, isActive: boolean): Promise<SavedSearch | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch('/api/saved-searches', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_active: isActive }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update saved search');
        }

        // Update local state
        setSavedSearches((prev) =>
          prev.map((search) => (search.id === id ? data.savedSearch : search))
        );
        return data.savedSearch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  // Update saved search
  const updateSavedSearch = useCallback(
    async (id: string, updates: UpdateSavedSearchInput): Promise<SavedSearch | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch('/api/saved-searches', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update saved search');
        }

        // Update local state
        setSavedSearches((prev) =>
          prev.map((search) => (search.id === id ? data.savedSearch : search))
        );
        return data.savedSearch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  // Update notification frequency (convenience method)
  const updateNotificationFrequency = useCallback(
    async (id: string, frequency: NotificationFrequency): Promise<SavedSearch | null> => {
      return updateSavedSearch(id, { notification_frequency: frequency });
    },
    [updateSavedSearch]
  );

  // Delete saved search
  const deleteSavedSearch = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/saved-searches?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete saved search');
      }

      // Remove from local state
      setSavedSearches((prev) => prev.filter((search) => search.id !== id));

      // Track alert deletion
      activity?.trackAlertAction('delete', id);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [activity]);

  return {
    savedSearches,
    isLoading,
    error,
    fetchSavedSearches,
    createSavedSearch,
    toggleSavedSearch,
    updateSavedSearch,
    updateNotificationFrequency,
    deleteSavedSearch,
    isCreating,
    isUpdating,
    isDeleting,
  };
}
