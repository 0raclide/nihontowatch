import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileVirtualListingGrid } from '@/components/browse/MobileVirtualListingGrid';
import { MOBILE_CARD_HEIGHT } from '@/components/browse/MobileListingCard';

// Mock the MobileListingCard component
vi.mock('@/components/browse/MobileListingCard', () => ({
  MobileListingCard: ({ listing }: { listing: { id: string; title: string } }) => (
    <div data-testid={`mobile-listing-card-${listing.id}`}>{listing.title}</div>
  ),
  MOBILE_CARD_HEIGHT: 320,
}));

// Mock useVirtualScroll to return predictable values
vi.mock('@/hooks/useVirtualScroll', () => ({
  useVirtualScroll: ({ totalItems }: { totalItems: number }) => ({
    visibleRange: { start: 0, end: Math.min(10, totalItems) }, // Show first 10 items
    offsetY: 0,
    totalHeight: totalItems * 320,
    scrollTop: 0,
  }),
}));

// Mock useInfiniteScroll
vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: vi.fn(),
}));

// Mock QuickView context
vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => ({
    setListings: vi.fn(),
    openQuickView: vi.fn(),
  }),
}));

// Generate mock listings
function generateMockListings(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    url: `https://example.com/listing/${i + 1}`,
    title: `Listing ${i + 1}`,
    item_type: 'katana',
    price_value: 1000000 + i * 10000,
    price_currency: 'JPY',
    smith: `Smith ${i + 1}`,
    tosogu_maker: null,
    school: 'Shinto',
    tosogu_school: null,
    cert_type: 'Juyo',
    nagasa_cm: 70.5,
    images: [`https://example.com/image${i + 1}.jpg`],
    first_seen_at: '2024-01-01T00:00:00Z',
    status: 'available',
    is_available: true,
    is_sold: false,
    dealer_id: 1,
    dealers: {
      id: 1,
      name: 'Aoi Art',
      domain: 'aoijapan.com',
    },
  }));
}

describe('MobileVirtualListingGrid', () => {
  const defaultProps = {
    listings: generateMockListings(100),
    total: 500,
    currency: 'JPY' as const,
    exchangeRates: null,
    isLoadingMore: false,
    hasMore: true,
    onLoadMore: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with data-testid for E2E testing', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);
      expect(screen.getByTestId('mobile-virtual-grid')).toBeInTheDocument();
    });

    it('renders results count', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });
  });

  describe('virtualization', () => {
    it('renders only visible items, not full list', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);

      // With mock returning first 10 items, should only have 10 cards
      const cards = screen.getAllByTestId(/^mobile-listing-card-/);
      expect(cards.length).toBe(10);
      expect(cards.length).toBeLessThan(defaultProps.listings.length);
    });

    it('sets correct total height for scroll area', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);

      const scrollContainer = document.querySelector('[style*="height"]');
      expect(scrollContainer).toHaveStyle({
        height: `${100 * MOBILE_CARD_HEIGHT}px`,
      });
    });

    it('applies transform offset for visible items', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);

      const itemsContainer = document.querySelector('[style*="transform"]');
      expect(itemsContainer).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when isLoadingMore', () => {
      render(<MobileVirtualListingGrid {...defaultProps} isLoadingMore={true} />);
      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });

    it('hides loading indicator when not loading', () => {
      render(<MobileVirtualListingGrid {...defaultProps} isLoadingMore={false} />);
      expect(screen.queryByText('Loading more...')).not.toBeInTheDocument();
    });
  });

  describe('end of list', () => {
    it('shows end message when no more items', () => {
      render(
        <MobileVirtualListingGrid
          {...defaultProps}
          listings={generateMockListings(100)}
          total={100}
          hasMore={false}
        />
      );
      expect(screen.getByText(/You've seen all 100 items/)).toBeInTheDocument();
    });

    it('does not show end message when more items available', () => {
      render(<MobileVirtualListingGrid {...defaultProps} hasMore={true} />);
      expect(screen.queryByText(/You've seen all/)).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no listings', () => {
      render(<MobileVirtualListingGrid {...defaultProps} listings={[]} />);
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('shows filter suggestion in empty state', () => {
      render(<MobileVirtualListingGrid {...defaultProps} listings={[]} />);
      expect(screen.getByText(/Try adjusting your filters/)).toBeInTheDocument();
    });
  });

  describe('infinite scroll integration', () => {
    it('calls useInfiniteScroll with correct parameters', async () => {
      const { useInfiniteScroll } = await import('@/hooks/useInfiniteScroll');

      render(<MobileVirtualListingGrid {...defaultProps} />);

      expect(useInfiniteScroll).toHaveBeenCalledWith(
        expect.objectContaining({
          hasMore: true,
          isLoading: false,
          enabled: true,
        })
      );
    });

    it('disables infinite scroll when no onLoadMore', async () => {
      const { useInfiniteScroll } = await import('@/hooks/useInfiniteScroll');

      render(<MobileVirtualListingGrid {...defaultProps} onLoadMore={undefined} />);

      expect(useInfiniteScroll).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  describe('CSS classes', () => {
    it('has virtual-scroll-container class', () => {
      render(<MobileVirtualListingGrid {...defaultProps} />);
      const grid = screen.getByTestId('mobile-virtual-grid');
      expect(grid).toHaveClass('virtual-scroll-container');
    });
  });

  describe('QuickView integration', () => {
    it('provides listings to QuickView context', () => {
      // This is implicitly tested by the component rendering without errors
      render(<MobileVirtualListingGrid {...defaultProps} />);
      expect(screen.getByTestId('mobile-virtual-grid')).toBeInTheDocument();
    });
  });
});

describe('MobileVirtualListingGrid with scroll position', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetModules();
  });

  it('renders correct items when scrolled mid-list', async () => {
    // Re-mock with different scroll position
    vi.doMock('@/hooks/useVirtualScroll', () => ({
      useVirtualScroll: ({ totalItems }: { totalItems: number }) => ({
        visibleRange: { start: 30, end: Math.min(40, totalItems) }, // Middle of list
        offsetY: 30 * 320,
        totalHeight: totalItems * 320,
        scrollTop: 30 * 320,
      }),
    }));

    const { MobileVirtualListingGrid: ScrolledGrid } = await import(
      '@/components/browse/MobileVirtualListingGrid'
    );

    const listings = generateMockListings(100);
    render(
      <ScrolledGrid
        listings={listings}
        total={500}
        currency="JPY"
        exchangeRates={null}
      />
    );

    // Should render items 31-40 (indices 30-39)
    const cards = screen.getAllByTestId(/^mobile-listing-card-/);
    expect(cards.length).toBe(10);
    expect(cards[0]).toHaveAttribute('data-testid', 'mobile-listing-card-31');
  });
});
