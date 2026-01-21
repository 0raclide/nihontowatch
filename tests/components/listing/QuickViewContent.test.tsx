import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  // Note: Supabase returns 'dealers' (plural) from the join, not 'dealer' (singular)
  // This test must use 'dealers' to match real production data
  dealers: {
    id: 1,
    name: 'Test Dealer',
    domain: 'testdealer.com',
    country: 'JP',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  ...overrides,
});

describe('QuickViewContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('SetsumeiSection display', () => {
    it('always shows SetsumeiSection', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
    });

    it('shows SetsumeiSection for katana listings', () => {
      render(<QuickViewContent listing={createMockListing({ item_type: 'katana' as any })} />);
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
    });

    it('shows SetsumeiSection for tsuba listings', () => {
      render(<QuickViewContent listing={createMockListing({ item_type: 'tsuba' as any })} />);
      expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
    });

    it('does NOT show old enrichment elements', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.queryByTestId('enrichment-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByTestId('enrichment-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-enriched-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('yuhinkai-enrichment-section')).not.toBeInTheDocument();
    });
  });

  describe('Item type variations', () => {
    it('works with different tosogu types', () => {
      const tosoguTypes = ['tsuba', 'fuchi_kashira', 'kozuka', 'menuki'];

      tosoguTypes.forEach((itemType) => {
        const { unmount } = render(<QuickViewContent listing={createMockListing({ item_type: itemType as any })} />);
        expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
        unmount();
      });
    });

    it('works with sword types', () => {
      const swordTypes = ['katana', 'wakizashi', 'tanto'];

      swordTypes.forEach((itemType) => {
        const { unmount } = render(<QuickViewContent listing={createMockListing({ item_type: itemType as any })} />);
        expect(screen.getByTestId('setsumei-section')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Price display', () => {
    it('shows formatted price for valued listings', () => {
      render(<QuickViewContent listing={createMockListing({ price_value: 1000000 })} />);
      expect(screen.getByTestId('price-display')).toHaveTextContent('¥1,000,000');
    });

    it('shows "Ask" for listings without price', () => {
      render(<QuickViewContent listing={createMockListing({ price_value: null })} />);
      expect(screen.getByTestId('price-display')).toHaveTextContent('Ask');
    });
  });

  describe('UI components', () => {
    it('renders FavoriteButton', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    it('renders ShareButton', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('share-button')).toBeInTheDocument();
    });

    it('renders MetadataGrid', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
    });

    it('renders TranslatedDescription', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('translated-description')).toBeInTheDocument();
    });
  });
});
