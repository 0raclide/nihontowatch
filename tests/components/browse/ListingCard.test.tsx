import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListingCard } from '@/components/browse/ListingCard';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="listing-image" {...props} />
  ),
}));

// Mock activity context (optional, returns null when not provided)
vi.mock('@/components/activity/ActivityProvider', () => ({
  useActivityOptional: () => null,
}));

// Mock quick view context (optional, returns null when not provided)
vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => null,
}));

// Mock viewport tracking (optional, returns null when not provided)
vi.mock('@/lib/viewport', () => ({
  useViewportTrackingOptional: () => null,
}));

// Mock image preloader
vi.mock('@/hooks/useImagePreloader', () => ({
  useImagePreloader: () => ({
    preloadListing: () => {},
    cancelPreloads: () => {},
  }),
}));

// Mock freshness helper
vi.mock('@/lib/freshness', () => ({
  getMarketTimeDisplay: () => null,
}));

// Mock images helper
vi.mock('@/lib/images', () => ({
  getAllImages: (listing: { images?: string[] | null; stored_images?: string[] | null }) =>
    listing.stored_images?.length ? listing.stored_images : (listing.images || []),
  getCachedValidation: () => undefined,
  isRenderFailed: () => false,
  setRenderFailed: () => {},
  dealerDoesNotPublishImages: () => false,
  getPlaceholderKanji: (itemType: string | null) => itemType === 'tsuba' ? '鍔' : '刀',
}));

// We DON'T mock newListing - we want to test the real integration

const mockListing = {
  id: '1',
  url: 'https://example.com/listing/1',
  title: 'Beautiful Katana by Nobuyoshi',
  item_type: 'katana',
  price_value: 1500000,
  price_currency: 'JPY',
  smith: 'Nobuyoshi',
  tosogu_maker: null,
  school: 'Bizen',
  tosogu_school: null,
  cert_type: 'Juyo',
  nagasa_cm: 70.5,
  images: ['https://example.com/image1.jpg'],
  first_seen_at: '2024-01-01',
  dealer_earliest_seen_at: '2023-01-01', // Established dealer (months ago)
  status: 'available',
  is_available: true,
  is_sold: false,
  dealer_id: 1,
  dealers: { id: 1, name: 'Aoi Art', domain: 'aoijapan.com' },
};

