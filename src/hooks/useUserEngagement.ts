import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES - Based on API response shapes
// =============================================================================

// Overview types
interface UserMetrics {
  total: number;
  newInPeriod: number;
  newPrevPeriod: number;
  changePercent: number;
  activeToday: number;
  activeInPeriod: number;
}

interface SessionMetrics {
  total: number;
  avgDurationSeconds: number;
  avgPageViews: number;
  bounceRate: number;
  totalPrevPeriod: number;
  changePercent: number;
}

interface EngagementMetrics {
  totalViews: number;
  totalSearches: number;
  totalFavorites: number;
  viewsPrevPeriod: number;
  searchesPrevPeriod: number;
  favoritesPrevPeriod: number;
}

export interface EngagementOverview {
  users: UserMetrics;
  sessions: SessionMetrics;
  engagement: EngagementMetrics;
  asOf: string;
  period: string;
}

// Growth types
export interface GrowthDataPoint {
  date: string;
  newUsers: number;
  cumulativeUsers: number;
}

interface GrowthSummary {
  totalNewUsers: number;
  avgDailySignups: number;
  peakDay: string;
  peakCount: number;
}

export interface GrowthData {
  dataPoints: GrowthDataPoint[];
  summary: GrowthSummary;
  period: string;
  granularity: string;
}

// Searches types
export interface SearchTermData {
  term: string;
  count: number;
  uniqueUsers: number;
  avgResultCount: number;
  clickThroughRate: number;
}

interface SearchesTotals {
  totalSearches: number;
  uniqueSearchers: number;
  avgClickThroughRate: number;
}

export interface SearchesData {
  searches: SearchTermData[];
  totals: SearchesTotals;
  period: string;
}

// Funnel types
export type FunnelStageId = 'visitors' | 'searchers' | 'viewers' | 'engagers' | 'high_intent' | 'converted';

export interface FunnelStage {
  stage: FunnelStageId;
  label: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  overallConversionRate: number;
  period: string;
}

// Top Listings types
export interface TopListing {
  id: number;
  title: string;
  itemType: string;
  dealerName: string;
  views: number;
  uniqueViewers: number;
  favorites: number;
  priceJPY: number | null;
}

export interface TopListingsData {
  listings: TopListing[];
  period: string;
  sortedBy: string;
}

// =============================================================================
// HOOK TYPES
// =============================================================================

/**
 * All user engagement data aggregated in one interface
 */
export interface UserEngagementData {
  overview: EngagementOverview | null;
  growth: GrowthData | null;
  searches: SearchesData | null;
  funnel: FunnelData | null;
  topListings: TopListingsData | null;
}

/**
 * Loading state for each data type
 */
export interface LoadingState {
  overview: boolean;
  growth: boolean;
  searches: boolean;
  funnel: boolean;
  topListings: boolean;
}

/**
 * Error state for each data type
 */
export interface ErrorState {
  overview: string | null;
  growth: string | null;
  searches: string | null;
  funnel: string | null;
  topListings: string | null;
}

/**
 * Options for the useUserEngagement hook
 */
export interface UseUserEngagementOptions {
  /** Time period for analytics data */
  period: '7d' | '30d' | '90d';
}

/**
 * Return type for the useUserEngagement hook
 */
export interface UseUserEngagementReturn {
  /** All user engagement data */
  data: UserEngagementData;
  /** Loading state for each data type */
  loading: LoadingState;
  /** Error state for each data type */
  errors: ErrorState;
  /** Refresh all data */
  refreshAll: () => Promise<void>;
  /** Check if any data is still loading */
  isLoading: boolean;
  /** Check if any errors occurred */
  hasErrors: boolean;
  /** Timestamp of last successful refresh */
  lastUpdated: Date | null;
}

// =============================================================================
// API HELPERS
// =============================================================================

interface AnalyticsAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Generic fetch helper for analytics API endpoints
 */
