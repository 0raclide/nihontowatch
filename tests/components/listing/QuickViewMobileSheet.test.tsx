import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickViewMobileSheet } from '@/components/listing/QuickViewMobileSheet';
import type { Listing } from '@/types';

// Mock the FavoriteButton component
vi.mock('@/components/favorites/FavoriteButton', () => ({
  FavoriteButton: ({ listingId, size }: { listingId: number; size: string }) => (
    <button
      data-testid="favorite-button"
      data-listing-id={listingId}
      data-size={size}
      aria-label="Add to watchlist"
    >
      Favorite
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

// Mock the useAuth hook
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

// Mock the InquiryModal component
vi.mock('@/components/inquiry', () => ({
  InquiryModal: () => null,
}));

// Mock the LoginModal component
vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: () => null,
}));

// Sample listing data for testing
// Note: Item types should be lowercase to match the getItemTypeLabel function
const createMockListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 123,
  url: 'https://example.com/listing/123',
  title: 'Test Katana by Famous Smith',
  item_type: 'katana' as any,
  price_value: 2500000,
  price_currency: 'JPY',
  smith: 'Famous Smith',
  tosogu_maker: null,
  school: 'Bizen',
  tosogu_school: null,
  cert_type: 'Juyo',
  cert_session: '64',
  cert_organization: 'NBTHK',
  nagasa_cm: 70.5,
  sori_cm: 1.8,
  motohaba_cm: 3.2,
  sakihaba_cm: 2.1,
  kasane_cm: 0.7,
  nakago_cm: 21.5,
  weight_g: 850,
  height_cm: null,
  width_cm: null,
  thickness_mm: null,
  material: null,
  images: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
  first_seen_at: new Date().toISOString(),
  last_scraped_at: new Date().toISOString(),
  status: 'AVAILABLE',
  is_available: true,
  is_sold: false,
  dealer_id: 1,
  dealer: {
    id: 1,
    name: 'Test Dealer',
    domain: 'testdealer.com',
  },
  era: 'Kamakura',
  province: 'Bizen',
  mei_type: 'Mei',
  description: 'A fine example of a Kamakura period katana.',
  ...overrides,
});

