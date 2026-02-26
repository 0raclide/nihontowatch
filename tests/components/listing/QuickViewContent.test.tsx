import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickViewContent } from '@/components/listing/QuickViewContent';
import type { Listing } from '@/types';

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock the useCurrency hook
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JPY',
    exchangeRates: null,
  }),
  formatPriceWithConversion: (value: number | null) =>
    value ? `¥${value.toLocaleString()}` : 'Ask',
}));

// Mock the useAuth hook — configurable per-test
let mockIsAdmin = false;
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockIsAdmin ? { id: 'admin-1' } : null,
    profile: null,
    session: null,
    isLoading: false,
    isAdmin: mockIsAdmin,
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock the QuickViewContext
vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => ({
    refreshCurrentListing: vi.fn(),
    closeQuickView: vi.fn(),
  }),
}));

// Mock the TranslatedTitle component
vi.mock('@/components/listing/TranslatedTitle', () => ({
  TranslatedTitle: ({ listing }: { listing: Listing }) => (
    <h1 data-testid="translated-title">{listing.title}</h1>
  ),
}));

// Mock the MetadataGrid component
vi.mock('@/components/listing/MetadataGrid', () => ({
  MetadataGrid: () => <div data-testid="metadata-grid">Metadata</div>,
  getCertInfo: (certType: string | undefined) => certType ? {
    shortLabel: certType,
    certKey: `cert.${certType}`,
    tier: certType === 'Juyo' ? 'juyo' : 'high',
  } : null,
  getArtisanInfo: () => ({ artisan: null, school: null }),
}));

// Mock returnContext (used when navigating to artist profile)
vi.mock('@/lib/listing/returnContext', () => ({
  saveListingReturnContext: vi.fn(),
}));

