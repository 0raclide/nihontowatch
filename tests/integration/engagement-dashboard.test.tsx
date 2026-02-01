/**
 * User Engagement Analytics Dashboard Integration Tests
 *
 * Tests the /admin/analytics page with all its components integrated.
 * Verifies page rendering, data display, period selection, refresh functionality,
 * loading states, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import UserEngagementAnalyticsPage from '@/app/admin/analytics/page';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock useUserEngagement hook
const mockRefreshAll = vi.fn();
const mockUseUserEngagement = vi.fn();

vi.mock('@/hooks/useUserEngagement', () => ({
  useUserEngagement: (options: { period: string }) => mockUseUserEngagement(options),
}));

// Mock Recharts to avoid rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// =============================================================================
// MOCK DATA
// =============================================================================

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

// Default mock return value (loaded state)
const createMockHookReturn = (overrides = {}) => ({
  data: {
    overview: mockOverview,
    growth: mockGrowth,
    searches: mockSearches,
    funnel: mockFunnel,
    topListings: mockTopListings,
  },
  loading: {
    overview: false,
    growth: false,
    searches: false,
    funnel: false,
    topListings: false,
  },
  errors: {
    overview: null,
    growth: null,
    searches: null,
    funnel: null,
    topListings: null,
  },
  refreshAll: mockRefreshAll,
  isLoading: false,
  hasErrors: false,
  lastUpdated: new Date('2026-01-15T12:00:00Z'),
  ...overrides,
});

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUserEngagement.mockReturnValue(createMockHookReturn());
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// TEST SUITES
// =============================================================================

describe('UserEngagementAnalyticsPage', () => {
  // ===========================================================================
  // PAGE RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders without crashing', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'User Engagement Analytics'
      );
    });

    it('displays page title and description', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('User Engagement Analytics')).toBeInTheDocument();
      expect(screen.getByText('Understand how users interact with your platform')).toBeInTheDocument();
    });

    it('displays last updated timestamp', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });

    it('displays refresh button', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // METRIC CARD TESTS
  // ===========================================================================

  describe('metric cards', () => {
    it('displays Total Users metric with value from data', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Total Users')).toBeInTheDocument();
      // 500 appears twice (Total Users metric and listing views), so use getAllBy
      const values500 = screen.getAllByText('500');
      expect(values500.length).toBeGreaterThan(0);
    });

    it('displays Active Today metric with value from data', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Active Today')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('displays Avg Session Duration with formatted time', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Avg Session Duration')).toBeInTheDocument();
      // 180 seconds = 3m
      expect(screen.getByText('3m')).toBeInTheDocument();
    });

    it('displays Total Searches metric with value from data', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Total Searches')).toBeInTheDocument();
      // 2500 is formatted as 2.5K
      const values = screen.getAllByText('2.5K');
      expect(values.length).toBeGreaterThan(0);
    });

    it('shows change percentage for Total Users when positive', () => {
      render(<UserEngagementAnalyticsPage />);

      // newInPeriod (50) vs newPrevPeriod (40) = 25% increase
      const changeIndicators = screen.getAllByText('+25.0%');
      expect(changeIndicators.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // PERIOD SELECTOR TESTS
  // ===========================================================================

  describe('period selector', () => {
    it('displays all period options', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByRole('button', { name: 'Last 7 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Last 30 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Last 90 Days' })).toBeInTheDocument();
    });

    it('defaults to 30d period', () => {
      render(<UserEngagementAnalyticsPage />);

      const button30d = screen.getByRole('button', { name: 'Last 30 Days' });
      expect(button30d).toHaveClass('bg-blue-600');
    });

    it('calls hook with correct period when changed to 7d', () => {
      render(<UserEngagementAnalyticsPage />);

      // Initially called with 30d
      expect(mockUseUserEngagement).toHaveBeenCalledWith({ period: '30d' });

      // Click 7d button
      fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }));

      // Should be called with 7d
      expect(mockUseUserEngagement).toHaveBeenCalledWith({ period: '7d' });
    });

    it('calls hook with correct period when changed to 90d', () => {
      render(<UserEngagementAnalyticsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Last 90 Days' }));

      expect(mockUseUserEngagement).toHaveBeenCalledWith({ period: '90d' });
    });

    it('updates button styling when period changes', () => {
      render(<UserEngagementAnalyticsPage />);

      const button7d = screen.getByRole('button', { name: 'Last 7 Days' });
      const button30d = screen.getByRole('button', { name: 'Last 30 Days' });

      // Initially 30d is selected
      expect(button30d).toHaveClass('bg-blue-600');
      expect(button7d).not.toHaveClass('bg-blue-600');

      // Click 7d
      fireEvent.click(button7d);

      // 7d should now have active styling
      expect(button7d).toHaveClass('bg-blue-600');
    });
  });

  // ===========================================================================
  // REFRESH BUTTON TESTS
  // ===========================================================================

  describe('refresh button', () => {
    it('calls refreshAll when clicked', () => {
      render(<UserEngagementAnalyticsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(mockRefreshAll).toHaveBeenCalledTimes(1);
    });

    it('is disabled when isLoading is true', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({ isLoading: true })
      );

      render(<UserEngagementAnalyticsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeDisabled();
    });

    it('is enabled when isLoading is false', () => {
      render(<UserEngagementAnalyticsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).not.toBeDisabled();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading states', () => {
    it('displays skeleton loaders when all data is loading', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            overview: null,
            growth: null,
            searches: null,
            funnel: null,
            topListings: null,
          },
          loading: {
            overview: true,
            growth: true,
            searches: true,
            funnel: true,
            topListings: true,
          },
          isLoading: true,
        })
      );

      render(<UserEngagementAnalyticsPage />);

      // Should have skeleton elements with animate-shimmer
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays chart skeleton when growth data is loading', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            growth: null,
          },
          loading: {
            ...createMockHookReturn().loading,
            growth: true,
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      // Chart skeleton has animate-shimmer elements
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays metric card skeletons when overview is loading', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            overview: null,
          },
          loading: {
            ...createMockHookReturn().loading,
            overview: true,
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      // Should show skeletons for metric cards
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // ERROR STATE TESTS
  // ===========================================================================

  describe('error states', () => {
    it('displays global error when all endpoints fail', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            overview: null,
            growth: null,
            searches: null,
            funnel: null,
            topListings: null,
          },
          errors: {
            overview: 'Failed to fetch overview',
            growth: 'Failed to fetch growth',
            searches: 'Failed to fetch searches',
            funnel: 'Failed to fetch funnel',
            topListings: 'Failed to fetch top listings',
          },
          hasErrors: true,
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Error loading analytics')).toBeInTheDocument();
    });

    it('displays error for individual section when growth fails', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            growth: null,
          },
          errors: {
            ...createMockHookReturn().errors,
            growth: 'Growth service unavailable',
          },
          hasErrors: true,
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Error loading data')).toBeInTheDocument();
      expect(screen.getByText('Growth service unavailable')).toBeInTheDocument();
    });

    it('displays error for funnel section when funnel fails', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            funnel: null,
          },
          errors: {
            ...createMockHookReturn().errors,
            funnel: 'Funnel service error',
          },
          hasErrors: true,
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Funnel service error')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SECTION RENDERING TESTS
  // ===========================================================================

  describe('section rendering', () => {
    it('displays User Growth section header', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('User Growth')).toBeInTheDocument();
    });

    it('displays Conversion Funnel section header', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    });

    it('displays Popular Search Terms section header', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Popular Search Terms')).toBeInTheDocument();
    });

    it('displays Top Listings section header', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Top Listings')).toBeInTheDocument();
    });

    it('displays growth summary card with correct data', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('New Users')).toBeInTheDocument();
      // 50 appears in multiple places, use getAllBy
      const values50 = screen.getAllByText('50');
      expect(values50.length).toBeGreaterThan(0);
      expect(screen.getByText('Daily Avg')).toBeInTheDocument();
      // 1.67.toFixed(1) = '1.7'
      const dailyAvg = screen.getAllByText('1.7');
      expect(dailyAvg.length).toBeGreaterThan(0);
      expect(screen.getByText('Peak Day')).toBeInTheDocument();
    });

    it('displays overall conversion rate card', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Overall Conversion Rate')).toBeInTheDocument();
      // 0.67.toFixed(1) = '0.7%'
      const rate = screen.getAllByText('0.7%');
      expect(rate.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // TOP LISTINGS TESTS
  // ===========================================================================

  describe('top listings section', () => {
    it('displays listing titles', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Katana by Nobuyoshi')).toBeInTheDocument();
      expect(screen.getByText('Wakizashi by Kunimitsu')).toBeInTheDocument();
    });

    it('displays item type badges', () => {
      render(<UserEngagementAnalyticsPage />);

      // Item types appear in both badges and search terms, use getAllBy
      const katanaBadges = screen.getAllByText('katana');
      expect(katanaBadges.length).toBeGreaterThan(0);
      const wakizashiBadges = screen.getAllByText('wakizashi');
      expect(wakizashiBadges.length).toBeGreaterThan(0);
    });

    it('displays dealer names', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Aoi Art')).toBeInTheDocument();
      expect(screen.getByText('Eirakudo')).toBeInTheDocument();
    });

    it('has links to listing detail pages', () => {
      render(<UserEngagementAnalyticsPage />);

      const link = screen.getByRole('link', { name: 'Katana by Nobuyoshi' });
      expect(link).toHaveAttribute('href', '/listing/123');
    });
  });

  // ===========================================================================
  // SEARCH TERMS TABLE TESTS
  // ===========================================================================

  describe('search terms section', () => {
    it('displays total searches count', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('2,500 total searches')).toBeInTheDocument();
    });

    it('displays search terms from data', () => {
      render(<UserEngagementAnalyticsPage />);

      // katana appears in both search terms and item type badges, use getAllBy
      const katanaTerms = screen.getAllByText('katana');
      expect(katanaTerms.length).toBeGreaterThan(0);
      expect(screen.getByText('juyo')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // FUNNEL CHART TESTS
  // ===========================================================================

  describe('conversion funnel section', () => {
    it('displays funnel stage labels', () => {
      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('Visitors')).toBeInTheDocument();
      expect(screen.getByText('Searched')).toBeInTheDocument();
      expect(screen.getByText('Viewed Listing')).toBeInTheDocument();
      expect(screen.getByText('Favorited')).toBeInTheDocument();
    });

    it('displays funnel stage counts', () => {
      render(<UserEngagementAnalyticsPage />);

      // 1500, 800, 600, etc should be formatted
      expect(screen.getByText('1.5K')).toBeInTheDocument(); // Visitors
    });
  });

  // ===========================================================================
  // DURATION FORMATTING TESTS
  // ===========================================================================

  describe('duration formatting', () => {
    it('formats seconds correctly', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            overview: {
              ...mockOverview,
              sessions: { ...mockOverview.sessions, avgDurationSeconds: 45 },
            },
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('formats hours and minutes correctly', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            overview: {
              ...mockOverview,
              sessions: { ...mockOverview.sessions, avgDurationSeconds: 3720 }, // 1h 2m
            },
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('1h 2m')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EMPTY DATA HANDLING TESTS
  // ===========================================================================

  describe('empty data handling', () => {
    it('displays empty state for top listings when no listings', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            topListings: { listings: [], period: '30d', sortedBy: 'views' },
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('No listing data available')).toBeInTheDocument();
    });

    it('handles null overview data gracefully', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            overview: null,
          },
          loading: {
            ...createMockHookReturn().loading,
            overview: false,
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      // Should show 0 for metric values (multiple 0s will appear)
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues.length).toBeGreaterThan(0);
    });

    it('handles empty search data', () => {
      mockUseUserEngagement.mockReturnValue(
        createMockHookReturn({
          data: {
            ...createMockHookReturn().data,
            searches: { searches: [], totals: { totalSearches: 0, uniqueSearchers: 0, avgClickThroughRate: 0 }, period: '30d' },
          },
        })
      );

      render(<UserEngagementAnalyticsPage />);

      expect(screen.getByText('No search data available')).toBeInTheDocument();
    });
  });
});
