/**
 * MetricCard Component Unit Tests
 *
 * Tests the MetricCard component used in the analytics dashboard.
 * Verifies rendering, formatting, change indicators, and loading states.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/admin/analytics';

// =============================================================================
// TEST SUITES
// =============================================================================

describe('MetricCard', () => {
  // ===========================================================================
  // BASIC RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders title and value', () => {
      render(<MetricCard title="Total Value" value={1000000} />);

      expect(screen.getByText('Total Value')).toBeInTheDocument();
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });

    it('renders string value as-is', () => {
      render(<MetricCard title="Custom Value" value="Custom Text" />);

      expect(screen.getByText('Custom Value')).toBeInTheDocument();
      expect(screen.getByText('Custom Text')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(<MetricCard title="Test" value={100} subtitle="Additional info" />);

      expect(screen.getByText('Additional info')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      const testIcon = <span data-testid="test-icon">Icon</span>;
      render(<MetricCard title="Test" value={100} icon={testIcon} />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('applies uppercase styling to title', () => {
      render(<MetricCard title="Total Items" value={50} />);

      const title = screen.getByText('Total Items');
      expect(title).toHaveClass('uppercase');
    });
  });

  // ===========================================================================
  // CURRENCY FORMATTING TESTS
  // ===========================================================================

  describe('currency formatting', () => {
    it('formats currency values with JPY symbol', () => {
      render(<MetricCard title="Price" value={1500000} format="currency" currency="JPY" />);

      // Large value should use compact notation
      expect(screen.getByText(/\u00A51\.5M/)).toBeInTheDocument();
    });

    it('formats currency values with USD symbol', () => {
      render(<MetricCard title="Price" value={10000} format="currency" currency="USD" />);

      // Component uses toFixed(1) for K notation
      expect(screen.getByText(/\$10\.0K/)).toBeInTheDocument();
    });

    it('formats currency values with EUR symbol', () => {
      render(<MetricCard title="Price" value={9200} format="currency" currency="EUR" />);

      expect(screen.getByText(/\u20AC9\.2K/)).toBeInTheDocument();
    });

    it('uses compact notation for millions', () => {
      render(<MetricCard title="Market Value" value={2500000} format="currency" currency="JPY" />);

      expect(screen.getByText(/\u00A52\.5M/)).toBeInTheDocument();
    });

    it('uses compact notation for billions', () => {
      render(<MetricCard title="Total" value={1500000000} format="currency" currency="JPY" />);

      expect(screen.getByText(/\u00A51\.5B/)).toBeInTheDocument();
    });

    it('formats smaller values without compact notation', () => {
      render(<MetricCard title="Small Value" value={500} format="currency" currency="JPY" />);

      expect(screen.getByText(/\u00A5500/)).toBeInTheDocument();
    });

    it('defaults to JPY when no currency specified', () => {
      render(<MetricCard title="Price" value={100000} format="currency" />);

      // Component uses toFixed(1) for K notation
      expect(screen.getByText(/\u00A5100\.0K/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // NUMBER FORMATTING TESTS
  // ===========================================================================

  describe('number formatting', () => {
    it('formats number with compact notation for thousands', () => {
      render(<MetricCard title="Items" value={1500} format="number" />);

      expect(screen.getByText('1.5K')).toBeInTheDocument();
    });

    it('formats number with compact notation for millions', () => {
      render(<MetricCard title="Views" value={2500000} format="number" />);

      expect(screen.getByText('2.5M')).toBeInTheDocument();
    });

    it('formats small numbers with locale formatting', () => {
      render(<MetricCard title="Count" value={999} format="number" />);

      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // PERCENT FORMATTING TESTS
  // ===========================================================================

  describe('percent formatting', () => {
    it('formats percent values correctly', () => {
      render(<MetricCard title="Growth" value={25.5} format="percent" />);

      expect(screen.getByText('25.5%')).toBeInTheDocument();
    });

    it('handles zero percent', () => {
      render(<MetricCard title="Change" value={0} format="percent" />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles negative percent', () => {
      render(<MetricCard title="Decline" value={-10.3} format="percent" />);

      expect(screen.getByText('-10.3%')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CHANGE INDICATOR TESTS
  // ===========================================================================

  describe('change indicators', () => {
    it('shows positive change indicator with green styling', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 10, percent: 10, period: '7d' }}
        />
      );

      // Should show +10%
      expect(screen.getByText(/\+10\.0%/)).toBeInTheDocument();
      // Should have success/green color
      const changeText = screen.getByText(/\+10\.0%/);
      expect(changeText).toHaveClass('text-success');
    });

    it('shows negative change indicator with red styling', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: -10, percent: -10, period: '7d' }}
        />
      );

      // Should show -10%
      expect(screen.getByText(/-10\.0%/)).toBeInTheDocument();
      // Should have error/red color
      const changeText = screen.getByText(/-10\.0%/);
      expect(changeText).toHaveClass('text-error');
    });

    it('shows zero change without arrow', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 0, percent: 0, period: '7d' }}
        />
      );

      // Should show 0%
      expect(screen.getByText('0%')).toBeInTheDocument();
      // Should have muted color
      const changeText = screen.getByText('0%');
      expect(changeText).toHaveClass('text-muted');
    });

    it('shows period label for change', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 5, percent: 5, period: 'vs last week' }}
        />
      );

      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });

    it('shows up arrow for positive change', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 10, percent: 10, period: '7d' }}
        />
      );

      // Check for SVG arrow (up arrow has specific path)
      const svg = document.querySelector('svg.text-success');
      expect(svg).toBeInTheDocument();
    });

    it('shows down arrow for negative change', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: -10, percent: -10, period: '7d' }}
        />
      );

      // Check for SVG arrow (down arrow has specific path)
      const svg = document.querySelector('svg.text-error');
      expect(svg).toBeInTheDocument();
    });

    it('formats change percent with one decimal place', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 5, percent: 5.789, period: '7d' }}
        />
      );

      expect(screen.getByText(/\+5\.8%/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading state', () => {
    it('shows loading skeleton when loading is true', () => {
      render(<MetricCard title="Test" value={0} loading />);

      // Should show skeleton elements with animate-shimmer class
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not show value when loading', () => {
      render(<MetricCard title="Test" value={1000000} loading />);

      expect(screen.queryByText('1,000,000')).not.toBeInTheDocument();
    });

    it('does not show title when loading', () => {
      render(<MetricCard title="My Title" value={100} loading />);

      expect(screen.queryByText('My Title')).not.toBeInTheDocument();
    });

    it('does not show change indicator when loading', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 10, percent: 10, period: '7d' }}
          loading
        />
      );

      expect(screen.queryByText(/\+10/)).not.toBeInTheDocument();
    });

    it('has correct skeleton structure', () => {
      render(<MetricCard title="Test" value={0} loading />);

      // Check for background and border on container
      const container = document.querySelector('.bg-cream.rounded-xl');
      expect(container).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles very large numbers', () => {
      render(<MetricCard title="Huge Value" value={999999999999} format="currency" currency="JPY" />);

      // Should use billions notation
      expect(screen.getByText(/B/)).toBeInTheDocument();
    });

    it('handles zero value', () => {
      render(<MetricCard title="Zero" value={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles negative value', () => {
      render(<MetricCard title="Negative" value={-500} format="number" />);

      expect(screen.getByText('-500')).toBeInTheDocument();
    });

    it('handles decimal values', () => {
      render(<MetricCard title="Decimal" value={12.345} format="percent" />);

      expect(screen.getByText('12.3%')).toBeInTheDocument();
    });

    it('renders without optional props', () => {
      render(<MetricCard title="Minimal" value="Simple" />);

      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('Simple')).toBeInTheDocument();
    });

    it('handles very small positive change', () => {
      render(
        <MetricCard
          title="Test"
          value={100}
          change={{ value: 0.001, percent: 0.1, period: '7d' }}
        />
      );

      expect(screen.getByText(/\+0\.1%/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STYLING TESTS
  // ===========================================================================

  describe('styling', () => {
    it('applies correct container styling', () => {
      render(<MetricCard title="Test" value={100} />);

      const container = document.querySelector('.bg-cream.rounded-xl.p-6.border.border-border');
      expect(container).toBeInTheDocument();
    });

    it('applies serif font to value', () => {
      render(<MetricCard title="Test" value={100} />);

      const value = document.querySelector('.font-serif');
      expect(value).toBeInTheDocument();
    });

    it('applies tabular-nums to value for number alignment', () => {
      render(<MetricCard title="Test" value={100} />);

      const value = document.querySelector('.tabular-nums');
      expect(value).toBeInTheDocument();
    });

    it('applies icon container styling when icon provided', () => {
      const testIcon = <span>Icon</span>;
      render(<MetricCard title="Test" value={100} icon={testIcon} />);

      const iconContainer = document.querySelector('.bg-gold\\/10.rounded-lg');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ACCESSIBILITY TESTS
  // ===========================================================================

  describe('accessibility', () => {
    it('title is visible and readable', () => {
      render(<MetricCard title="Total Market Value" value={1000000} />);

      expect(screen.getByText('Total Market Value')).toBeVisible();
    });

    it('value is visible and readable', () => {
      render(<MetricCard title="Test" value={1000000} />);

      expect(screen.getByText('1,000,000')).toBeVisible();
    });

    it('subtitle is visible when provided', () => {
      render(<MetricCard title="Test" value={100} subtitle="Helper text" />);

      expect(screen.getByText('Helper text')).toBeVisible();
    });
  });
});
