import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MarketOverview,
  PriceDistributionResponse,
  CategoryBreakdownResponse,
  DealerBreakdownResponse,
  TrendResponse,
  PriceChangesResponse,
  AnalyticsFilters,
  AnalyticsAPIResponse,
} from '@/types/analytics';

/**
 * All market intelligence data aggregated in one interface
 */
interface MarketIntelligenceData {
  overview: MarketOverview | null;
  distribution: PriceDistributionResponse | null;
  categoryBreakdown: CategoryBreakdownResponse | null;
  dealerBreakdown: DealerBreakdownResponse | null;
  trends: TrendResponse | null;
  priceChanges: PriceChangesResponse | null;
}

/**
 * Loading state for each data type
 */
interface LoadingState {
  overview: boolean;
  distribution: boolean;
  categoryBreakdown: boolean;
  dealerBreakdown: boolean;
  trends: boolean;
  priceChanges: boolean;
}

/**
 * Error state for each data type
 */
interface ErrorState {
  overview: string | null;
  distribution: string | null;
  categoryBreakdown: string | null;
  dealerBreakdown: string | null;
  trends: string | null;
  priceChanges: string | null;
}

/**
 * Options for the useMarketIntelligence hook
 */
interface UseMarketIntelligenceOptions {
  /** Current filter state */
  filters: AnalyticsFilters;
  /** Enable auto-refresh (default: false) */
  autoRefresh?: boolean;
  /** Auto-refresh interval in milliseconds (default: 300000 - 5 minutes) */
  refreshInterval?: number;
}

/**
 * Return type for the useMarketIntelligence hook
 */
interface UseMarketIntelligenceReturn {
  /** All market intelligence data */
  data: MarketIntelligenceData;
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

/**
 * Build query string from filters
 */
function buildQueryString(
  filters: AnalyticsFilters,
  baseParams: Record<string, string> = {}
): string {
  const params = new URLSearchParams(baseParams);

  if (filters.itemType) {
    params.set('itemType', filters.itemType);
  }
  if (filters.certification) {
    params.set('certification', filters.certification);
  }
  if (filters.dealerId) {
    params.set('dealer', String(filters.dealerId));
  }
  if (filters.period) {
    params.set('period', filters.period);
  }

  return params.toString();
}

/**
 * Generic fetch helper for analytics API endpoints
 */
async function fetchAnalyticsData<T>(
  endpoint: string,
  queryString: string
): Promise<T> {
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;
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

/**
 * Custom hook to fetch all market intelligence data.
 *
 * Features:
 * - Parallel fetching of all analytics endpoints
 * - Individual loading and error states per endpoint
 * - Filter-based data refresh
 * - Optional auto-refresh with configurable interval
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
 * } = useMarketIntelligence({
 *   filters: { period: '30d', itemType: null, certification: null, dealerId: null },
 *   autoRefresh: true,
 *   refreshInterval: 300000, // 5 minutes
 * });
 * ```
 */
export function useMarketIntelligence(
  options: UseMarketIntelligenceOptions
): UseMarketIntelligenceReturn {
  const { filters, autoRefresh = false, refreshInterval = 300000 } = options;

  // Data state
  const [data, setData] = useState<MarketIntelligenceData>({
    overview: null,
    distribution: null,
    categoryBreakdown: null,
    dealerBreakdown: null,
    trends: null,
    priceChanges: null,
  });

  // Loading state
  const [loading, setLoading] = useState<LoadingState>({
    overview: true,
    distribution: true,
    categoryBreakdown: true,
    dealerBreakdown: true,
    trends: true,
    priceChanges: true,
  });

  // Error state
  const [errors, setErrors] = useState<ErrorState>({
    overview: null,
    distribution: null,
    categoryBreakdown: null,
    dealerBreakdown: null,
    trends: null,
    priceChanges: null,
  });

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Build query string based on current filters
  const queryString = buildQueryString(filters);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    setLoading((prev) => ({ ...prev, overview: true }));
    setErrors((prev) => ({ ...prev, overview: null }));

    try {
      const result = await fetchAnalyticsData<MarketOverview>(
        '/api/admin/analytics/market/overview',
        queryString
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
  }, [queryString]);

  // Fetch distribution data
  const fetchDistribution = useCallback(async () => {
    setLoading((prev) => ({ ...prev, distribution: true }));
    setErrors((prev) => ({ ...prev, distribution: null }));

    try {
      const result = await fetchAnalyticsData<PriceDistributionResponse>(
        '/api/admin/analytics/market/distribution',
        queryString
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, distribution: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          distribution: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, distribution: false }));
      }
    }
  }, [queryString]);

  // Fetch category breakdown data
  const fetchCategoryBreakdown = useCallback(async () => {
    setLoading((prev) => ({ ...prev, categoryBreakdown: true }));
    setErrors((prev) => ({ ...prev, categoryBreakdown: null }));

    try {
      const result = await fetchAnalyticsData<CategoryBreakdownResponse>(
        '/api/admin/analytics/market/breakdown',
        buildQueryString(filters, { type: 'category' })
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, categoryBreakdown: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          categoryBreakdown: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, categoryBreakdown: false }));
      }
    }
  }, [filters]);

  // Fetch dealer breakdown data
  const fetchDealerBreakdown = useCallback(async () => {
    setLoading((prev) => ({ ...prev, dealerBreakdown: true }));
    setErrors((prev) => ({ ...prev, dealerBreakdown: null }));

    try {
      const result = await fetchAnalyticsData<DealerBreakdownResponse>(
        '/api/admin/analytics/market/breakdown',
        buildQueryString(filters, { type: 'dealer' })
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, dealerBreakdown: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          dealerBreakdown: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, dealerBreakdown: false }));
      }
    }
  }, [filters]);

  // Fetch trends data
  const fetchTrends = useCallback(async () => {
    setLoading((prev) => ({ ...prev, trends: true }));
    setErrors((prev) => ({ ...prev, trends: null }));

    try {
      const result = await fetchAnalyticsData<TrendResponse>(
        '/api/admin/analytics/market/trends',
        buildQueryString(filters, { metric: 'median_price' })
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, trends: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          trends: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, trends: false }));
      }
    }
  }, [filters]);

  // Fetch price changes data
  const fetchPriceChanges = useCallback(async () => {
    setLoading((prev) => ({ ...prev, priceChanges: true }));
    setErrors((prev) => ({ ...prev, priceChanges: null }));

    try {
      const result = await fetchAnalyticsData<PriceChangesResponse>(
        '/api/admin/analytics/market/price-changes',
        queryString
      );

      if (isMountedRef.current) {
        setData((prev) => ({ ...prev, priceChanges: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          priceChanges: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, priceChanges: false }));
      }
    }
  }, [queryString]);

  // Refresh all data in parallel
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchOverview(),
      fetchDistribution(),
      fetchCategoryBreakdown(),
      fetchDealerBreakdown(),
      fetchTrends(),
      fetchPriceChanges(),
    ]);

    if (isMountedRef.current) {
      setLastUpdated(new Date());
    }
  }, [
    fetchOverview,
    fetchDistribution,
    fetchCategoryBreakdown,
    fetchDealerBreakdown,
    fetchTrends,
    fetchPriceChanges,
  ]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Set up auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      refreshAll();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, refreshAll]);

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
