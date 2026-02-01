/**
 * ConversionFunnelChart Component Unit Tests
 *
 * Tests the conversion funnel visualization component.
 * Verifies rendering, loading state, empty state, and color coding.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversionFunnelChart } from '@/components/admin/analytics';
import type { FunnelStage } from '@/hooks/useUserEngagement';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockStages: FunnelStage[] = [
  { stage: 'visitors', label: 'Visitors', count: 1500, conversionRate: 100, dropoffRate: 0 },
  { stage: 'searchers', label: 'Searched', count: 800, conversionRate: 53.3, dropoffRate: 46.7 },
  { stage: 'viewers', label: 'Viewed Listing', count: 600, conversionRate: 40, dropoffRate: 25 },
  { stage: 'engagers', label: 'Favorited', count: 200, conversionRate: 13.3, dropoffRate: 66.7 },
  { stage: 'high_intent', label: 'Saved Search', count: 50, conversionRate: 3.3, dropoffRate: 75 },
  { stage: 'converted', label: 'Sent Inquiry', count: 10, conversionRate: 0.67, dropoffRate: 80 },
];

// =============================================================================
// TEST SUITES
// =============================================================================

describe('ConversionFunnelChart', () => {
  // ===========================================================================
  // BASIC RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders all stage labels', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      expect(screen.getByText('Visitors')).toBeInTheDocument();
      expect(screen.getByText('Searched')).toBeInTheDocument();
      expect(screen.getByText('Viewed Listing')).toBeInTheDocument();
      expect(screen.getByText('Favorited')).toBeInTheDocument();
      expect(screen.getByText('Saved Search')).toBeInTheDocument();
      expect(screen.getByText('Sent Inquiry')).toBeInTheDocument();
    });

    it('renders conversion rates for each stage', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      expect(screen.getByText('100.0%')).toBeInTheDocument();
      expect(screen.getByText('53.3%')).toBeInTheDocument();
      expect(screen.getByText('40.0%')).toBeInTheDocument();
      expect(screen.getByText('13.3%')).toBeInTheDocument();
      expect(screen.getByText('3.3%')).toBeInTheDocument();
      expect(screen.getByText('0.7%')).toBeInTheDocument();
    });

    it('renders counts in K format for thousands', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      expect(screen.getByText('1.5K')).toBeInTheDocument(); // 1500
    });

    it('renders dropoff indicators between stages', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      expect(screen.getByText('46.7% dropoff')).toBeInTheDocument();
      expect(screen.getByText('25.0% dropoff')).toBeInTheDocument();
      expect(screen.getByText('66.7% dropoff')).toBeInTheDocument();
    });

    it('renders legend with color indicators', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      expect(screen.getByText('Excellent (50%+)')).toBeInTheDocument();
      expect(screen.getByText('Average (20-50%)')).toBeInTheDocument();
      expect(screen.getByText(/Needs Improvement/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading state', () => {
    it('shows skeleton when loading is true', () => {
      render(<ConversionFunnelChart stages={[]} loading />);

      // Should show skeleton elements with animate-shimmer class
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not show stage labels when loading', () => {
      render(<ConversionFunnelChart stages={mockStages} loading />);

      expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
      expect(screen.queryByText('Searched')).not.toBeInTheDocument();
    });

    it('applies correct height to skeleton', () => {
      const { container } = render(
        <ConversionFunnelChart stages={[]} loading height={500} />
      );

      const skeletonContainer = container.querySelector('.bg-linen\\/50');
      expect(skeletonContainer).toHaveStyle({ height: '500px' });
    });
  });

  // ===========================================================================
  // EMPTY STATE TESTS
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty state when stages array is empty', () => {
      render(<ConversionFunnelChart stages={[]} />);

      expect(screen.getByText('No funnel data available')).toBeInTheDocument();
    });

    it('shows empty state when stages is undefined', () => {
      // @ts-expect-error - Testing undefined behavior
      render(<ConversionFunnelChart stages={undefined} />);

      expect(screen.getByText('No funnel data available')).toBeInTheDocument();
    });

    it('applies correct height to empty state', () => {
      const { container } = render(
        <ConversionFunnelChart stages={[]} height={400} />
      );

      const emptyContainer = container.querySelector('.border-dashed');
      expect(emptyContainer).toHaveStyle({ height: '400px' });
    });
  });

  // ===========================================================================
  // COLOR CODING TESTS
  // ===========================================================================

  describe('color coding based on conversion rate', () => {
    it('applies green color for rates >= 50%', () => {
      const highRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 100, dropoffRate: 0 },
        { stage: 'searchers', label: 'High', count: 55, conversionRate: 55, dropoffRate: 45 },
      ];

      render(<ConversionFunnelChart stages={highRateStages} />);

      // Check for green text color on high conversion rate
      const greenText = document.querySelector('.text-green-500');
      expect(greenText).toBeInTheDocument();
    });

    it('applies yellow color for rates >= 20% and < 50%', () => {
      const mediumRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 100, dropoffRate: 0 },
        { stage: 'searchers', label: 'Medium', count: 35, conversionRate: 35, dropoffRate: 65 },
      ];

      render(<ConversionFunnelChart stages={mediumRateStages} />);

      // Check for yellow text color on medium conversion rate
      const yellowText = document.querySelector('.text-yellow-500');
      expect(yellowText).toBeInTheDocument();
    });

    it('applies red color for rates < 20%', () => {
      const lowRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 100, dropoffRate: 0 },
        { stage: 'searchers', label: 'Low', count: 10, conversionRate: 10, dropoffRate: 90 },
      ];

      render(<ConversionFunnelChart stages={lowRateStages} />);

      // Check for red text color on low conversion rate
      const redText = document.querySelector('.text-red-500');
      expect(redText).toBeInTheDocument();
    });

    it('applies green bar background for rates >= 50%', () => {
      const highRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 100, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={highRateStages} />);

      const greenBar = document.querySelector('.bg-green-500');
      expect(greenBar).toBeInTheDocument();
    });

    it('applies yellow bar background for rates 20-50%', () => {
      const medRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 30, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={medRateStages} />);

      const yellowBar = document.querySelector('.bg-yellow-500');
      expect(yellowBar).toBeInTheDocument();
    });

    it('applies red bar background for rates < 20%', () => {
      const lowRateStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Test', count: 100, conversionRate: 15, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={lowRateStages} />);

      const redBar = document.querySelector('.bg-red-500');
      expect(redBar).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // HEIGHT PROP TESTS
  // ===========================================================================

  describe('height prop', () => {
    it('uses default height of 400', () => {
      const { container } = render(<ConversionFunnelChart stages={mockStages} />);

      const chartContainer = container.querySelector('.bg-cream');
      expect(chartContainer).toHaveStyle({ minHeight: '400px' });
    });

    it('applies custom height', () => {
      const { container } = render(
        <ConversionFunnelChart stages={mockStages} height={600} />
      );

      const chartContainer = container.querySelector('.bg-cream');
      expect(chartContainer).toHaveStyle({ minHeight: '600px' });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles single stage', () => {
      const singleStage: FunnelStage[] = [
        { stage: 'visitors', label: 'Visitors', count: 100, conversionRate: 100, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={singleStage} />);

      expect(screen.getByText('Visitors')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
      // No dropoff should be shown for single stage
      expect(screen.queryByText(/dropoff/)).not.toBeInTheDocument();
    });

    it('handles zero counts', () => {
      const zeroCountStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Visitors', count: 0, conversionRate: 0, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={zeroCountStages} />);

      expect(screen.getByText('Visitors')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles large counts with M format', () => {
      const largeCountStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Large', count: 2500000, conversionRate: 100, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={largeCountStages} />);

      expect(screen.getByText('2.5M')).toBeInTheDocument();
    });

    it('does not show dropoff for 0% dropoff rate', () => {
      const noDropoffStages: FunnelStage[] = [
        { stage: 'visitors', label: 'Stage 1', count: 100, conversionRate: 100, dropoffRate: 0 },
        { stage: 'searchers', label: 'Stage 2', count: 100, conversionRate: 100, dropoffRate: 0 },
      ];

      render(<ConversionFunnelChart stages={noDropoffStages} />);

      // 0% dropoff should not be shown
      expect(screen.queryByText('0.0% dropoff')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STYLING TESTS
  // ===========================================================================

  describe('styling', () => {
    it('applies correct container styling', () => {
      const { container } = render(<ConversionFunnelChart stages={mockStages} />);

      const chartContainer = container.querySelector('.bg-cream.rounded-lg.border.border-border');
      expect(chartContainer).toBeInTheDocument();
    });

    it('has correct bar width styling', () => {
      render(<ConversionFunnelChart stages={mockStages} />);

      // First stage should have 100% width (scaled to max)
      const bars = document.querySelectorAll('.h-full.transition-all');
      expect(bars.length).toBe(mockStages.length);
    });
  });
});
