import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListingGrid } from '@/components/browse/ListingGrid';

// Mock ListingCard to simplify testing
vi.mock('@/components/browse/ListingCard', () => ({
  ListingCard: ({ listing }: { listing: { id: string; title: string } }) => (
    <div data-testid={`listing-card-${listing.id}`}>{listing.title}</div>
  ),
}));

// Mock useAdaptiveVirtualScroll to avoid window access issues
vi.mock('@/hooks/useAdaptiveVirtualScroll', () => ({
  useAdaptiveVirtualScroll: ({ items }: { items: unknown[] }) => ({
    visibleItems: items,
    startIndex: 0,
    totalHeight: 0,
    offsetY: 0,
    columns: 3,
    rowHeight: 310,
    isVirtualized: false,
  }),
}));

const mockListings = [
  {
    id: '1',
    url: 'https://example.com/1',
    title: 'Test Katana 1',
    item_type: 'katana',
    price_value: 100000,
    price_currency: 'JPY',
    smith: 'Test Smith',
    tosogu_maker: null,
    school: 'Bizen',
    tosogu_school: null,
    cert_type: 'Juyo',
    nagasa_cm: 70,
    images: ['https://example.com/img1.jpg'],
    first_seen_at: '2024-01-01',
    status: 'available',
    is_available: true,
    is_sold: false,
    dealer_id: 1,
    dealers: { id: 1, name: 'Aoi Art', domain: 'aoijapan.com' },
  },
  {
    id: '2',
    url: 'https://example.com/2',
    title: 'Test Wakizashi',
    item_type: 'wakizashi',
    price_value: 50000,
    price_currency: 'JPY',
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    cert_type: null,
    nagasa_cm: 45,
    images: null,
    first_seen_at: '2024-01-02',
    status: 'available',
    is_available: true,
    is_sold: false,
    dealer_id: 2,
    dealers: { id: 2, name: 'Eirakudo', domain: 'eirakudo.com' },
  },
];

