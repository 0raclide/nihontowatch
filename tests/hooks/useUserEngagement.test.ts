/**
 * useUserEngagement Hook Unit Tests
 *
 * Tests the custom hook for fetching user engagement analytics data.
 * Verifies data fetching, loading states, error handling, and period changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserEngagement } from '@/hooks/useUserEngagement';

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
  users: {
    total: 500,
    newInPeriod: 50,
    newPrevPeriod: 40,
    changePercent: 25,
    activeToday: 30,
    activeInPeriod: 200,
  },
  sessions: {
    total: 1500,
    avgDurationSeconds: 180,
    avgPageViews: 5.2,
    bounceRate: 35.5,
    totalPrevPeriod: 1200,
    changePercent: 25,
  },
  engagement: {
    totalViews: 10000,
    totalSearches: 2500,
    totalFavorites: 500,
    viewsPrevPeriod: 8000,
    searchesPrevPeriod: 2000,
    favoritesPrevPeriod: 400,
  },
  asOf: '2026-01-15T12:00:00Z',
  period: '30d',
};

const mockGrowth = {
  dataPoints: [
    { date: '2026-01-01', newUsers: 5, cumulativeUsers: 405 },
    { date: '2026-01-02', newUsers: 8, cumulativeUsers: 413 },
    { date: '2026-01-03', newUsers: 3, cumulativeUsers: 416 },
  ],
  summary: {
    totalNewUsers: 50,
    avgDailySignups: 1.67,
    peakDay: '2026-01-02',
    peakCount: 8,
  },
  period: '30d',
  granularity: 'daily',
};

const mockSearches = {
  searches: [
    { term: 'katana', count: 250, uniqueUsers: 100, avgResultCount: 45.5, clickThroughRate: 35.0 },
    { term: 'juyo', count: 180, uniqueUsers: 80, avgResultCount: 20.2, clickThroughRate: 28.5 },
    { term: 'wakizashi', count: 120, uniqueUsers: 60, avgResultCount: 30.1, clickThroughRate: 22.0 },
  ],
  totals: {
    totalSearches: 2500,
    uniqueSearchers: 350,
    avgClickThroughRate: 25.3,
  },
  period: '30d',
};

const mockFunnel = {
  stages: [
    { stage: 'visitors', label: 'Visitors', count: 1500, conversionRate: 100, dropoffRate: 0 },
    { stage: 'searchers', label: 'Searched', count: 800, conversionRate: 53.3, dropoffRate: 46.7 },
    { stage: 'viewers', label: 'Viewed Listing', count: 600, conversionRate: 40, dropoffRate: 25 },
    { stage: 'engagers', label: 'Favorited', count: 200, conversionRate: 13.3, dropoffRate: 66.7 },
    { stage: 'high_intent', label: 'Saved Search', count: 50, conversionRate: 3.3, dropoffRate: 75 },
    { stage: 'converted', label: 'Sent Inquiry', count: 10, conversionRate: 0.67, dropoffRate: 80 },
  ],
  overallConversionRate: 0.67,
  period: '30d',
};

const mockTopListings = {
  listings: [
    {
      id: 123,
      title: 'Katana by Nobuyoshi',
      itemType: 'katana',
      dealerName: 'Aoi Art',
      views: 500,
      uniqueViewers: 350,
      favorites: 45,
      priceJPY: 1500000,
    },
    {
      id: 456,
      title: 'Wakizashi by Kunimitsu',
      itemType: 'wakizashi',
      dealerName: 'Eirakudo',
      views: 420,
      uniqueViewers: 300,
      favorites: 38,
      priceJPY: 850000,
    },
  ],
  period: '30d',
  sortedBy: 'views',
};

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

function setupDefaultMocks() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/overview')) {
      return Promise.resolve(createMockResponse(mockOverview));
    }
    if (url.includes('/growth')) {
      return Promise.resolve(createMockResponse(mockGrowth));
    }
    if (url.includes('/searches')) {
      return Promise.resolve(createMockResponse(mockSearches));
    }
    if (url.includes('/funnel')) {
      return Promise.resolve(createMockResponse(mockFunnel));
    }
    if (url.includes('/top-listings')) {
      return Promise.resolve(createMockResponse(mockTopListings));
    }
    return Promise.resolve(createMockResponse({}));
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('useUserEngagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // INITIAL LOADING STATE TESTS
  // ===========================================================================

  describe('initial loading state', () => {
    it('sets loading state to true initially for all endpoints', () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      expect(result.current.loading.overview).toBe(true);
      expect(result.current.loading.growth).toBe(true);
      expect(result.current.loading.searches).toBe(true);
      expect(result.current.loading.funnel).toBe(true);
      expect(result.current.loading.topListings).toBe(true);
      expect(result.current.isLoading).toBe(true);
    });

    it('has null data initially', () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      expect(result.current.data.overview).toBeNull();
      expect(result.current.data.growth).toBeNull();
      expect(result.current.data.searches).toBeNull();
      expect(result.current.data.funnel).toBeNull();
      expect(result.current.data.topListings).toBeNull();
    });

    it('has no errors initially', () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      expect(result.current.errors.overview).toBeNull();
      expect(result.current.errors.growth).toBeNull();
      expect(result.current.errors.searches).toBeNull();
      expect(result.current.errors.funnel).toBeNull();
      expect(result.current.errors.topListings).toBeNull();
      expect(result.current.hasErrors).toBe(false);
    });
  });

  // ===========================================================================
  // SUCCESSFUL DATA FETCH TESTS
  // ===========================================================================

  describe('successful data fetch', () => {
    it('fetches all 5 endpoints on mount', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have called all 5 endpoints
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('returns overview data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.overview).toBe(false);
      });

      expect(result.current.data.overview).toMatchObject({
        users: expect.objectContaining({
          total: 500,
          newInPeriod: 50,
        }),
        sessions: expect.objectContaining({
          total: 1500,
        }),
      });
    });

    it('returns growth data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.growth).toBe(false);
      });

      expect(result.current.data.growth).toMatchObject({
        dataPoints: expect.any(Array),
        summary: expect.objectContaining({
          totalNewUsers: 50,
        }),
      });
    });

    it('returns searches data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.searches).toBe(false);
      });

      expect(result.current.data.searches).toMatchObject({
        searches: expect.any(Array),
        totals: expect.objectContaining({
          totalSearches: 2500,
        }),
      });
    });

    it('returns funnel data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.funnel).toBe(false);
      });

      expect(result.current.data.funnel).toMatchObject({
        stages: expect.any(Array),
        overallConversionRate: 0.67,
      });
    });

    it('returns top listings data after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.topListings).toBe(false);
      });

      expect(result.current.data.topListings).toMatchObject({
        listings: expect.any(Array),
        sortedBy: 'views',
      });
    });

    it('sets lastUpdated timestamp after successful fetch', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('includes period parameter in API calls', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '7d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check that period is included in URL
      const overviewCall = mockFetch.mock.calls.find((call: string[]) =>
        call[0].includes('/overview')
      );
      expect(overviewCall?.[0]).toContain('period=7d');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.overview).toBe(false);
      });

      expect(result.current.errors.overview).toBe('Network error');
      expect(result.current.hasErrors).toBe(true);
    });

    it('handles non-ok response status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/growth')) {
          return Promise.resolve(createFailedResponse(500, 'Internal Server Error'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.growth).toBe(false);
      });

      expect(result.current.errors.growth).toContain('Failed to fetch');
    });

    it('handles API returning success: false', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/funnel')) {
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
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.funnel).toBe(false);
      });

      expect(result.current.errors.funnel).toBe('Custom error message');
    });

    it('sets hasErrors to true when any endpoint fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/top-listings')) {
          return Promise.reject(new Error('API unavailable'));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasErrors).toBe(true);
    });

    it('sets individual error state while other endpoints succeed', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/searches')) {
          return Promise.reject(new Error('Search service unavailable'));
        }
        if (url.includes('/overview')) {
          return Promise.resolve(createMockResponse(mockOverview));
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.loading.searches).toBe(false);
        expect(result.current.loading.overview).toBe(false);
      });

      expect(result.current.errors.searches).toBe('Search service unavailable');
      expect(result.current.errors.overview).toBeNull();
      expect(result.current.data.overview).not.toBeNull();
    });
  });

  // ===========================================================================
  // PERIOD CHANGE TESTS
  // ===========================================================================

  describe('period change triggers refetch', () => {
    it('refetches data when period changes', async () => {
      const { result, rerender } = renderHook(
        ({ period }) => useUserEngagement({ period }),
        { initialProps: { period: '30d' as const } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Change period
      rerender({ period: '7d' });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have made additional calls
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);

      // Verify new period is used
      const recentCalls = mockFetch.mock.calls.slice(initialCallCount);
      const hasPeriod7d = recentCalls.some((call: string[]) =>
        call[0].includes('period=7d')
      );
      expect(hasPeriod7d).toBe(true);
    });
  });

  // ===========================================================================
  // REFRESH ALL TESTS
  // ===========================================================================

  describe('refreshAll function', () => {
    it('provides refreshAll function', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refreshAll).toBe('function');
    });

    it('refreshAll triggers new API calls', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      await act(async () => {
        await result.current.refreshAll();
      });

      // Should have called 5 more endpoints
      expect(mockFetch.mock.calls.length).toBe(initialCallCount + 5);
    });

    it('refreshAll updates lastUpdated timestamp', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialLastUpdated = result.current.lastUpdated;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await act(async () => {
        await result.current.refreshAll();
      });

      expect(result.current.lastUpdated).not.toBe(initialLastUpdated);
      expect(result.current.lastUpdated!.getTime()).toBeGreaterThan(
        initialLastUpdated!.getTime()
      );
    });
  });

  // ===========================================================================
  // COMPUTED VALUES TESTS
  // ===========================================================================

  describe('computed values', () => {
    it('isLoading is false when all endpoints have completed', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.loading.overview).toBe(false);
      expect(result.current.loading.growth).toBe(false);
      expect(result.current.loading.searches).toBe(false);
      expect(result.current.loading.funnel).toBe(false);
      expect(result.current.loading.topListings).toBe(false);
    });

    it('hasErrors is false when no errors', async () => {
      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasErrors).toBe(false);
    });

    it('isLoading is true when at least one endpoint is loading', async () => {
      // Make one endpoint slow
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return new Promise((resolve) =>
            setTimeout(() => resolve(createMockResponse(mockOverview)), 1000)
          );
        }
        return Promise.resolve(createMockResponse({}));
      });

      const { result } = renderHook(() =>
        useUserEngagement({ period: '30d' })
      );

      // isLoading should be true while at least one is loading
      expect(result.current.isLoading).toBe(true);
    });
  });
});
