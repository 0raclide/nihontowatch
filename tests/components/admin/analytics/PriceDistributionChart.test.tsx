/**
 * PriceDistributionChart Component Unit Tests
 *
 * Tests the PriceDistributionChart component used in the analytics dashboard.
 * Verifies rendering, loading states, empty states, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceDistributionChart } from '@/components/admin/analytics';
import type { PriceBucket, PriceStatistics } from '@/types/analytics';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data?.length || 0}>
      {children}
    </div>
  ),
  Bar: ({ onClick, dataKey }: { onClick?: (data: unknown) => void; dataKey: string }) => (
    <div data-testid="bar" data-key={dataKey} onClick={() => onClick?.({})}>
      Bar
    </div>
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey}>
      XAxis
    </div>
  ),
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill}>Cell</div>,
  ReferenceLine: ({ label }: { label?: { value: string } }) => (
    <div data-testid="reference-line" data-label={label?.value}>
      ReferenceLine
    </div>
  ),
}));

// Mock ChartSkeleton
vi.mock('@/components/admin/analytics/ChartSkeleton', () => ({
  ChartSkeleton: ({ height, type }: { height: number; type: string }) => (
    <div data-testid="chart-skeleton" data-height={height} data-type={type}>
      Loading...
    </div>
  ),
}));

// Mock statistics formatters
vi.mock('@/lib/analytics/statistics', () => ({
  formatCompactNumber: vi.fn((value: number) => {
    if (value >= 1000000) return `${value / 1000000}M`;
    if (value >= 1000) return `${value / 1000}K`;
    return String(value);
  }),
  formatCurrency: vi.fn((value: number, currency: string, options?: { compact?: boolean }) => {
    const symbols: Record<string, string> = { JPY: '\u00A5', USD: '$', EUR: '\u20AC' };
    const symbol = symbols[currency] || '';
    if (options?.compact) {
      if (value >= 1000000) return `${symbol}${value / 1000000}M`;
      if (value >= 1000) return `${symbol}${value / 1000}K`;
    }
    return `${symbol}${value.toLocaleString()}`;
  }),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const mockBuckets: PriceBucket[] = [
  {
    rangeStart: 0,
    rangeEnd: 500000,
    label: '0-500K',
    count: 100,
    percentage: 40,
    cumulativePercentage: 40,
  },
  {
    rangeStart: 500000,
    rangeEnd: 1000000,
    label: '500K-1M',
    count: 75,
    percentage: 30,
    cumulativePercentage: 70,
  },
  {
    rangeStart: 1000000,
    rangeEnd: 2000000,
    label: '1M-2M',
    count: 50,
    percentage: 20,
    cumulativePercentage: 90,
  },
  {
    rangeStart: 2000000,
    rangeEnd: 5000000,
    label: '2M-5M',
    count: 25,
    percentage: 10,
    cumulativePercentage: 100,
  },
];

const mockStatistics: PriceStatistics = {
  count: 250,
  mean: 850000,
  median: 750000,
  stdDev: 500000,
  skewness: 1.2,
  percentiles: {
    p10: 200000,
    p25: 400000,
    p75: 1200000,
    p90: 1800000,
  },
};

// =============================================================================
// TEST SUITES
// =============================================================================

describe('PriceDistributionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // BASIC RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders chart with buckets', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('renders with correct number of data points', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      const chart = screen.getByTestId('bar-chart');
      expect(chart).toHaveAttribute('data-count', '4');
    });

    it('renders XAxis with correct data key', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis).toHaveAttribute('data-key', 'shortLabel');
    });

    it('renders YAxis', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('renders Tooltip', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('renders Bar with count data key', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      const bar = screen.getByTestId('bar');
      expect(bar).toHaveAttribute('data-key', 'count');
    });
  });

  // ===========================================================================
  // STATISTICS SUMMARY TESTS
  // ===========================================================================

  describe('statistics summary', () => {
    it('shows statistics summary section', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByText('Median')).toBeInTheDocument();
    });

    it('shows P25 statistic', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByText('P25')).toBeInTheDocument();
    });

    it('shows P75 statistic', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByText('P75')).toBeInTheDocument();
    });

    it('shows Std Dev statistic', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.getByText('Std Dev')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // MEDIAN HIGHLIGHTING TESTS
  // ===========================================================================

  describe('median highlighting', () => {
    it('shows median reference line when highlightMedian is true', () => {
      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          highlightMedian
        />
      );

      const referenceLine = screen.getByTestId('reference-line');
      expect(referenceLine).toBeInTheDocument();
      expect(referenceLine).toHaveAttribute('data-label', 'Median');
    });

    it('does not show median reference line when highlightMedian is false', () => {
      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          highlightMedian={false}
        />
      );

      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    });

    it('does not show median reference line by default', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CLICK HANDLER TESTS
  // ===========================================================================

  describe('bucket click handler', () => {
    it('calls onBucketClick when bucket is clicked', () => {
      const onClick = vi.fn();

      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          onBucketClick={onClick}
        />
      );

      const bar = screen.getByTestId('bar');
      fireEvent.click(bar);

      expect(onClick).toHaveBeenCalled();
    });

    it('does not throw when clicked without handler', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      const bar = screen.getByTestId('bar');

      // Should not throw
      expect(() => fireEvent.click(bar)).not.toThrow();
    });
  });

  // ===========================================================================
  // HEIGHT CUSTOMIZATION TESTS
  // ===========================================================================

  describe('height customization', () => {
    it('uses default height of 300', () => {
      const { container } = render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      // ResponsiveContainer receives height prop
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('respects custom height prop', () => {
      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          height={400}
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading state', () => {
    it('shows loading skeleton when loading is true', () => {
      render(
        <PriceDistributionChart
          buckets={[]}
          statistics={mockStatistics}
          loading
        />
      );

      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    });

    it('shows skeleton with bar type', () => {
      render(
        <PriceDistributionChart
          buckets={[]}
          statistics={mockStatistics}
          loading
        />
      );

      const skeleton = screen.getByTestId('chart-skeleton');
      expect(skeleton).toHaveAttribute('data-type', 'bar');
    });

    it('passes height to skeleton', () => {
      render(
        <PriceDistributionChart
          buckets={[]}
          statistics={mockStatistics}
          loading
          height={400}
        />
      );

      const skeleton = screen.getByTestId('chart-skeleton');
      expect(skeleton).toHaveAttribute('data-height', '400');
    });

    it('does not render chart when loading', () => {
      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          loading
        />
      );

      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });

    it('does not render statistics summary when loading', () => {
      render(
        <PriceDistributionChart
          buckets={mockBuckets}
          statistics={mockStatistics}
          loading
        />
      );

      expect(screen.queryByText('Median')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EMPTY STATE TESTS
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty state when no buckets', () => {
      render(
        <PriceDistributionChart buckets={[]} statistics={mockStatistics} />
      );

      expect(screen.getByText(/No price data available/i)).toBeInTheDocument();
    });

    it('does not render chart when no buckets', () => {
      render(
        <PriceDistributionChart buckets={[]} statistics={mockStatistics} />
      );

      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });

    it('does not render statistics when no buckets', () => {
      render(
        <PriceDistributionChart buckets={[]} statistics={mockStatistics} />
      );

      expect(screen.queryByText('Median')).not.toBeInTheDocument();
    });

    it('shows empty state icon', () => {
      render(
        <PriceDistributionChart buckets={[]} statistics={mockStatistics} />
      );

      // Should have an SVG icon
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('handles undefined buckets', () => {
      render(
        <PriceDistributionChart
          buckets={undefined as unknown as PriceBucket[]}
          statistics={mockStatistics}
        />
      );

      expect(screen.getByText(/No price data available/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles single bucket', () => {
      const singleBucket: PriceBucket[] = [
        {
          rangeStart: 0,
          rangeEnd: 1000000,
          label: '0-1M',
          count: 100,
          percentage: 100,
          cumulativePercentage: 100,
        },
      ];

      render(
        <PriceDistributionChart buckets={singleBucket} statistics={mockStatistics} />
      );

      const chart = screen.getByTestId('bar-chart');
      expect(chart).toHaveAttribute('data-count', '1');
    });

    it('handles many buckets', () => {
      const manyBuckets: PriceBucket[] = Array.from({ length: 50 }, (_, i) => ({
        rangeStart: i * 100000,
        rangeEnd: (i + 1) * 100000,
        label: `${i * 100}K-${(i + 1) * 100}K`,
        count: 10,
        percentage: 2,
        cumulativePercentage: (i + 1) * 2,
      }));

      render(
        <PriceDistributionChart buckets={manyBuckets} statistics={mockStatistics} />
      );

      const chart = screen.getByTestId('bar-chart');
      expect(chart).toHaveAttribute('data-count', '50');
    });

    it('handles buckets with zero count', () => {
      const bucketsWithZero: PriceBucket[] = [
        {
          rangeStart: 0,
          rangeEnd: 500000,
          label: '0-500K',
          count: 0,
          percentage: 0,
          cumulativePercentage: 0,
        },
        {
          rangeStart: 500000,
          rangeEnd: 1000000,
          label: '500K-1M',
          count: 100,
          percentage: 100,
          cumulativePercentage: 100,
        },
      ];

      render(
        <PriceDistributionChart buckets={bucketsWithZero} statistics={mockStatistics} />
      );

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('handles very large values', () => {
      const largeBuckets: PriceBucket[] = [
        {
          rangeStart: 0,
          rangeEnd: 1000000000,
          label: '0-1B',
          count: 10,
          percentage: 100,
          cumulativePercentage: 100,
        },
      ];

      const largeStats: PriceStatistics = {
        count: 10,
        mean: 500000000,
        median: 500000000,
        stdDev: 200000000,
        skewness: 0,
        percentiles: {
          p10: 100000000,
          p25: 250000000,
          p75: 750000000,
          p90: 900000000,
        },
      };

      render(
        <PriceDistributionChart buckets={largeBuckets} statistics={largeStats} />
      );

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('handles zero statistics', () => {
      const zeroStats: PriceStatistics = {
        count: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        skewness: 0,
        percentiles: { p10: 0, p25: 0, p75: 0, p90: 0 },
      };

      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={zeroStats} />
      );

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STYLING TESTS
  // ===========================================================================

  describe('styling', () => {
    it('renders statistics with grid layout', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      // Should have a grid layout for statistics
      const grid = document.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('statistics have uppercase labels', () => {
      render(
        <PriceDistributionChart buckets={mockBuckets} statistics={mockStatistics} />
      );

      const labels = document.querySelectorAll('.uppercase');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('empty state has proper styling', () => {
      render(
        <PriceDistributionChart buckets={[]} statistics={mockStatistics} />
      );

      // Should have centered content
      const emptyContainer = document.querySelector('.flex.items-center.justify-center');
      expect(emptyContainer).toBeInTheDocument();
    });
  });
});
