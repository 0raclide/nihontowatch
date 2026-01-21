import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QuickViewContent } from '@/components/listing/QuickViewContent';
import type { Listing } from '@/types';

// Mock the FavoriteButton component
vi.mock('@/components/favorites/FavoriteButton', () => ({
  FavoriteButton: ({ listingId }: { listingId: number }) => (
    <button data-testid="favorite-button" data-listing-id={listingId}>
      Favorite
    </button>
  ),
}));

// Mock the ShareButton component
vi.mock('@/components/share/ShareButton', () => ({
  ShareButton: ({ listingId }: { listingId: number }) => (
    <button data-testid="share-button" data-listing-id={listingId}>
      Share
    </button>
  ),
}));

// Mock the useCurrency hook
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JPY',
    exchangeRates: null,
  }),
  formatPriceWithConversion: (value: number | null) =>
    value ? `¥${value.toLocaleString()}` : 'Ask',
}));

// Mock the useListingEnrichment hook
const mockUseListingEnrichment = vi.fn();
vi.mock('@/hooks/useListingEnrichment', () => ({
  useListingEnrichment: (...args: unknown[]) => mockUseListingEnrichment(...args),
}));

// Mock the YuhinkaiEnrichmentSection component
vi.mock('@/components/listing/YuhinkaiEnrichmentSection', () => ({
  YuhinkaiEnrichmentSection: ({ listing }: { listing: { yuhinkai_enrichment: unknown } }) => (
    listing.yuhinkai_enrichment ? (
      <div data-testid="yuhinkai-enrichment-section">
        Yuhinkai Enrichment Content
      </div>
    ) : null
  ),
}));

// Mock the CatalogEnrichedBadge component
vi.mock('@/components/ui/CatalogEnrichedBadge', () => ({
  CatalogEnrichedBadge: ({ enrichment }: { enrichment: unknown }) => (
    enrichment ? (
      <span data-testid="catalog-enriched-badge">Catalog Enriched</span>
    ) : null
  ),
}));

// Mock the SetsumeiSection component
vi.mock('@/components/listing/SetsumeiSection', () => ({
  SetsumeiSection: () => (
    <div data-testid="setsumei-section">Setsumei Content</div>
  ),
}));

// Mock the TranslatedTitle component
vi.mock('@/components/listing/TranslatedTitle', () => ({
  TranslatedTitle: ({ listing }: { listing: Listing }) => (
    <h1 data-testid="translated-title">{listing.title}</h1>
  ),
}));

// Mock the TranslatedDescription component
vi.mock('@/components/listing/TranslatedDescription', () => ({
  TranslatedDescription: () => (
    <div data-testid="translated-description">Description</div>
  ),
}));

// Mock the MetadataGrid component
vi.mock('@/components/listing/MetadataGrid', () => ({
  MetadataGrid: () => <div data-testid="metadata-grid">Metadata</div>,
  getCertInfo: (certType: string | undefined) => certType ? {
    shortLabel: certType,
    tier: certType === 'Juyo' ? 'premier' : 'high',
  } : null,
}));

// Sample listing data
const createMockListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 123,
  url: 'https://example.com/listing/123',
  title: 'Test Tsuba by Nomura Kanenori',
  item_type: 'tsuba' as any,
  price_value: 500000,
  price_currency: 'JPY',
  smith: null,
  tosogu_maker: 'Nomura Kanenori',
  school: null,
  tosogu_school: 'Hikone',
  cert_type: 'Juyo',
  images: ['image1.jpg'],
  first_seen_at: new Date().toISOString(),
  last_scraped_at: new Date().toISOString(),
  status: 'available',
  is_available: true,
  is_sold: false,
  dealer_id: 1,
  dealer: {
    id: 1,
    name: 'Test Dealer',
    domain: 'testdealer.com',
    country: 'JP',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  ...overrides,
});

const mockEnrichment = {
  enrichment_id: 1,
  listing_id: 123,
  setsumei_en: 'Test translation',
  match_confidence: 'DEFINITIVE',
  enriched_maker: 'Nomura Kanenori',
};

