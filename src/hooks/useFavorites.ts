'use client';

import { useContext } from 'react';
import { FavoritesContext } from '@/contexts/FavoritesContext';

// Fallback values when provider is not available
const fallbackValue = {
  favorites: [],
  favoriteIds: new Set<number>(),
  isLoading: false,
  error: null,
  isAuthenticated: false,
  addFavorite: async () => false,
  removeFavorite: async () => false,
  isFavorited: () => false,
  toggleFavorite: async () => false,
  refetch: async () => {},
};

/**
 * Hook to access favorites functionality.
 *
 * This is a thin wrapper around FavoritesContext for backward compatibility.
 * All state is managed centrally in FavoritesProvider - this hook just
 * provides a convenient interface.
 *
 * Returns a no-op fallback if used outside of FavoritesProvider (for graceful degradation).
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isFavorited, toggleFavorite } = useFavorites();
 *
 *   return (
 *     <button onClick={() => toggleFavorite(listingId)}>
 *       {isFavorited(listingId) ? 'Unfavorite' : 'Favorite'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useFavorites() {
  const context = useContext(FavoritesContext);
  // Return fallback if provider not available (graceful degradation)
  return context ?? fallbackValue;
}