describe('ListingCard Component', () => {
  const defaultProps = {
    listing: mockListing,
    currency: 'JPY' as const,
    exchangeRates: null,
    priority: false,
  };

  it('renders listing title/type', () => {
    render(<ListingCard {...defaultProps} />);

    // Should show item type (Katana)
    expect(screen.getByText('Katana')).toBeInTheDocument();
  });

  it('renders dealer name in header', () => {
    render(<ListingCard {...defaultProps} />);

    // Shows dealer name (e.g., "Aoi Art") at top of card
    expect(screen.getByText('Aoi Art')).toBeInTheDocument();
  });

  it('renders certification badge', () => {
    render(<ListingCard {...defaultProps} />);

    expect(screen.getByText('Jūyō')).toBeInTheDocument();
  });

  it('renders artisan name', () => {
    render(<ListingCard {...defaultProps} />);

    expect(screen.getByText('Nobuyoshi')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<ListingCard {...defaultProps} />);

    // Price should be formatted
    expect(screen.getByText('¥1,500,000')).toBeInTheDocument();
  });

  it('shows "Ask" for null price', () => {
    const listingNoPrice = { ...mockListing, price_value: null };
    render(<ListingCard {...defaultProps} listing={listingNoPrice} />);

    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('shows sold overlay when item is sold', () => {
    // Sold items have both is_sold: true AND is_available: false
    const soldListing = { ...mockListing, is_sold: true, is_available: false, status: 'sold' };
    render(<ListingCard {...defaultProps} listing={soldListing} />);

    expect(screen.getByText('Sold')).toBeInTheDocument();
  });

  it('shows unavailable overlay for reserved items', () => {
    // Reserved items have is_available: false but is_sold: false
    const reservedListing = { ...mockListing, is_sold: false, is_available: false, status: 'reserved' };
    render(<ListingCard {...defaultProps} listing={reservedListing} />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('is clickable with correct data attributes', () => {
    render(<ListingCard {...defaultProps} />);

    // ListingCard is now a button that opens quick view, not a direct link
    // Use testid to find the main card container
    const card = screen.getByTestId('listing-card');
    expect(card).toHaveAttribute('data-listing-id', mockListing.id);
    expect(card).toHaveAttribute('role', 'button');
  });

  describe('Responsive styling', () => {
    it('has responsive content padding', () => {
      render(<ListingCard {...defaultProps} />);

      // Content container uses sz.cPad (gallery/large: px-6 pt-4 pb-5) with sm:/lg: overrides
      const contentDiv = document.querySelector('.px-6.sm\\:px-3.lg\\:px-4');
      expect(contentDiv).toBeInTheDocument();
    });

    it('has responsive title font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Title uses sz.type (gallery/large: text-[24px]) with sm:text-[15px] lg:text-base
      const title = document.querySelector('.text-\\[24px\\].sm\\:text-\\[15px\\].lg\\:text-base');
      expect(title).toBeInTheDocument();
    });

    it('has responsive price font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Price uses sz.price (gallery/large: text-[17px]) with sm:text-[14px] lg:text-[15px]
      const price = document.querySelector('.text-\\[17px\\].sm\\:text-\\[14px\\].lg\\:text-\\[15px\\]');
      expect(price).toBeInTheDocument();
    });

    it('has responsive dealer header padding', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer header uses sz.hPad (gallery/large: px-5 py-3) with sm:px-3 sm:py-2 lg:px-4 lg:py-2.5
      const dealerHeader = document.querySelector('.px-5.py-3.sm\\:px-3.sm\\:py-2.lg\\:px-4.lg\\:py-2\\.5');
      expect(dealerHeader).toBeInTheDocument();
    });

    it('has responsive dealer header font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer name uses sz.hText (gallery/large: text-[12px]) with sm:text-[9px] lg:text-[10px]
      const dealerName = document.querySelector('.text-\\[12px\\].sm\\:text-\\[9px\\].lg\\:text-\\[10px\\]');
      expect(dealerName).toBeInTheDocument();
    });

    it('has responsive certification badge font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Cert text uses sz.hText (gallery/large: text-[12px]) with sm:text-[9px] lg:text-[10px]
      const certBadge = document.querySelector('.text-\\[12px\\].sm\\:text-\\[9px\\].lg\\:text-\\[10px\\].uppercase');
      expect(certBadge).toBeInTheDocument();
    });

    it('has responsive artisan font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Artisan text uses sz.attr (gallery/large: text-[16px]) with sm:text-[11px] lg:text-[12px]
      const artisan = document.querySelector('.text-\\[16px\\].sm\\:text-\\[11px\\].lg\\:text-\\[12px\\]');
      expect(artisan).toBeInTheDocument();
    });
  });

  describe('Image handling', () => {
    it('renders image when available', () => {
      render(<ListingCard {...defaultProps} />);

      const image = screen.getByTestId('listing-image');
      expect(image).toHaveAttribute('src', mockListing.images![0]);
    });

    it('shows fallback icon when no images', () => {
      const noImageListing = { ...mockListing, images: null };
      render(<ListingCard {...defaultProps} listing={noImageListing} />);

      // Should show fallback SVG (image placeholder)
      expect(screen.queryByTestId('listing-image')).not.toBeInTheDocument();
    });
  });

  describe('Certification badge tiers', () => {
    it('shows juyo tier styling for Juyo', () => {
      render(<ListingCard {...defaultProps} />);

      // Current styling uses text-juyo class (colored text, no background badge)
      const badge = document.querySelector('.text-juyo');
      expect(badge).toBeInTheDocument();
    });

    it('shows toku-hozon tier styling for TokuHozon', () => {
      const tokuHozonListing = { ...mockListing, cert_type: 'TokuHozon' };
      render(<ListingCard {...defaultProps} listing={tokuHozonListing} />);

      // Current styling uses text-toku-hozon class (colored text, no background badge)
      const badge = document.querySelector('.text-toku-hozon');
      expect(badge).toBeInTheDocument();
    });

    it('shows hozon tier styling for Hozon', () => {
      const hozonListing = { ...mockListing, cert_type: 'Hozon' };
      render(<ListingCard {...defaultProps} listing={hozonListing} />);

      // Current styling uses text-hozon class (colored text, no background badge)
      const badge = document.querySelector('.text-hozon');
      expect(badge).toBeInTheDocument();
    });

    it('does not show badge when no certification', () => {
      const noCertListing = { ...mockListing, cert_type: null };
      render(<ListingCard {...defaultProps} listing={noCertListing} />);

      expect(screen.queryByText('Jūyō')).not.toBeInTheDocument();
      expect(screen.queryByText('Hozon')).not.toBeInTheDocument();
    });
  });

  describe('Currency conversion', () => {
    const exchangeRates = {
      base: 'USD',
      rates: { USD: 1, JPY: 150, EUR: 0.92 },
      timestamp: Date.now(),
    };

    it('displays price in selected currency', () => {
      render(
        <ListingCard
          {...defaultProps}
          currency="USD"
          exchangeRates={exchangeRates}
        />
      );

      // 1,500,000 JPY / 150 = $10,000 USD
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    it('displays price in EUR', () => {
      render(
        <ListingCard
          {...defaultProps}
          currency="EUR"
          exchangeRates={exchangeRates}
        />
      );

      // 1,500,000 JPY / 150 * 0.92 = €9,200 EUR
      expect(screen.getByText('€9,200')).toBeInTheDocument();
    });
  });

  describe('New listing badge', () => {
    // Established dealer baseline - scraped months ago
    const establishedDealerBaseline = '2025-06-01T12:00:00Z';

    beforeEach(() => {
      // Mock Date.now() to a fixed point for consistent "new" calculation
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "Early Access" badge for recently discovered listing (after baseline)', () => {
      const newListing = {
        ...mockListing,
        first_seen_at: '2026-01-12T12:00:00Z', // 3 days ago, well after baseline
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={newListing} />);

      const newBadge = screen.getByTestId('new-listing-badge');
      expect(newBadge).toBeInTheDocument();
      // Within 7-day early access window + trial mode off = "Early Access"
      expect(newBadge).toHaveTextContent('Early Access');
    });

    it('shows badge for listing discovered today', () => {
      const todayListing = {
        ...mockListing,
        first_seen_at: '2026-01-15T08:00:00Z', // Today
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={todayListing} />);

      expect(screen.getByTestId('new-listing-badge')).toBeInTheDocument();
    });

    it('shows badge for listing at threshold boundary (7 days)', () => {
      const boundaryListing = {
        ...mockListing,
        first_seen_at: '2026-01-08T12:00:00Z', // Exactly 7 days ago
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={boundaryListing} />);

      expect(screen.getByTestId('new-listing-badge')).toBeInTheDocument();
    });

    it('does NOT show badge for listing older than 7 days', () => {
      const oldListing = {
        ...mockListing,
        first_seen_at: '2026-01-07T12:00:00Z', // 8 days ago
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={oldListing} />);

      expect(screen.queryByTestId('new-listing-badge')).not.toBeInTheDocument();
    });

    it('does NOT show badge for listing from initial import (within 24h of baseline)', () => {
      // When a dealer is first scraped, all their items get first_seen_at within 24h of baseline
      const initialImportListing = {
        ...mockListing,
        first_seen_at: '2025-06-01T18:00:00Z', // 6 hours after baseline
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={initialImportListing} />);

      // No badge because this was part of initial import
      expect(screen.queryByTestId('new-listing-badge')).not.toBeInTheDocument();
    });

    it('does NOT show badge for listing exactly at baseline', () => {
      const atBaselineListing = {
        ...mockListing,
        first_seen_at: establishedDealerBaseline, // Same as baseline
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={atBaselineListing} />);

      expect(screen.queryByTestId('new-listing-badge')).not.toBeInTheDocument();
    });

    it('does NOT show badge when dealer_earliest_seen_at is null', () => {
      const listingNoBaseline = {
        ...mockListing,
        first_seen_at: '2026-01-12T12:00:00Z', // 3 days ago
        dealer_earliest_seen_at: null,
      };
      render(<ListingCard {...defaultProps} listing={listingNoBaseline} />);

      expect(screen.queryByTestId('new-listing-badge')).not.toBeInTheDocument();
    });

    it('does NOT show badge for newly onboarded dealer (dealer must be 7+ days old)', () => {
      // Dealer onboarded 3 days ago - NOT yet "established"
      // Dealers must be in system for 7+ days before new listings get badges
      const recentDealerBaseline = '2026-01-12T10:00:00Z';

      // New item added today (outside 24h initial import window)
      const genuinelyNewItem = {
        ...mockListing,
        first_seen_at: '2026-01-15T08:00:00Z', // Today
        dealer_earliest_seen_at: recentDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={genuinelyNewItem} />);

      // Should NOT show badge because dealer is not established yet (< 7 days)
      expect(screen.queryByTestId('new-listing-badge')).not.toBeInTheDocument();
    });

    it('shows both certification and "New" badges together', () => {
      const certifiedNewListing = {
        ...mockListing,
        cert_type: 'Juyo',
        first_seen_at: '2026-01-12T12:00:00Z', // 3 days ago
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={certifiedNewListing} />);

      // Both badges should be visible
      expect(screen.getByText('Jūyō')).toBeInTheDocument();
      expect(screen.getByTestId('new-listing-badge')).toBeInTheDocument();
    });

    it('shows only "New" badge when no certification', () => {
      const noCertNewListing = {
        ...mockListing,
        cert_type: null,
        first_seen_at: '2026-01-12T12:00:00Z', // 3 days ago
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={noCertNewListing} />);

      expect(screen.queryByText('Jūyō')).not.toBeInTheDocument();
      expect(screen.getByTestId('new-listing-badge')).toBeInTheDocument();
    });

    it('"New" badge has correct styling classes', () => {
      const newListing = {
        ...mockListing,
        first_seen_at: '2026-01-12T12:00:00Z',
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={newListing} />);

      const newBadge = screen.getByTestId('new-listing-badge');
      expect(newBadge).toHaveClass('bg-new-listing-bg');
      expect(newBadge).toHaveClass('text-new-listing');
      expect(newBadge).toHaveClass('uppercase');
    });

    it('badge slot container uses flex layout for multiple badges', () => {
      render(<ListingCard {...defaultProps} />);

      // Badge container should have flex class for horizontal layout
      const badgeContainer = document.querySelector('.flex.items-center.gap-1\\.5');
      expect(badgeContainer).toBeInTheDocument();
    });
  });

  describe('Setsumei badge', () => {
    it('shows Zufu badge when listing has setsumei_text_en', () => {
      const listingWithSetsumei = {
        ...mockListing,
        setsumei_text_en: '## Juyo-Token, 45th Session\n\nThis is a test setsumei translation.',
      };
      render(<ListingCard {...defaultProps} listing={listingWithSetsumei} />);

      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    it('does NOT show Zufu badge when setsumei_text_en is null', () => {
      const listingNoSetsumei = {
        ...mockListing,
        setsumei_text_en: null,
      };
      render(<ListingCard {...defaultProps} listing={listingNoSetsumei} />);

      expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
    });

    it('does NOT show Zufu badge when setsumei_text_en is undefined', () => {
      // mockListing doesn't have setsumei_text_en, so it's undefined
      render(<ListingCard {...defaultProps} />);

      expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
    });

    it('shows both certification and Zufu badges together', () => {
      const certifiedWithSetsumei = {
        ...mockListing,
        cert_type: 'Juyo',
        setsumei_text_en: '## Test setsumei',
      };
      render(<ListingCard {...defaultProps} listing={certifiedWithSetsumei} />);

      expect(screen.getByText('Jūyō')).toBeInTheDocument();
      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    it('shows Zufu badge even without certification', () => {
      const noCertWithSetsumei = {
        ...mockListing,
        cert_type: null,
        setsumei_text_en: '## Test setsumei',
      };
      render(<ListingCard {...defaultProps} listing={noCertWithSetsumei} />);

      expect(screen.queryByText('Jūyō')).not.toBeInTheDocument();
      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    // Yuhinkai enrichment tests (manual connections)
    describe('with Yuhinkai enrichment', () => {
      it('shows Zufu badge when listing has verified Yuhinkai enrichment with setsumei (array format from browse API)', () => {
        const listingWithYuhinkaiEnrichment = {
          ...mockListing,
          setsumei_text_en: null, // No OCR setsumei
          listing_yuhinkai_enrichment: [{
            setsumei_en: '## Juyo-Token Setsumei from Yuhinkai',
            match_confidence: 'DEFINITIVE',
            connection_source: 'manual',
            verification_status: 'confirmed',
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingWithYuhinkaiEnrichment} />);

        expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
      });

      it('shows Zufu badge when listing has yuhinkai_enrichment object (from QuickView context)', () => {
        const listingWithEnrichmentObject = {
          ...mockListing,
          setsumei_text_en: null,
          yuhinkai_enrichment: {
            setsumei_en: '## Setsumei from optimistic update',
            match_confidence: 'DEFINITIVE',
            connection_source: 'manual',
            verification_status: 'confirmed',
          },
        };
        render(<ListingCard {...defaultProps} listing={listingWithEnrichmentObject} />);

        expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
      });

      it('does NOT show Zufu badge for Yuhinkai enrichment without setsumei_en', () => {
        const listingWithoutSetsumei = {
          ...mockListing,
          setsumei_text_en: null,
          listing_yuhinkai_enrichment: [{
            setsumei_en: null, // No setsumei
            match_confidence: 'DEFINITIVE',
            connection_source: 'manual',
            verification_status: 'confirmed',
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingWithoutSetsumei} />);

        expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
      });

      it('does NOT show Zufu badge for auto-matched enrichment (only manual connections)', () => {
        const listingWithAutoMatch = {
          ...mockListing,
          setsumei_text_en: null,
          listing_yuhinkai_enrichment: [{
            setsumei_en: '## Auto-matched setsumei',
            match_confidence: 'DEFINITIVE',
            connection_source: 'auto', // Auto-matched, not manual
            verification_status: 'auto',
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingWithAutoMatch} />);

        // Auto-matches are hidden (not production-ready)
        expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
      });

      it('does NOT show Zufu badge for non-DEFINITIVE confidence', () => {
        const listingWithLowConfidence = {
          ...mockListing,
          setsumei_text_en: null,
          listing_yuhinkai_enrichment: [{
            setsumei_en: '## Setsumei',
            match_confidence: 'HIGH', // Not DEFINITIVE
            connection_source: 'manual',
            verification_status: 'confirmed',
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingWithLowConfidence} />);

        expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
      });

      it('does NOT show Zufu badge for manual connection not yet confirmed', () => {
        const listingNotConfirmed = {
          ...mockListing,
          setsumei_text_en: null,
          listing_yuhinkai_enrichment: [{
            setsumei_en: '## Setsumei',
            match_confidence: 'DEFINITIVE',
            connection_source: 'manual',
            verification_status: 'review_needed', // Not confirmed
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingNotConfirmed} />);

        expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
      });

      it('prefers showing badge when either OCR or Yuhinkai has setsumei', () => {
        // Both OCR and Yuhinkai have setsumei - badge should show
        const listingWithBoth = {
          ...mockListing,
          setsumei_text_en: '## OCR setsumei',
          listing_yuhinkai_enrichment: [{
            setsumei_en: '## Yuhinkai setsumei',
            match_confidence: 'DEFINITIVE',
            connection_source: 'manual',
            verification_status: 'confirmed',
          }],
        };
        render(<ListingCard {...defaultProps} listing={listingWithBoth} />);

        expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
      });

      it('handles empty listing_yuhinkai_enrichment array', () => {
        const listingWithEmptyArray = {
          ...mockListing,
          setsumei_text_en: null,
          listing_yuhinkai_enrichment: [], // Empty array
        };
        render(<ListingCard {...defaultProps} listing={listingWithEmptyArray} />);

        expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
      });
    });
  });

  describe('React.memo comparison for setsumei changes', () => {
    /**
     * These tests verify that ListingCard re-renders when setsumei-related
     * data changes. This is critical because React.memo could prevent
     * badge updates if the comparison function is too aggressive.
     */

    it('re-renders when setsumei_text_en changes from null to value', () => {
      const { rerender } = render(<ListingCard {...defaultProps} />);

      // Initially no badge (mockListing has no setsumei)
      expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();

      // Update with setsumei_text_en
      const listingWithSetsumei = {
        ...mockListing,
        setsumei_text_en: '## New setsumei content',
      };
      rerender(<ListingCard {...defaultProps} listing={listingWithSetsumei} />);

      // Badge should now appear
      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    it('re-renders when listing_yuhinkai_enrichment is added', () => {
      const { rerender } = render(<ListingCard {...defaultProps} />);

      // Initially no badge
      expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();

      // Update with Yuhinkai enrichment
      const listingWithEnrichment = {
        ...mockListing,
        listing_yuhinkai_enrichment: [{
          setsumei_en: '## Yuhinkai setsumei',
          match_confidence: 'DEFINITIVE',
          connection_source: 'manual',
          verification_status: 'confirmed',
        }],
      };
      rerender(<ListingCard {...defaultProps} listing={listingWithEnrichment} />);

      // Badge should now appear
      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    it('re-renders when listing_yuhinkai_enrichment is removed (disconnect)', () => {
      const listingWithEnrichment = {
        ...mockListing,
        listing_yuhinkai_enrichment: [{
          setsumei_en: '## Yuhinkai setsumei',
          match_confidence: 'DEFINITIVE',
          connection_source: 'manual',
          verification_status: 'confirmed',
        }],
      };
      const { rerender } = render(<ListingCard {...defaultProps} listing={listingWithEnrichment} />);

      // Initially has badge
      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();

      // Remove enrichment
      const listingWithoutEnrichment = {
        ...mockListing,
        listing_yuhinkai_enrichment: [],
      };
      rerender(<ListingCard {...defaultProps} listing={listingWithoutEnrichment} />);

      // Badge should be gone
      expect(screen.queryByTestId('setsumei-zufu-badge')).not.toBeInTheDocument();
    });
  });
});