describe('QuickViewContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no enrichment
    mockUseListingEnrichment.mockReturnValue({
      enrichment: null,
      isLoading: false,
      error: null,
      isEligible: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders the listing title', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('translated-title')).toHaveTextContent('Test Tsuba');
    });

    it('renders the price', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('price-display')).toHaveTextContent('¥500,000');
    });

    it('renders the dealer name', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('dealer-name')).toHaveTextContent('Test Dealer');
    });

    it('renders certification badge', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('cert-badge')).toHaveTextContent('Juyo');
    });

    it('renders CTA button with dealer name', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('cta-button')).toHaveTextContent('View on Test Dealer');
    });
  });

  describe('Enrichment display', () => {
    it('shows SetsumeiSection when not eligible for enrichment', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: null,
        isLoading: false,
        error: null,
        isEligible: false,
      });

      render(<QuickViewContent listing={createMockListing({ item_type: 'katana' as any })} />);
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
      expect(screen.queryByTestId('enrichment-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByTestId('yuhinkai-enrichment-section')).not.toBeInTheDocument();
    });

    it('shows loading skeleton when eligible and loading', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: null,
        isLoading: true,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('enrichment-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('setsumei-section')).not.toBeInTheDocument();
    });

    it('shows YuhinkaiEnrichmentSection when enrichment is loaded', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: mockEnrichment,
        isLoading: false,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('enrichment-section')).toBeInTheDocument();
      expect(screen.getByTestId('yuhinkai-enrichment-section')).toBeInTheDocument();
      expect(screen.queryByTestId('setsumei-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('enrichment-skeleton')).not.toBeInTheDocument();
    });

    it('shows CatalogEnrichedBadge when enrichment is loaded', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: mockEnrichment,
        isLoading: false,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('catalog-enriched-badge')).toBeInTheDocument();
    });

    it('does NOT show CatalogEnrichedBadge when no enrichment', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: null,
        isLoading: false,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.queryByTestId('catalog-enriched-badge')).not.toBeInTheDocument();
    });

    it('shows SetsumeiSection as fallback when eligible but no enrichment found', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: null,
        isLoading: false,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
    });

    it('enrichment section has animation class', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: mockEnrichment,
        isLoading: false,
        error: null,
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      const enrichmentSection = screen.getByTestId('enrichment-section');
      expect(enrichmentSection).toHaveClass('animate-slideUpReveal');
    });
  });

  describe('Hook integration', () => {
    it('calls useListingEnrichment with correct parameters', () => {
      const listing = createMockListing({
        id: 456,
        item_type: 'tsuba' as any,
        cert_type: 'Juyo',
      });

      render(<QuickViewContent listing={listing} />);

      expect(mockUseListingEnrichment).toHaveBeenCalledWith(
        456,          // listing ID
        'tsuba',      // item type
        'Juyo'        // cert type
      );
    });

    it('handles different listing IDs', () => {
      const listing1 = createMockListing({ id: 100 });
      const listing2 = createMockListing({ id: 200 });

      const { rerender } = render(<QuickViewContent listing={listing1} />);
      expect(mockUseListingEnrichment).toHaveBeenLastCalledWith(100, 'tsuba', 'Juyo');

      rerender(<QuickViewContent listing={listing2} />);
      expect(mockUseListingEnrichment).toHaveBeenLastCalledWith(200, 'tsuba', 'Juyo');
    });
  });

  describe('Error handling', () => {
    it('shows SetsumeiSection when enrichment fetch errors', () => {
      mockUseListingEnrichment.mockReturnValue({
        enrichment: null,
        isLoading: false,
        error: new Error('Network error'),
        isEligible: true,
      });

      render(<QuickViewContent listing={createMockListing()} />);
      // Should fallback to SetsumeiSection on error
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
    });
  });

  describe('Item type variations', () => {
    it('works with different tosogu types', () => {
      const tosoguTypes = ['tsuba', 'fuchi_kashira', 'kozuka', 'menuki'];

      tosoguTypes.forEach((itemType) => {
        mockUseListingEnrichment.mockClear();
        mockUseListingEnrichment.mockReturnValue({
          enrichment: null,
          isLoading: false,
          error: null,
          isEligible: false,
        });

        render(<QuickViewContent listing={createMockListing({ item_type: itemType as any })} />);

        expect(mockUseListingEnrichment).toHaveBeenCalledWith(
          123,
          itemType,
          'Juyo'
        );
      });
    });
  });
});
