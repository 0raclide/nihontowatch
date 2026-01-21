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

// Mock freshness helper
vi.mock('@/lib/freshness', () => ({
  getMarketTimeDisplay: () => null,
}));

// Mock images helper
vi.mock('@/lib/images', () => ({
  getImageUrl: (listing: { images?: string[] | null }) => listing.images?.[0] || null,
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

  it('renders dealer domain in header', () => {
    render(<ListingCard {...defaultProps} />);

    // Shows dealer domain (e.g., "aoijapan.com") at top of card
    expect(screen.getByText('aoijapan.com')).toBeInTheDocument();
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

      // Find content container with responsive padding (p-2.5 lg:p-4)
      const contentDiv = document.querySelector('.p-2\\.5.lg\\:p-4');
      expect(contentDiv).toBeInTheDocument();
    });

    it('has responsive title font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Title should have responsive font classes (text-[15px] lg:text-base)
      const title = document.querySelector('.text-\\[15px\\].lg\\:text-base');
      expect(title).toBeInTheDocument();
    });

    it('has responsive price font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Price should have responsive font classes (text-[15px] lg:text-base)
      const price = document.querySelector('.text-\\[15px\\].lg\\:text-base');
      expect(price).toBeInTheDocument();
    });

    it('has responsive dealer header padding', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer header should have responsive padding (px-2.5 py-2 lg:px-4 lg:py-2.5)
      const dealerHeader = document.querySelector('.px-2\\.5.py-2.lg\\:px-4.lg\\:py-2\\.5');
      expect(dealerHeader).toBeInTheDocument();
    });

    it('has responsive dealer header font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer domain should have responsive font (text-[10px] lg:text-[12px])
      const dealerDomain = document.querySelector('.text-\\[10px\\].lg\\:text-\\[12px\\]');
      expect(dealerDomain).toBeInTheDocument();
    });

    it('has responsive certification badge font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Cert badge should have responsive font (text-[9px] lg:text-[10px])
      const certBadge = document.querySelector('.text-\\[9px\\].lg\\:text-\\[10px\\]');
      expect(certBadge).toBeInTheDocument();
    });

    it('has responsive artisan font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Artisan text should have responsive font (text-[12px] lg:text-[13px])
      const artisan = document.querySelector('.text-\\[12px\\].lg\\:text-\\[13px\\]');
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

      // Current styling uses bg-juyo-bg class
      const badge = document.querySelector('.bg-juyo-bg');
      expect(badge).toBeInTheDocument();
    });

    it('shows toku-hozon tier styling for TokuHozon', () => {
      const tokuHozonListing = { ...mockListing, cert_type: 'TokuHozon' };
      render(<ListingCard {...defaultProps} listing={tokuHozonListing} />);

      // Current styling uses bg-toku-hozon-bg class
      const badge = document.querySelector('.bg-toku-hozon-bg');
      expect(badge).toBeInTheDocument();
    });

    it('shows hozon tier styling for Hozon', () => {
      const hozonListing = { ...mockListing, cert_type: 'Hozon' };
      render(<ListingCard {...defaultProps} listing={hozonListing} />);

      // Current styling uses bg-hozon-bg class
      const badge = document.querySelector('.bg-hozon-bg');
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

    it('shows "New" badge for recently discovered listing (after baseline)', () => {
      const newListing = {
        ...mockListing,
        first_seen_at: '2026-01-12T12:00:00Z', // 3 days ago, well after baseline
        dealer_earliest_seen_at: establishedDealerBaseline,
      };
      render(<ListingCard {...defaultProps} listing={newListing} />);

      const newBadge = screen.getByTestId('new-listing-badge');
      expect(newBadge).toBeInTheDocument();
      expect(newBadge).toHaveTextContent('New');
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
});