describe('ListingGrid Component', () => {
  const defaultProps = {
    listings: mockListings,
    total: 100,
    page: 1,
    totalPages: 5,
    onPageChange: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    infiniteScroll: false,
    currency: 'JPY' as const,
    exchangeRates: null,
  };

  it('renders listing cards', () => {
    render(<ListingGrid {...defaultProps} />);

    expect(screen.getByTestId('listing-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('listing-card-2')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<ListingGrid {...defaultProps} isLoading={true} />);

    // Should not show listing cards when loading
    expect(screen.queryByTestId('listing-card-1')).not.toBeInTheDocument();

    // Should show skeleton grid
    const skeletons = document.querySelectorAll('.img-loading');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no listings', () => {
    render(<ListingGrid {...defaultProps} listings={[]} />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters to see more results')).toBeInTheDocument();
  });

  it('shows results count on desktop', () => {
    render(<ListingGrid {...defaultProps} />);

    // Results count is hidden on mobile, visible on lg
    const resultsCount = document.querySelector('.hidden.lg\\:flex');
    expect(resultsCount).toBeInTheDocument();
    expect(resultsCount).toHaveTextContent('2');
    expect(resultsCount).toHaveTextContent('100');
  });

  describe('Grid responsive classes', () => {
    it('has responsive column classes (mobile-first 1-col)', () => {
      render(<ListingGrid {...defaultProps} />);

      const grid = document.querySelector('.grid');
      // New responsive grid: 1 col mobile, 2 sm, 3 lg, 4 xl, 5 2xl
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
      expect(grid).toHaveClass('xl:grid-cols-4');
      expect(grid).toHaveClass('2xl:grid-cols-5');
    });

    it('has responsive gap classes', () => {
      render(<ListingGrid {...defaultProps} />);

      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('gap-3');
      expect(grid).toHaveClass('sm:gap-4');
    });
  });

  describe('Pagination', () => {
    it('renders pagination when totalPages > 1', () => {
      render(<ListingGrid {...defaultProps} />);

      // Should show pagination buttons
      expect(screen.getByText('← Previous')).toBeInTheDocument();
      expect(screen.getByText('Next →')).toBeInTheDocument();
    });

    it('does not render pagination when totalPages = 1', () => {
      render(<ListingGrid {...defaultProps} totalPages={1} />);

      expect(screen.queryByText('← Previous')).not.toBeInTheDocument();
    });

    it('calls onPageChange when next is clicked', () => {
      const mockOnPageChange = vi.fn();
      render(<ListingGrid {...defaultProps} onPageChange={mockOnPageChange} />);

      // Click next - need to find the button containing "Next →"
      const nextButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Next')
      );
      fireEvent.click(nextButton!);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange when previous is clicked', () => {
      const mockOnPageChange = vi.fn();
      render(<ListingGrid {...defaultProps} page={2} onPageChange={mockOnPageChange} />);

      const prevButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Previous')
      );
      fireEvent.click(prevButton!);

      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it('disables previous button on first page', () => {
      render(<ListingGrid {...defaultProps} page={1} />);

      const prevButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Previous')
      );
      expect(prevButton).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<ListingGrid {...defaultProps} page={5} totalPages={5} />);

      const nextButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Next')
      );
      expect(nextButton).toBeDisabled();
    });

    describe('Mobile pagination display', () => {
      it('shows simplified page indicator on mobile', () => {
        render(<ListingGrid {...defaultProps} page={2} totalPages={5} />);

        // Mobile page indicator shows "page / total" format
        // Find the span with the page indicator text (not the arrow buttons)
        const mobileIndicator = screen.getByText('2 / 5');
        expect(mobileIndicator).toBeInTheDocument();
        expect(mobileIndicator).toHaveClass('sm:hidden');
      });

      it('hides full pagination on mobile', () => {
        render(<ListingGrid {...defaultProps} />);

        // Full pagination is hidden on mobile (hidden, visible on sm+)
        const fullPagination = document.querySelector('.hidden.sm\\:flex');
        expect(fullPagination).toBeInTheDocument();
      });

      it('has touch-friendly button height', () => {
        render(<ListingGrid {...defaultProps} />);

        // Pagination buttons should have min-h-[44px]
        const buttons = document.querySelectorAll('.min-h-\\[44px\\]');
        expect(buttons.length).toBeGreaterThan(0);
      });

      it('shows arrow only on mobile for previous button', () => {
        render(<ListingGrid {...defaultProps} page={2} />);

        // Should have both full text (hidden on mobile) and arrow (shown on mobile)
        expect(screen.getByText('← Previous')).toBeInTheDocument();
        expect(screen.getByText('←')).toBeInTheDocument();
      });

      it('shows arrow only on mobile for next button', () => {
        render(<ListingGrid {...defaultProps} />);

        expect(screen.getByText('Next →')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });
    });
  });

  describe('Infinite Scroll Mode', () => {
    it('hides pagination in infinite scroll mode', () => {
      render(<ListingGrid {...defaultProps} infiniteScroll={true} />);

      expect(screen.queryByText('← Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next →')).not.toBeInTheDocument();
    });

    it('shows loading more indicator when isLoadingMore', () => {
      render(<ListingGrid {...defaultProps} infiniteScroll={true} isLoadingMore={true} />);

      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });

    it('shows end of results message when all items loaded (with enough items)', () => {
      // End message only shows when listings.length >= 30
      const manyListings = Array.from({ length: 50 }, (_, i) => ({
        ...mockListings[0],
        id: String(i + 1),
        title: `Listing ${i + 1}`,
      }));

      render(<ListingGrid {...defaultProps} listings={manyListings} infiniteScroll={true} page={1} totalPages={1} />);

      expect(screen.getByText(/You've seen all/)).toBeInTheDocument();
    });

    it('does not show end message when more items available', () => {
      render(<ListingGrid {...defaultProps} infiniteScroll={true} page={1} totalPages={5} />);

      expect(screen.queryByText(/You've seen all/)).not.toBeInTheDocument();
    });
  });
});
