/**
 * useMarketIntelligence Hook Unit Tests
 *
 * Tests the custom hook for fetching market intelligence data.
 * Verifies data fetching, loading states, error handling, and auto-refresh.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { DEFAULT_ANALYTICS_FILTERS } from '@/types/analytics';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock response
function createMockResponse<T>(data: T, success = true) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        success,
        data: success ? data : undefined,
        error: success ? undefined : 'Error occurred',
        timestamp: new Date().toISOString(),
      }),
  };
}

// Helper to create failed response
function createFailedResponse(status = 500, statusText = 'Internal Server Error') {
  return {
    ok: false,
    status,
    statusText,
    json: () =>
      Promise.resolve({
        success: false,
        error: statusText,
        timestamp: new Date().toISOString(),
      }),
  };
}

// Mock data
const mockOverview = {
  asOf: '2026-01-15T12:00:00Z',
  totalListings: 5000,
  availableListings: 3000,
  soldListings: 2000,
  totalMarketValue: 15000000000,
  currency: 'JPY',
  medianPrice: 1500000,
  averagePrice: 2000000,
  priceRange: { min: 50000, max: 100000000 },
  percentiles: { p10: 200000, p25: 500000, p75: 3000000, p90: 8000000 },
  activity24h: { newListings: 50, soldListings: 20, priceChanges: 15 },
  changes: {
    totalValue: { amount: 500000000, percent: 3.5, period: '7d' },
    medianPrice: { amount: 50000, percent: 3.4, period: '7d' },
    listingCount: { amount: 100, percent: 3.4, period: '7d' },
  },
};

const mockDistribution = {
  buckets: [
    { rangeStart: 0, rangeEnd: 500000, label: '0-500K', count: 100, percentage: 40, cumulativePercentage: 40 },
    { rangeStart: 500000, rangeEnd: 1000000, label: '500K-1M', count: 75, percentage: 30, cumulativePercentage: 70 },
  ],
  statistics: {
    count: 250,
    mean: 850000,
    median: 750000,
    stdDev: 500000,
    skewness: 1.2,
    percentiles: { p10: 200000, p25: 400000, p75: 1200000, p90: 1800000 },
  },
  filters: { itemType: null, certification: null, dealer: null },
};

const mockCategoryBreakdown = {
  categories: [
    {
      itemType: 'katana',
      displayName: 'Katana',
      totalCount: 1000,
      availableCount: 600,
      soldCount: 400,
      totalValueJPY: 5000000000,
      medianPriceJPY: 2000000,
      avgPriceJPY: 2500000,
      priceRange: { min: 100000, max: 50000000 },
      countShare: 0.35,
      valueShare: 0.45,
      priceVsMarket: 0.33,
    },
  ],
  totals: { totalCount: 3000, totalValueJPY: 15000000000, medianPriceJPY: 1500000 },
};

const mockDealerBreakdown = {
  dealers: [
    {
      dealerId: 1,
      dealerName: 'Aoi Art',
      totalCount: 500,
      availableCount: 500,
      totalValueJPY: 2500000000,
      medianPriceJPY: 1800000,
      avgPriceJPY: 2000000,
      countShare: 0.17,
      valueShare: 0.19,
    },
  ],
  totals: { totalCount: 3000, totalValueJPY: 15000000000 },
};

const mockTrends = {
  metric: 'median_price',
  period: '30d',
  granularity: 'daily',
  dataPoints: [
    { date: '2026-01-01', value: 1400000, change: 0, changePercent: 0 },
    { date: '2026-01-15', value: 1500000, change: 100000, changePercent: 7.14 },
  ],
  summary: {
    startValue: 1400000,
    endValue: 1500000,
    minValue: 1300000,
    maxValue: 1600000,
    totalChange: 100000,
    totalChangePercent: 7.14,
    trend: 'up',
    volatility: 0.05,
  },
  trendLine: { slope: 5000, intercept: 1400000, rSquared: 0.85 },
};

const mockPriceChanges = {
  changes: [
    {
      listingId: 123,
      title: 'Katana by Nobuyoshi',
      dealerName: 'Aoi Art',
      itemType: 'katana',
      oldPrice: 1500000,
      newPrice: 1400000,
      changeAmount: -100000,
      changePercent: -6.67,
      detectedAt: '2026-01-15T08:00:00Z',
    },
  ],
  totalCount: 15,
  period: '7d',
};

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

function setupDefaultMocks() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/overview')) {
      return Promise.resolve(createMockResponse(mockOverview));
    }
    if (url.includes('/distribution')) {
      return Promise.resolve(createMockResponse(mockDistribution));
    }
    if (url.includes('/breakdown') && url.includes('type=category')) {
      return Promise.resolve(createMockResponse(mockCategoryBreakdown));
    }
    if (url.includes('/breakdown') && url.includes('type=dealer')) {
      return Promise.resolve(createMockResponse(mockDealerBreakdown));
    }
    if (url.includes('/trends')) {
      return Promise.resolve(createMockResponse(mockTrends));
    }
    if (url.includes('/price-changes')) {
      return Promise.resolve(createMockResponse(mockPriceChanges));
    }
    return Promise.resolve(createMockResponse({}));
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('useMarketIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // INITIAL FETCH TESTS
  // ===========================================================================

  describe('initial data fetching', () => {
    it('fetches all data on mount', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have called all 6 endpoints
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('sets loading state to true initially', () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      expect(result.current.loading.overview).toBe(true);
      expect(result.current.loading.distribution).toBe(true);
      expect(result.current.loading.categoryBreakdown).toBe(true);
      expect(result.current.loading.dealerBreakdown).toBe(true);
      expect(result.current.loading.trends).toBe(true);
      expect(result.current.loading.priceChanges).toBe(true);
    });

    it('returns overview data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.loading.overview).toBe(false);
      });

      expect(result.current.data.overview).toMatchObject({
        totalListings: mockOverview.totalListings,
        availableListings: mockOverview.availableListings,
      });
    });

    it('returns distribution data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.loading.distribution).toBe(false);
      });

      expect(result.current.data.distribution).toMatchObject({
        buckets: expect.any(Array),
        statistics: expect.any(Object),
      });
    });

    it('sets lastUpdated timestamp after successful fetch', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // FILTER CHANGE TESTS
  // ===========================================================================

  describe('filter changes', () => {
    it('includes filter parameters in API calls', async () => {
      const filters = {
        ...DEFAULT_ANALYTICS_FILTERS,
        itemType: 'katana' as const,
        certification: 'Juyo',
        dealerId: 5,
      };

      const { result } = renderHook(() => useMarketIntelligence({ filters }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check that filters are included in URL
      const overviewCall = mockFetch.mock.calls.find((call: string[]) =>
        call[0].includes('/overview')
      );
      expect(overviewCall?.[0]).toContain('itemType=katana');
      expect(overviewCall?.[0]).toContain('certification=Juyo');
      expect(overviewCall?.[0]).toContain('dealer=5');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.loading.overview).toBe(false);
      });

      expect(result.current.errors.overview).toBe('Network error');
      expect(result.current.hasErrors).toBe(true);
    });

    it('handles non-ok response status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/distribution')) {
          return Promise.resolve(createFailedResponse(500, 'Internal Server Error'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.loading.distribution).toBe(false);
      });

      expect(result.current.errors.distribution).toContain('Failed to fetch');
    });

    it('handles API returning success: false', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/trends')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: false,
                error: 'Custom error message',
                timestamp: new Date().toISOString(),
              }),
          });
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.loading.trends).toBe(false);
      });

      expect(result.current.errors.trends).toBe('Custom error message');
    });

    it('sets hasErrors to true when any endpoint fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/price-changes')) {
          return Promise.reject(new Error('API unavailable'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasErrors).toBe(true);
    });
  });

  // ===========================================================================
  // AUTO-REFRESH TESTS
  // ===========================================================================

  describe('auto-refresh', () => {
    it('accepts autoRefresh option', async () => {
      // Just verify the hook accepts the option without error
      const { result } = renderHook(() =>
        useMarketIntelligence({
          filters: DEFAULT_ANALYTICS_FILTERS,
          autoRefresh: true,
          refreshInterval: 60000,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook should work with autoRefresh enabled
      expect(result.current.data).toBeDefined();
    });

    it('accepts autoRefresh: false option', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({
          filters: DEFAULT_ANALYTICS_FILTERS,
          autoRefresh: false,
          refreshInterval: 60000,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should complete initial fetch normally
      expect(mockFetch.mock.calls.length).toBe(6);
    });

    it('clears interval on unmount (basic check)', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount, result } = renderHook(() =>
        useMarketIntelligence({
          filters: DEFAULT_ANALYTICS_FILTERS,
          autoRefresh: true,
          refreshInterval: 60000,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      unmount();

      // clearInterval is called on unmount for any active intervals
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  // ===========================================================================
  // MANUAL REFRESH TESTS
  // ===========================================================================

  describe('manual refresh', () => {
    it('provides refreshAll function', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refreshAll).toBe('function');
    });

    it('refreshAll triggers new API calls', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      await act(async () => {
        await result.current.refreshAll();
      });

      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ===========================================================================
  // COMPUTED VALUES TESTS
  // ===========================================================================

  describe('computed values', () => {
    it('isLoading is false when all endpoints have completed', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.loading.overview).toBe(false);
      expect(result.current.loading.distribution).toBe(false);
      expect(result.current.loading.categoryBreakdown).toBe(false);
      expect(result.current.loading.dealerBreakdown).toBe(false);
      expect(result.current.loading.trends).toBe(false);
      expect(result.current.loading.priceChanges).toBe(false);
    });

    it('hasErrors is false when no errors', async () => {
      const { result } = renderHook(() =>
        useMarketIntelligence({ filters: DEFAULT_ANALYTICS_FILTERS })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasErrors).toBe(false);
    });
  });
});
