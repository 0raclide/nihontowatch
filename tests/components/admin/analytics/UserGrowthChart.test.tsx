/**
 * UserGrowthChart Component Unit Tests
 *
 * Tests the user growth chart visualization component.
 * Verifies rendering, loading state, empty state, and cumulative toggle.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserGrowthChart } from '@/components/admin/analytics';
import type { GrowthDataPoint } from '@/hooks/useUserEngagement';

// =============================================================================
// MOCK RECHARTS
// =============================================================================

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Bar: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`bar-${dataKey}`} data-name={name} />
  ),
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ yAxisId, orientation }: { yAxisId?: string; orientation?: string }) => (
    <div data-testid={`y-axis-${yAxisId || 'default'}`} data-orientation={orientation} />
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// =============================================================================
// MOCK DATA
// =============================================================================

const mockDataPoints: GrowthDataPoint[] = [
  { date: '2026-01-01', newUsers: 5, cumulativeUsers: 405 },
  { date: '2026-01-02', newUsers: 8, cumulativeUsers: 413 },
  { date: '2026-01-03', newUsers: 3, cumulativeUsers: 416 },
  { date: '2026-01-04', newUsers: 6, cumulativeUsers: 422 },
  { date: '2026-01-05', newUsers: 10, cumulativeUsers: 432 },
];

// =============================================================================
// TEST SUITES
// =============================================================================

describe('UserGrowthChart', () => {
  // ===========================================================================
  // BASIC RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders chart with data', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders bar chart for new users', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      const bar = screen.getByTestId('bar-newUsers');
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveAttribute('data-name', 'New Users');
    });

    it('renders line chart for cumulative users by default', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      const line = screen.getByTestId('line-cumulativeUsers');
      expect(line).toBeInTheDocument();
      expect(line).toHaveAttribute('data-name', 'Total Users');
    });

    it('renders x-axis', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    });

    it('renders left y-axis for new users', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('y-axis-left')).toBeInTheDocument();
    });

    it('renders right y-axis for cumulative when showCumulative is true', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} showCumulative />);

      const rightAxis = screen.getByTestId('y-axis-right');
      expect(rightAxis).toBeInTheDocument();
      expect(rightAxis).toHaveAttribute('data-orientation', 'right');
    });

    it('renders tooltip', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('renders legend', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading state', () => {
    it('shows skeleton when loading is true', () => {
      render(<UserGrowthChart dataPoints={[]} loading />);

      // Should show skeleton elements with animate-shimmer class
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render chart when loading', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} loading />);

      expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument();
    });

    it('applies correct height to skeleton', () => {
      const { container } = render(
        <UserGrowthChart dataPoints={[]} loading height={400} />
      );

      const skeletonContainer = container.querySelector('.bg-linen\\/50');
      expect(skeletonContainer).toHaveStyle({ height: '400px' });
    });
  });

  // ===========================================================================
  // EMPTY STATE TESTS
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty state when dataPoints array is empty', () => {
      render(<UserGrowthChart dataPoints={[]} />);

      expect(screen.getByText('No growth data available')).toBeInTheDocument();
    });

    it('shows empty state when dataPoints is undefined', () => {
      // @ts-expect-error - Testing undefined behavior
      render(<UserGrowthChart dataPoints={undefined} />);

      expect(screen.getByText('No growth data available')).toBeInTheDocument();
    });

    it('shows chart icon in empty state', () => {
      render(<UserGrowthChart dataPoints={[]} />);

      const svg = document.querySelector('svg.text-muted');
      expect(svg).toBeInTheDocument();
    });

    it('applies correct height to empty state', () => {
      const { container } = render(
        <UserGrowthChart dataPoints={[]} height={350} />
      );

      const emptyContainer = container.querySelector('.border-dashed');
      expect(emptyContainer).toHaveStyle({ height: '350px' });
    });
  });

  // ===========================================================================
  // SHOW CUMULATIVE PROP TESTS
  // ===========================================================================

  describe('showCumulative prop', () => {
    it('shows cumulative line by default (showCumulative=true)', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      expect(screen.getByTestId('line-cumulativeUsers')).toBeInTheDocument();
    });

    it('hides cumulative line when showCumulative is false', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} showCumulative={false} />);

      expect(screen.queryByTestId('line-cumulativeUsers')).not.toBeInTheDocument();
    });

    it('hides right y-axis when showCumulative is false', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} showCumulative={false} />);

      expect(screen.queryByTestId('y-axis-right')).not.toBeInTheDocument();
    });

    it('still shows bar chart when showCumulative is false', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} showCumulative={false} />);

      expect(screen.getByTestId('bar-newUsers')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // HEIGHT PROP TESTS
  // ===========================================================================

  describe('height prop', () => {
    it('uses default height of 300', () => {
      render(<UserGrowthChart dataPoints={mockDataPoints} />);

      // ResponsiveContainer should be rendered
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('passes height to loading skeleton', () => {
      const { container } = render(
        <UserGrowthChart dataPoints={[]} loading height={500} />
      );

      const skeleton = container.querySelector('.bg-linen\\/50');
      expect(skeleton).toHaveStyle({ height: '500px' });
    });

    it('passes height to empty state', () => {
      const { container } = render(
        <UserGrowthChart dataPoints={[]} height={450} />
      );

      const emptyState = container.querySelector('.border-dashed');
      expect(emptyState).toHaveStyle({ height: '450px' });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles single data point', () => {
      const singlePoint: GrowthDataPoint[] = [
        { date: '2026-01-01', newUsers: 5, cumulativeUsers: 100 },
      ];

      render(<UserGrowthChart dataPoints={singlePoint} />);

      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroData: GrowthDataPoint[] = [
        { date: '2026-01-01', newUsers: 0, cumulativeUsers: 0 },
        { date: '2026-01-02', newUsers: 0, cumulativeUsers: 0 },
      ];

      render(<UserGrowthChart dataPoints={zeroData} />);

      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    it('handles large values', () => {
      const largeData: GrowthDataPoint[] = [
        { date: '2026-01-01', newUsers: 1000000, cumulativeUsers: 5000000 },
      ];

      render(<UserGrowthChart dataPoints={largeData} />);

      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    it('handles many data points', () => {
      const manyPoints: GrowthDataPoint[] = Array.from({ length: 90 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        newUsers: Math.floor(Math.random() * 20),
        cumulativeUsers: 400 + i * 5,
      }));

      render(<UserGrowthChart dataPoints={manyPoints} />);

      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STYLING TESTS
  // ===========================================================================

  describe('styling', () => {
    it('applies correct container styling', () => {
      const { container } = render(<UserGrowthChart dataPoints={mockDataPoints} />);

      const chartContainer = container.querySelector('.bg-cream.rounded-lg.border.border-border');
      expect(chartContainer).toBeInTheDocument();
    });

    it('has padding class applied', () => {
      const { container } = render(<UserGrowthChart dataPoints={mockDataPoints} />);

      const chartContainer = container.querySelector('.p-4');
      expect(chartContainer).toBeInTheDocument();
    });
  });
});