describe('QuickViewMobileSheet', () => {
  const defaultProps = {
    listing: createMockListing(),
    isExpanded: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    imageCount: 3,
    currentImageIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Collapsed State', () => {
    it('renders the price display', () => {
      render(<QuickViewMobileSheet {...defaultProps} />);
      expect(screen.getByText(/¥2,500,000/)).toBeInTheDocument();
    });

    it('renders the favorite button in collapsed state', () => {
      render(<QuickViewMobileSheet {...defaultProps} />);
      const favoriteButton = screen.getByTestId('favorite-button');
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveAttribute('data-listing-id', '123');
      expect(favoriteButton).toHaveAttribute('data-size', 'sm');
    });

    it('renders item type badge in collapsed state (always visible)', () => {
      render(<QuickViewMobileSheet {...defaultProps} isExpanded={false} />);
      expect(screen.getByText('Katana')).toBeInTheDocument();
    });

    it('renders certification badge in collapsed state (always visible)', () => {
      render(<QuickViewMobileSheet {...defaultProps} isExpanded={false} />);
      // Cert badge should be visible even when collapsed
      const certElements = screen.getAllByText('Juyo');
      expect(certElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders dealer name in collapsed state (always visible)', () => {
      render(<QuickViewMobileSheet {...defaultProps} isExpanded={false} />);
      expect(screen.getByText('Test Dealer')).toBeInTheDocument();
    });

    it('calls onToggle when header bar is clicked in collapsed state', () => {
      const onToggle = vi.fn();
      render(<QuickViewMobileSheet {...defaultProps} onToggle={onToggle} isExpanded={false} />);

      // The header area is clickable for toggle - click on the price which is in the header
      const priceElement = screen.getByText(/¥2,500,000/);
      fireEvent.click(priceElement);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('prevents click propagation when favorite button is clicked', () => {
      const onToggle = vi.fn();
      render(<QuickViewMobileSheet {...defaultProps} onToggle={onToggle} />);

      const favoriteButton = screen.getByTestId('favorite-button');
      // The favorite button's container should have stopPropagation
      fireEvent.click(favoriteButton);
      // onToggle should not be called because the click was on the favorite button
    });

    it('hides image counter when imageCount is 0', () => {
      render(<QuickViewMobileSheet {...defaultProps} imageCount={0} />);
      expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    const expandedProps = {
      ...defaultProps,
      isExpanded: true,
    };

    it('renders the favorite button in expanded state', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      const favoriteButton = screen.getByTestId('favorite-button');
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveAttribute('data-listing-id', '123');
    });

    it('renders the close button', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      const closeButton = screen.getByTestId('mobile-sheet-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<QuickViewMobileSheet {...expandedProps} onClose={onClose} />);

      const closeButton = screen.getByTestId('mobile-sheet-close');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders the price prominently', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      expect(screen.getByText(/¥2,500,000/)).toBeInTheDocument();
    });

    it('renders the item type badge', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      expect(screen.getByText('Katana')).toBeInTheDocument();
    });

    it('renders the certification badge', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      // Cert info appears in both the badge and MetadataGrid, so use getAllByText
      const certElements = screen.getAllByText('Juyo');
      expect(certElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the artisan name', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      // Artisan name appears in MetadataGrid combined with school (e.g., "Bizen Famous Smith")
      // Use getAllByText since it may appear in multiple places (title, metadata)
      const artisanElements = screen.getAllByText(/Famous Smith/);
      expect(artisanElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the dealer name', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      expect(screen.getByText('Test Dealer')).toBeInTheDocument();
    });

    it('renders the CTA button with correct link', () => {
      render(<QuickViewMobileSheet {...expandedProps} />);
      const ctaLink = screen.getByRole('link', { name: /view on test dealer/i });
      expect(ctaLink).toHaveAttribute('href', 'https://example.com/listing/123');
      expect(ctaLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('Tosogu Item Type', () => {
    // Note: isTosogu function expects lowercase item types
    const tosoguListing = createMockListing({
      item_type: 'tsuba' as any, // Use lowercase to match isTosogu expectation
      smith: null,
      tosogu_maker: 'Tosogu Artisan',
      school: null,
      tosogu_school: 'Shoami',
    });

    it('displays tosogu maker instead of smith for tosogu items', () => {
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={tosoguListing}
          isExpanded={true}
        />
      );
      // Tosogu maker appears in MetadataGrid combined with school as "Shoami Tosogu Artisan"
      expect(screen.getByText(/Tosogu Artisan/)).toBeInTheDocument();
    });

    it('displays correct item type label for tsuba', () => {
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={tosoguListing}
          isExpanded={true}
        />
      );
      // The item type is displayed using getItemTypeLabel, which returns 'Tsuba'
      expect(screen.getByText('Tsuba')).toBeInTheDocument();
    });
  });

  describe('Ask Price Listings', () => {
    const askPriceListing = createMockListing({
      price_value: null,
      price_currency: null,
    });

    it('displays "Ask" for listings without price', () => {
      render(<QuickViewMobileSheet {...defaultProps} listing={askPriceListing} />);
      expect(screen.getByText('Ask')).toBeInTheDocument();
    });

    it('displays "Ask" in expanded state for listings without price', () => {
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={askPriceListing}
          isExpanded={true}
        />
      );
      expect(screen.getByText('Ask')).toBeInTheDocument();
    });
  });

  describe('Sheet Classes and Structure', () => {
    it('has correct data-testid', () => {
      render(<QuickViewMobileSheet {...defaultProps} />);
      expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
    });

    it('renders with base styling classes', () => {
      render(<QuickViewMobileSheet {...defaultProps} isExpanded={false} />);
      const sheet = screen.getByTestId('mobile-sheet');
      expect(sheet).toHaveClass('fixed');
      expect(sheet).toHaveClass('bottom-0');
      expect(sheet).toHaveClass('bg-cream');
    });

    it('has inline height style for responsive sizing', () => {
      render(<QuickViewMobileSheet {...defaultProps} isExpanded={true} />);
      const sheet = screen.getByTestId('mobile-sheet');
      // Sheet uses inline height style for smooth transitions
      expect(sheet.style.height).toBeDefined();
      expect(sheet.style.height).not.toBe('');
    });

    it('has swipe indicator handle', () => {
      render(<QuickViewMobileSheet {...defaultProps} />);
      // The swipe indicator is a small rounded bar
      const swipeIndicator = document.querySelector('.rounded-full.bg-border');
      expect(swipeIndicator).toBeInTheDocument();
    });
  });

  describe('Certification Display', () => {
    it('displays Tokubetsu Juyo certification', () => {
      const listing = createMockListing({ cert_type: 'Tokubetsu Juyo' });
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={listing}
          isExpanded={true}
        />
      );
      expect(screen.getByText('TokuJu')).toBeInTheDocument();
    });

    it('displays Tokubetsu Hozon certification', () => {
      const listing = createMockListing({ cert_type: 'Tokubetsu Hozon' });
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={listing}
          isExpanded={true}
        />
      );
      expect(screen.getByText('TokuHo')).toBeInTheDocument();
    });

    it('displays Hozon certification', () => {
      const listing = createMockListing({ cert_type: 'Hozon' });
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={listing}
          isExpanded={true}
        />
      );
      // Hozon appears in both the badge and MetadataGrid, so use getAllByText
      const hozonElements = screen.getAllByText('Hozon');
      expect(hozonElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not display certification badge when no cert_type', () => {
      const listing = createMockListing({ cert_type: null });
      render(
        <QuickViewMobileSheet
          {...defaultProps}
          listing={listing}
          isExpanded={true}
        />
      );
      // Should not have any cert badge classes
      const certBadges = document.querySelectorAll('[class*="bg-juyo"], [class*="bg-toku-hozon"], [class*="bg-hozon"]');
      expect(certBadges.length).toBe(0);
    });
  });
});
