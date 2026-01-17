'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// ============================================================================
// Types
// ============================================================================

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

interface FavoritesContextValue {
  /** Full favorite items with listing data (for favorites page) */
  favorites: FavoriteItem[];
  /** Set of favorited listing IDs (for quick lookup) */
  favoriteIds: Set<number>;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Add a listing to favorites */
  addFavorite: (listingId: number) => Promise<boolean>;
  /** Remove a listing from favorites */
  removeFavorite: (listingId: number) => Promise<boolean>;
  /** Check if a listing is favorited */
  isFavorited: (listingId: number) => boolean;
  /** Toggle favorite status */
  toggleFavorite: (listingId: number) => Promise<boolean>;
  /** Manually refetch favorites */
  refetch: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

// Export context for direct access (used by useFavorites hook for fallback support)
export const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface FavoritesProviderProps {
  children: ReactNode;
}

// Empty arrays/sets that are stable references
const EMPTY_ARRAY: FavoriteItem[] = [];
const EMPTY_SET: Set<number> = new Set();

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<FavoriteItem[]>(EMPTY_ARRAY);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(EMPTY_SET);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  // Track the user ID we last fetched for to detect user changes
  const lastFetchedUserIdRef = useRef<string | null>(null);
  // Store user ID in a ref to avoid dependency issues
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  // Fetch favorites from API - stable callback with no external deps
  const fetchFavorites = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    const currentUserId = userIdRef.current;

    // If no user, clear favorites and return
    if (!currentUserId) {
      setFavorites(EMPTY_ARRAY);
      setFavoriteIds(EMPTY_SET);
      setIsLoading(false);
      setError(null);
      lastFetchedUserIdRef.current = null;
      return;
    }

    // If we already fetched for this user, don't refetch (unless forced)
    if (!force && lastFetchedUserIdRef.current === currentUserId) {
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setError(null);

    try {
      const response = await fetch('/api/favorites');

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated - clear state
          setFavorites(EMPTY_ARRAY);
          setFavoriteIds(EMPTY_SET);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch favorites');
      }

      const data = await response.json();

      setFavorites(data.favorites || EMPTY_ARRAY);
      setFavoriteIds(new Set(data.favoriteIds || []));
      setError(null);
      lastFetchedUserIdRef.current = currentUserId;
    } catch (err) {
      console.error('[FavoritesProvider] Error fetching favorites:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // No dependencies - uses refs for current values

  // Fetch when user ID changes
  useEffect(() => {
    const currentUserId = user?.id;
    const lastUserId = lastFetchedUserIdRef.current;

    // User changed - fetch favorites
    if (currentUserId !== lastUserId) {
      fetchFavorites();
    }
  }, [user?.id, fetchFavorites]);

  // Add a listing to favorites
  const addFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (!userIdRef.current) return false;

    // Optimistic update
    setFavoriteIds(prev => new Set([...prev, listingId]));

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      if (!response.ok) {
        // Revert optimistic update
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listingId);
          return newSet;
        });
        return false;
      }

      // Refetch to get full listing data
      await fetchFavorites(true);
      return true;
    } catch (err) {
      console.error('[FavoritesProvider] Error adding favorite:', err);
      // Revert optimistic update
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
      return false;
    }
  }, [fetchFavorites]);

  // Remove a listing from favorites
  const removeFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (!userIdRef.current) return false;

    // Optimistic update
    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(listingId);
      return newSet;
    });
    setFavorites(prev => prev.filter(f => f.listing?.id !== String(listingId)));

    try {
      const response = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      if (!response.ok) {
        // Revert by refetching
        await fetchFavorites(true);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[FavoritesProvider] Error removing favorite:', err);
      // Revert by refetching
      await fetchFavorites(true);
      return false;
    }
  }, [fetchFavorites]);

  // Check if a listing is favorited
  const isFavorited = useCallback((listingId: number): boolean => {
    return favoriteIds.has(listingId);
  }, [favoriteIds]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (listingId: number): Promise<boolean> => {
    if (isFavorited(listingId)) {
      return removeFavorite(listingId);
    } else {
      return addFavorite(listingId);
    }
  }, [isFavorited, addFavorite, removeFavorite]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchFavorites(true);
  }, [fetchFavorites]);

  const value: FavoritesContextValue = {
    favorites,
    favoriteIds,
    isLoading,
    error,
    isAuthenticated: !!user,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    refetch,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useFavoritesContext(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavoritesContext must be used within a FavoritesProvider');
  }
  return context;
}