// Mock shouldShowNewBadge
vi.mock('@/lib/newListing', () => ({
  shouldShowNewBadge: () => false,
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

    it('renders certification badge', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('cert-badge')).toHaveTextContent('Jūyō');
    });

    it('renders MetadataGrid', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
    });
  });

  describe('Composition slots', () => {
    it('renders action bar slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          actionBarSlot={<div data-testid="mock-action-bar">Action Bar</div>}
        />
      );
      expect(screen.getByTestId('mock-action-bar')).toBeInTheDocument();
    });

    it('renders dealer slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          dealerSlot={<span data-testid="mock-dealer-row">Test Dealer</span>}
        />
      );
      expect(screen.getByTestId('mock-dealer-row')).toHaveTextContent('Test Dealer');
    });

    it('renders description slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          descriptionSlot={<div data-testid="mock-description">Description content</div>}
        />
      );
      expect(screen.getByTestId('mock-description')).toBeInTheDocument();
    });

    it('renders provenance slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          provenanceSlot={<div data-testid="mock-provenance">Provenance</div>}
        />
      );
      expect(screen.getByTestId('mock-provenance')).toBeInTheDocument();
    });

    it('renders admin tools slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          adminToolsSlot={<div data-testid="mock-admin-tools">Admin Tools</div>}
        />
      );
      expect(screen.getByTestId('mock-admin-tools')).toBeInTheDocument();
    });

    it('renders CTA slot', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          ctaSlot={<div data-testid="mock-cta">CTA Button</div>}
        />
      );
      expect(screen.getByTestId('mock-cta')).toBeInTheDocument();
    });

    it('renders all slots simultaneously', () => {
      render(
        <QuickViewContent
          listing={createMockListing()}
          actionBarSlot={<div data-testid="slot-action-bar" />}
          dealerSlot={<div data-testid="slot-dealer" />}
          descriptionSlot={<div data-testid="slot-description" />}
          provenanceSlot={<div data-testid="slot-provenance" />}
          adminToolsSlot={<div data-testid="slot-admin" />}
          ctaSlot={<div data-testid="slot-cta" />}
        />
      );
      expect(screen.getByTestId('slot-action-bar')).toBeInTheDocument();
      expect(screen.getByTestId('slot-dealer')).toBeInTheDocument();
      expect(screen.getByTestId('slot-description')).toBeInTheDocument();
      expect(screen.getByTestId('slot-provenance')).toBeInTheDocument();
      expect(screen.getByTestId('slot-admin')).toBeInTheDocument();
      expect(screen.getByTestId('slot-cta')).toBeInTheDocument();
    });

    it('omits optional slots gracefully', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      // No slots passed — component should render without errors
      expect(screen.getByTestId('price-display')).toBeInTheDocument();
      expect(screen.getByTestId('translated-title')).toBeInTheDocument();
    });
  });

  describe('Setsumei sections removed (now in Study mode)', () => {
    it('does NOT show inline setsumei sections', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.queryByTestId('setsumei-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('yuhinkai-enrichment-section')).not.toBeInTheDocument();
    });

    it('does NOT show old enrichment elements', () => {
      render(<QuickViewContent listing={createMockListing()} />);
      expect(screen.queryByTestId('enrichment-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByTestId('enrichment-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-enriched-badge')).not.toBeInTheDocument();
    });
  });

  describe('Item type variations', () => {
    it('works with different tosogu types', () => {
      const tosoguTypes = ['tsuba', 'fuchi_kashira', 'kozuka', 'menuki'];

      tosoguTypes.forEach((itemType) => {
        const { unmount } = render(<QuickViewContent listing={createMockListing({ item_type: itemType as any })} />);
        expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
        unmount();
      });
    });

    it('works with sword types', () => {
      const swordTypes = ['katana', 'wakizashi', 'tanto'];

      swordTypes.forEach((itemType) => {
        const { unmount } = render(<QuickViewContent listing={createMockListing({ item_type: itemType as any })} />);
        expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
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

  // =========================================================================
  // REGRESSION: Admin artisan tools consolidated into AdminEditView
  // ArtisanTooltip and AdminArtisanWidget were removed from QuickViewContent.
  // Admin action buttons are now passed via slots (BrowseActionBar).
  // These tests guard against re-introduction of inline admin tools.
  // =========================================================================

  describe('Admin artisan tool consolidation (regression)', () => {
    const matchedAdminListing = createMockListing({
      artisan_id: 'MAS590',
      artisan_confidence: 'HIGH',
      artisan_display_name: 'Masamune',
    });

    const unmatchedAdminListing = createMockListing({
      artisan_id: undefined,
      artisan_confidence: undefined,
    });

    beforeEach(() => {
      mockIsAdmin = true;
    });

    afterEach(() => {
      mockIsAdmin = false;
    });

    it('renders artist identity as a plain link, not a tooltip trigger', () => {
      render(<QuickViewContent listing={matchedAdminListing} />);

      // The artist name should be rendered as a link to the profile page
      const link = screen.getByText('Masamune').closest('a');
      expect(link).toHaveAttribute('href', '/artists/MAS590');

      // No artisan-tooltip portal or popover should exist
      expect(screen.queryByTestId('artisan-tooltip')).not.toBeInTheDocument();
      expect(screen.queryByTestId('artisan-tooltip-portal')).not.toBeInTheDocument();
    });

    it('does not render AdminArtisanWidget for admin users', () => {
      render(<QuickViewContent listing={matchedAdminListing} />);

      // AdminArtisanWidget was a collapsible "Artisan" panel with search
      expect(screen.queryByTestId('admin-artisan-widget')).not.toBeInTheDocument();
    });

    it('does not render "Set ID" tooltip trigger for unmatched listings', () => {
      render(<QuickViewContent listing={unmatchedAdminListing} />);

      // The old "Set ID" trigger was an ArtisanTooltip for unmatched listings
      expect(screen.queryByText('Set ID')).not.toBeInTheDocument();
      expect(screen.queryByTestId('artisan-tooltip')).not.toBeInTheDocument();
    });

    it('does not render admin buttons inline — they come from actionBarSlot', () => {
      // Without an actionBarSlot, no admin buttons should appear
      render(<QuickViewContent listing={matchedAdminListing} />);

      expect(screen.queryByLabelText('Edit fields')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Mark as sold')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Hide listing')).not.toBeInTheDocument();
    });

    it('renders admin buttons when passed via actionBarSlot', () => {
      render(
        <QuickViewContent
          listing={matchedAdminListing}
          actionBarSlot={
            <>
              <button aria-label="Edit fields">Edit</button>
              <button aria-label="Mark as sold">Sold</button>
              <button aria-label="Hide listing">Hide</button>
            </>
          }
        />
      );

      expect(screen.getByLabelText('Edit fields')).toBeInTheDocument();
      expect(screen.getByLabelText('Mark as sold')).toBeInTheDocument();
      expect(screen.getByLabelText('Hide listing')).toBeInTheDocument();
    });
  });
});
