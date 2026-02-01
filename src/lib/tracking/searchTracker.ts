/**
 * Search Tracking Client Helper
 *
 * Client-side utility for tracking search queries and click-through rates.
 * Calls POST /api/track/search and PATCH /api/track/search endpoints.
 *
 * Usage:
 *   import { trackSearch, trackSearchClick } from '@/lib/tracking/searchTracker';
 *
 *   // Track a search
 *   const searchId = await trackSearch('katana', { itemType: 'KATANA' }, 42, sessionId);
 *
 *   // Later, when user clicks a result
 *   if (searchId) {
 *     trackSearchClick(searchId, clickedListingId);
 *   }
 */

export interface SearchFilters {
  itemType?: string | string[];
  dealer?: string | string[];
  certification?: string | string[];
  priceMin?: number;
  priceMax?: number;
  [key: string]: unknown;
}

interface TrackSearchResult {
  success: boolean;
  searchId?: number;
}

/**
 * Track a search query
 *
 * @param query - The search query string
 * @param filters - Active filters during the search
 * @param resultCount - Number of results returned
 * @param sessionId - The user's session ID
 * @param userId - Optional user ID if authenticated
 *
 * @returns Promise with searchId for CTR tracking, or undefined on failure
 *
 * Note: This function never throws - tracking failures are silent
 * to avoid impacting user experience.
 */
export async function trackSearch(
  query: string,
  filters: SearchFilters | undefined,
  resultCount: number,
  sessionId: string,
  userId?: string
): Promise<number | undefined> {
  try {
    const response = await fetch('/api/track/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        filters,
        resultCount,
        sessionId,
        userId,
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    const data: TrackSearchResult = await response.json();
    return data.success ? data.searchId : undefined;
  } catch {
    // Silent failure - tracking should never break UX
    return undefined;
  }
}

/**
 * Track a click on a search result (for CTR analytics)
 *
 * @param searchId - The ID returned from trackSearch
 * @param listingId - The listing that was clicked
 *
 * @returns Promise that resolves to true if tracking succeeded
 *
 * Note: This function never throws - tracking failures are silent
 */
export async function trackSearchClick(
  searchId: number,
  listingId: number
): Promise<boolean> {
  try {
    const response = await fetch('/api/track/search', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchId,
        listingId,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success === true;
  } catch {
    // Silent failure
    return false;
  }
}

/**
 * Create a search tracker with pre-configured session/user
 *
 * Useful for creating a tracker instance that can be used throughout a component.
 *
 * @param sessionId - The user's session ID
 * @param userId - Optional user ID if authenticated
 *
 * @returns Object with trackSearch and trackClick methods
 */
export function createSearchTracker(sessionId: string, userId?: string) {
  // Store the last search ID for automatic CTR tracking
  let lastSearchId: number | undefined;

  return {
    /**
     * Track a search
     */
    async trackSearch(
      query: string,
      filters: SearchFilters | undefined,
      resultCount: number
    ): Promise<number | undefined> {
      lastSearchId = await trackSearch(query, filters, resultCount, sessionId, userId);
      return lastSearchId;
    },

    /**
     * Track a click on the last search's results
     */
    async trackClick(listingId: number): Promise<boolean> {
      if (!lastSearchId) {
        return false;
      }
      return trackSearchClick(lastSearchId, listingId);
    },

    /**
     * Track a click with explicit searchId
     */
    async trackClickWithId(searchId: number, listingId: number): Promise<boolean> {
      return trackSearchClick(searchId, listingId);
    },

    /**
     * Get the last search ID
     */
    getLastSearchId(): number | undefined {
      return lastSearchId;
    },
  };
}