async function fetchEngagementData<T>(
  endpoint: string,
  period: string
): Promise<T> {
  const url = `${endpoint}?period=${period}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  const result: AnalyticsAPIResponse<T> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || `No data returned from ${endpoint}`);
  }

  return result.data;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Custom hook to fetch all user engagement analytics data.
 *
 * Features:
 * - Parallel fetching of all 5 engagement endpoints
 * - Individual loading and error states per endpoint
 * - Period-based data refresh
 * - Timestamp tracking for last successful update
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   loading,
 *   errors,
 *   refreshAll,
 *   isLoading,
 *   lastUpdated
 * } = useUserEngagement({ period: '30d' });
 * ```
 */
export function useUserEngagement(
  options: UseUserEngagementOptions
): UseUserEngagementReturn {
  const { period } = options;

  // Data state
  const [data, setData] = useState<UserEngagementData>({
    overview: null,
    growth: null,
    searches: null,
    funnel: null,
    topListings: null,
  });

  // Loading state
  const [loading, setLoading] = useState<LoadingState>({
    overview: true,
    growth: true,
    searches: true,
    funnel: true,
    topListings: true,
  });

  // Error state
  const [errors, setErrors] = useState<ErrorState>({
    overview: null,
    growth: null,
    searches: null,
    funnel: null,
    topListings: null,
  });

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    setLoading((prev) => ({ ...prev, overview: true }));
    setErrors((prev) => ({ ...prev, overview: null }));

    try {
      const result = await fetchEngagementData<EngagementOverview>(
        '/api/admin/analytics/engagement/overview',
        period
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, overview: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          overview: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, overview: false }));
      }
    }
  }, [period]);

  // Fetch growth data
  const fetchGrowth = useCallback(async () => {
    setLoading((prev) => ({ ...prev, growth: true }));
    setErrors((prev) => ({ ...prev, growth: null }));

    try {
      const result = await fetchEngagementData<GrowthData>(
        '/api/admin/analytics/engagement/growth',
        period
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, growth: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          growth: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, growth: false }));
      }
    }
  }, [period]);

  // Fetch searches data
  const fetchSearches = useCallback(async () => {
    setLoading((prev) => ({ ...prev, searches: true }));
    setErrors((prev) => ({ ...prev, searches: null }));

    try {
      const result = await fetchEngagementData<SearchesData>(
        '/api/admin/analytics/engagement/searches',
        period
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, searches: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          searches: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, searches: false }));
      }
    }
  }, [period]);

  // Fetch funnel data
  const fetchFunnel = useCallback(async () => {
    setLoading((prev) => ({ ...prev, funnel: true }));
    setErrors((prev) => ({ ...prev, funnel: null }));

    try {
      const result = await fetchEngagementData<FunnelData>(
        '/api/admin/analytics/engagement/funnel',
        period
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, funnel: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          funnel: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, funnel: false }));
      }
    }
  }, [period]);

  // Fetch top listings data
  const fetchTopListings = useCallback(async () => {
    setLoading((prev) => ({ ...prev, topListings: true }));
    setErrors((prev) => ({ ...prev, topListings: null }));

    try {
      const result = await fetchEngagementData<TopListingsData>(
        '/api/admin/analytics/engagement/top-listings',
        period
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, topListings: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          topListings: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, topListings: false }));
      }
    }
  }, [period]);

  // Refresh all data in parallel
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchOverview(),
      fetchGrowth(),
      fetchSearches(),
      fetchFunnel(),
      fetchTopListings(),
    ]);

    if (isMountedRef.current) {
      setLastUpdated(new Date());
    }
  }, [
    fetchOverview,
    fetchGrowth,
    fetchSearches,
    fetchFunnel,
    fetchTopListings,
  ]);

  // Fetch data on mount and when period changes
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Computed values
  const isLoading = Object.values(loading).some(Boolean);
  const hasErrors = Object.values(errors).some(Boolean);

  return {
    data,
    loading,
    errors,
    refreshAll,
    isLoading,
    hasErrors,
    lastUpdated,
  };
}
