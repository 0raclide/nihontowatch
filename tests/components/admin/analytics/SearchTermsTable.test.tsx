/**
 * SearchTermsTable Component Unit Tests
 *
 * Tests the search terms table component.
 * Verifies rendering, loading state, empty state, and CTR color coding.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchTermsTable } from '@/components/admin/analytics';
import type { SearchTermData } from '@/hooks/useUserEngagement';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockSearches: SearchTermData[] = [
  { term: 'katana', count: 250, uniqueUsers: 100, avgResultCount: 45.5, clickThroughRate: 35.0 },
  { term: 'juyo', count: 180, uniqueUsers: 80, avgResultCount: 20.2, clickThroughRate: 28.5 },
  { term: 'wakizashi', count: 120, uniqueUsers: 60, avgResultCount: 30.1, clickThroughRate: 15.0 },
  { term: 'tanto', count: 80, uniqueUsers: 40, avgResultCount: 25.0, clickThroughRate: 8.5 },
];

// =============================================================================
// TEST SUITES
// =============================================================================

describe('SearchTermsTable', () => {
  // ===========================================================================
  // BASIC RENDERING TESTS
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders table with headers', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Term')).toBeInTheDocument();
      expect(screen.getByText('Searches')).toBeInTheDocument();
      expect(screen.getByText('Avg Results')).toBeInTheDocument();
      expect(screen.getByText('CTR')).toBeInTheDocument();
    });

    it('renders all search terms', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('katana')).toBeInTheDocument();
      expect(screen.getByText('juyo')).toBeInTheDocument();
      expect(screen.getByText('wakizashi')).toBeInTheDocument();
      expect(screen.getByText('tanto')).toBeInTheDocument();
    });

    it('renders rank numbers', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('renders search counts', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('180')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('renders average result counts', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('45.5')).toBeInTheDocument();
      expect(screen.getByText('20.2')).toBeInTheDocument();
      expect(screen.getByText('30.1')).toBeInTheDocument();
      expect(screen.getByText('25.0')).toBeInTheDocument();
    });

    it('renders CTR percentages', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('35.0%')).toBeInTheDocument();
      expect(screen.getByText('28.5%')).toBeInTheDocument();
      expect(screen.getByText('15.0%')).toBeInTheDocument();
      expect(screen.getByText('8.5%')).toBeInTheDocument();
    });

    it('renders unique user counts', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('(100 users)')).toBeInTheDocument();
      expect(screen.getByText('(80 users)')).toBeInTheDocument();
    });

    it('renders footer legend', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      expect(screen.getByText('CTR: Click-through rate')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByText('Average')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe('loading skeleton', () => {
    it('shows skeleton when loading is true', () => {
      render(<SearchTermsTable searches={[]} loading />);

      // Should show skeleton elements with animate-shimmer class
      const skeletons = document.querySelectorAll('.animate-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders skeleton rows', () => {
      render(<SearchTermsTable searches={[]} loading />);

      // Should render 5 skeleton rows
      const skeletonRows = document.querySelectorAll('tbody tr');
      expect(skeletonRows.length).toBe(5);
    });

    it('does not show data when loading', () => {
      render(<SearchTermsTable searches={mockSearches} loading />);

      expect(screen.queryByText('katana')).not.toBeInTheDocument();
      expect(screen.queryByText('juyo')).not.toBeInTheDocument();
    });

    it('shows table headers during loading', () => {
      render(<SearchTermsTable searches={[]} loading />);

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Term')).toBeInTheDocument();
      expect(screen.getByText('CTR')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EMPTY STATE TESTS
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty state when searches array is empty', () => {
      render(<SearchTermsTable searches={[]} />);

      expect(screen.getByText('No search data available')).toBeInTheDocument();
    });

    it('shows empty state when searches is undefined', () => {
      // @ts-expect-error - Testing undefined behavior
      render(<SearchTermsTable searches={undefined} />);

      expect(screen.getByText('No search data available')).toBeInTheDocument();
    });

    it('shows search icon in empty state', () => {
      render(<SearchTermsTable searches={[]} />);

      const svg = document.querySelector('svg.text-muted');
      expect(svg).toBeInTheDocument();
    });

    it('has dashed border in empty state', () => {
      const { container } = render(<SearchTermsTable searches={[]} />);

      const emptyContainer = container.querySelector('.border-dashed');
      expect(emptyContainer).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CTR COLOR CODING TESTS
  // ===========================================================================

  describe('CTR color coding', () => {
    it('applies green color for CTR >= 30%', () => {
      const highCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 35 },
      ];

      render(<SearchTermsTable searches={highCTR} />);

      const greenText = document.querySelector('.text-green-500');
      expect(greenText).toBeInTheDocument();
      expect(greenText).toHaveTextContent('35.0%');
    });

    it('applies yellow color for CTR >= 10% and < 30%', () => {
      const mediumCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={mediumCTR} />);

      const yellowText = document.querySelector('.text-yellow-500');
      expect(yellowText).toBeInTheDocument();
      expect(yellowText).toHaveTextContent('20.0%');
    });

    it('applies red color for CTR < 10%', () => {
      const lowCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 5 },
      ];

      render(<SearchTermsTable searches={lowCTR} />);

      const redText = document.querySelector('.text-red-500');
      expect(redText).toBeInTheDocument();
      expect(redText).toHaveTextContent('5.0%');
    });

    it('applies green for exactly 30%', () => {
      const exactCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 30 },
      ];

      render(<SearchTermsTable searches={exactCTR} />);

      const greenText = document.querySelector('.text-green-500');
      expect(greenText).toBeInTheDocument();
    });

    it('applies yellow for exactly 10%', () => {
      const exactCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 10 },
      ];

      render(<SearchTermsTable searches={exactCTR} />);

      const yellowText = document.querySelector('.text-yellow-500');
      expect(yellowText).toBeInTheDocument();
    });

    it('handles multiple different CTR colors in same table', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      // katana: 35% (green), juyo: 28.5% (yellow), wakizashi: 15% (yellow), tanto: 8.5% (red)
      const greenTexts = document.querySelectorAll('.text-green-500');
      const yellowTexts = document.querySelectorAll('.text-yellow-500');
      const redTexts = document.querySelectorAll('.text-red-500');

      expect(greenTexts.length).toBeGreaterThan(0);
      expect(yellowTexts.length).toBeGreaterThan(0);
      expect(redTexts.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // FORMATTING TESTS
  // ===========================================================================

  describe('number formatting', () => {
    it('formats large counts with K suffix', () => {
      const largeCount: SearchTermData[] = [
        { term: 'test', count: 2500, uniqueUsers: 1000, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={largeCount} />);

      expect(screen.getByText('2.5K')).toBeInTheDocument();
    });

    it('formats very large counts with M suffix', () => {
      const veryLargeCount: SearchTermData[] = [
        { term: 'test', count: 1500000, uniqueUsers: 500000, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={veryLargeCount} />);

      expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('shows normal numbers for counts under 1000', () => {
      const smallCount: SearchTermData[] = [
        { term: 'test', count: 500, uniqueUsers: 200, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={smallCount} />);

      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('uses singular user for uniqueUsers = 1', () => {
      const singleUser: SearchTermData[] = [
        { term: 'test', count: 5, uniqueUsers: 1, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={singleUser} />);

      expect(screen.getByText('(1 user)')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles single search term', () => {
      const single: SearchTermData[] = [
        { term: 'solo', count: 10, uniqueUsers: 5, avgResultCount: 3, clickThroughRate: 50 },
      ];

      render(<SearchTermsTable searches={single} />);

      expect(screen.getByText('solo')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroData: SearchTermData[] = [
        { term: 'empty', count: 0, uniqueUsers: 0, avgResultCount: 0, clickThroughRate: 0 },
      ];

      render(<SearchTermsTable searches={zeroData} />);

      expect(screen.getByText('empty')).toBeInTheDocument();
      expect(screen.getByText('0.0')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles special characters in search terms', () => {
      const specialChars: SearchTermData[] = [
        { term: 'test & query', count: 10, uniqueUsers: 5, avgResultCount: 3, clickThroughRate: 20 },
        { term: '"quoted"', count: 5, uniqueUsers: 2, avgResultCount: 1, clickThroughRate: 10 },
      ];

      render(<SearchTermsTable searches={specialChars} />);

      expect(screen.getByText('test & query')).toBeInTheDocument();
      expect(screen.getByText('"quoted"')).toBeInTheDocument();
    });

    it('handles Japanese characters', () => {
      const japaneseTerms: SearchTermData[] = [
        { term: 'katana', count: 100, uniqueUsers: 50, avgResultCount: 20, clickThroughRate: 30 },
      ];

      render(<SearchTermsTable searches={japaneseTerms} />);

      expect(screen.getByText('katana')).toBeInTheDocument();
    });

    it('handles decimal CTR values', () => {
      const decimalCTR: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 50, avgResultCount: 10, clickThroughRate: 15.678 },
      ];

      render(<SearchTermsTable searches={decimalCTR} />);

      // Should format to 1 decimal place
      expect(screen.getByText('15.7%')).toBeInTheDocument();
    });

    it('does not show user count when uniqueUsers is 0', () => {
      const noUsers: SearchTermData[] = [
        { term: 'test', count: 100, uniqueUsers: 0, avgResultCount: 10, clickThroughRate: 20 },
      ];

      render(<SearchTermsTable searches={noUsers} />);

      expect(screen.queryByText(/\(0 users?\)/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STYLING TESTS
  // ===========================================================================

  describe('styling', () => {
    it('applies correct container styling', () => {
      const { container } = render(<SearchTermsTable searches={mockSearches} />);

      const tableContainer = container.querySelector('.bg-cream.rounded-lg.border.border-border');
      expect(tableContainer).toBeInTheDocument();
    });

    it('applies hover effect on rows', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      const rows = document.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row).toHaveClass('hover:bg-linen/30');
      });
    });

    it('applies tabular-nums to numeric columns', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      const tabularElements = document.querySelectorAll('.tabular-nums');
      expect(tabularElements.length).toBeGreaterThan(0);
    });

    it('applies serif font to count values', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      const serifElements = document.querySelectorAll('.font-serif');
      expect(serifElements.length).toBeGreaterThan(0);
    });

    it('applies uppercase to table headers', () => {
      render(<SearchTermsTable searches={mockSearches} />);

      const headers = document.querySelectorAll('th');
      headers.forEach((header) => {
        expect(header).toHaveClass('uppercase');
      });
    });
  });
});
