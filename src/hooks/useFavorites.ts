'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Listing {
  id: string;
  url: string;
  title: string;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
  images: string[] | null;
  first_seen_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
}

interface FavoriteItem {
  favoriteId: number;
  favoritedAt: string;
  listing: Listing;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  favoriteIds: Set<number>;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface UseFavoritesReturn extends FavoritesState {
  addFavorite: (listingId: number) => Promise<boolean>;
  removeFavorite: (listingId: number) => Promise<boolean>;
  isFavorited: (listingId: number) => boolean;
  toggleFavorite: (listingId: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useFavorites(): UseFavoritesReturn {
  const [state, setState] = useState<FavoritesState>({
    favorites: [],
    favoriteIds: new Set(),
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Check authentication and fetch favorites on mount
  const fetchFavorites = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          favorites: [],
          favoriteIds: new Set(),
        }));
        return;
      }

      setState(prev => ({ ...prev, isAuthenticated: true }));

      const response = await fetch('/api/favorites');

      if (!response.ok) {
        if (response.status === 401) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
          }));
          return;
        }
        throw new Error('Failed to fetch favorites');
      }

      const data = await response.json();

      setState({
        favorites: data.favorites || [],
        favoriteIds: new Set(data.favoriteIds || []),
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Error fetching favorites:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Listen for auth state changes
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN') {
          fetchFavorites();
        } else if (event === 'SIGNED_OUT') {
          setState({
            favorites: [],
            favoriteIds: new Set(),
            isLoading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchFavorites]);

  const addFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (!state.isAuthenticated) {
      return false;
    }

    // Optimistic update
    setState(prev => ({
      ...prev,
      favoriteIds: new Set([...prev.favoriteIds, listingId]),
    }));

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      if (!response.ok) {
        // Revert optimistic update
        setState(prev => {
          const newIds = new Set(prev.favoriteIds);
          newIds.delete(listingId);
          return { ...prev, favoriteIds: newIds };
        });
        return false;
      }

      // Refetch to get the full listing data
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      // Revert optimistic update
      setState(prev => {
        const newIds = new Set(prev.favoriteIds);
        newIds.delete(listingId);
        return { ...prev, favoriteIds: newIds };
      });
      return false;
    }
  }, [state.isAuthenticated, fetchFavorites]);

  const removeFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (!state.isAuthenticated) {
      return false;
    }

    // Optimistic update
    setState(prev => {
      const newIds = new Set(prev.favoriteIds);
      newIds.delete(listingId);
      return {
        ...prev,
        favoriteIds: newIds,
        favorites: prev.favorites.filter(f => f.listing?.id !== String(listingId)),
      };
    });

    try {
      const response = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      if (!response.ok) {
        // Revert optimistic update - refetch to restore state
        await fetchFavorites();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      // Revert optimistic update
      await fetchFavorites();
      return false;
    }
  }, [state.isAuthenticated, fetchFavorites]);

  const isFavorited = useCallback((listingId: number): boolean => {
    return state.favoriteIds.has(listingId);
  }, [state.favoriteIds]);

  const toggleFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (isFavorited(listingId)) {
      return removeFavorite(listingId);
    } else {
      return addFavorite(listingId);
    }
  }, [isFavorited, addFavorite, removeFavorite]);

  return useMemo(() => ({
    ...state,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    refetch: fetchFavorites,
  }), [state, addFavorite, removeFavorite, isFavorited, toggleFavorite, fetchFavorites]);
}
