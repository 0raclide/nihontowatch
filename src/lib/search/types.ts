/**
 * Search types for Nihontowatch
 * Types for search suggestions, results, and related functionality
 */

// =============================================================================
// SEARCH SUGGESTIONS (Typeahead/Autocomplete)
// =============================================================================

/**
 * A single search suggestion returned from the suggestions API
 */
export interface SearchSuggestion {
  /** Unique listing ID */
  id: string;
  /** Listing title */
  title: string;
  /** Item type (katana, wakizashi, tsuba, etc.) */
  item_type: string | null;
  /** Price value in the listing's currency */
  price_value: number | null;
  /** Price currency code (JPY, USD, EUR) */
  price_currency: string | null;
  /** Name of the dealer */
  dealer_name: string;
  /** Dealer's domain */
  dealer_domain: string;
  /** Primary image URL for the listing */
  image_url: string | null;
  /** Direct URL to the listing */
  url: string;
  /** Certification type (Juyo, Hozon, etc.) */
  cert_type: string | null;
  /** Smith attribution (for blades) */
  smith: string | null;
  /** Tosogu maker attribution (for fittings) */
  tosogu_maker: string | null;
}

/**
 * Response from the search suggestions API endpoint
 */
export interface SearchSuggestionsResponse {
  /** Array of matching suggestions */
  suggestions: SearchSuggestion[];
  /** Total number of matches (may exceed returned suggestions) */
  total: number;
  /** The query that was searched */
  query: string;
}

// =============================================================================
// SEARCH HOOK TYPES
// =============================================================================

/**
 * Options for configuring the useSearch hook
 */
export interface UseSearchOptions {
  /** Minimum query length to trigger search (default: 2) */
  minQueryLength?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Maximum suggestions to return (default: 5) */
  maxSuggestions?: number;
}

/**
 * Return type for the useSearch hook
 */
export interface UseSearchReturn {
  /** Current search query */
  query: string;
  /** Update the search query */
  setQuery: (query: string) => void;
  /** Search suggestions */
  suggestions: SearchSuggestion[];
  /** Total number of matches */
  total: number;
  /** Whether suggestions are being fetched */
  isLoading: boolean;
  /** Error if search failed */
  error: Error | null;
  /** Clear suggestions (keeps query) */
  clearSuggestions: () => void;
}

// =============================================================================
// FULL SEARCH RESULTS (Search Page)
// =============================================================================

/**
 * Parameters for a search query
 */
export interface SearchParams {
  /** Search query string */
  query: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Full search result (for full search page, not suggestions)
 */
export interface SearchResult {
  /** Unique listing ID */
  id: number;
  /** Listing URL */
  url: string;
  /** Listing title */
  title: string;
  /** Item description */
  description: string | null;
  /** Item type */
  item_type: string | null;
  /** Price value */
  price_value: number | null;
  /** Price currency */
  price_currency: string | null;
  /** All images for the listing */
  images: string[];
  /** Dealer ID */
  dealer_id: number;
  /** Dealer name */
  dealer_name: string;
  /** Smith/maker attribution */
  smith: string | null;
  /** School attribution */
  school: string | null;
  /** Era/period */
  era: string | null;
  /** Certification type */
  cert_type: string | null;
  /** When the listing was first seen */
  first_seen_at: string;
}

/**
 * Full search response (for full search page)
 */
export interface SearchResultsResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of matches */
  total: number;
  /** Current offset */
  offset: number;
  /** Results limit used */
  limit: number;
}

// =============================================================================
// SEARCH HISTORY
// =============================================================================

/**
 * Recent search entry for search history
 */
export interface RecentSearch {
  /** The search query */
  query: string;
  /** When the search was performed */
  timestamp: number;
  /** Number of results found */
  resultCount?: number;
}
