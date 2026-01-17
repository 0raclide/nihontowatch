import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileListingCard, MOBILE_CARD_HEIGHT } from '@/components/browse/MobileListingCard';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, className, onLoad, onError, ...props }: {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
    [key: string]: unknown;
  }) => (
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid="listing-image"
      onLoad={onLoad}
      onError={onError}
      {...props}
    />
  ),
}));

// Mock QuickView context
const mockOpenQuickView = vi.fn();
vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => ({
    openQuickView: mockOpenQuickView,
  }),
}));

// Mock freshness utility
vi.mock('@/lib/freshness', () => ({
  getMarketTimeDisplay: () => ({ shortLabel: '3d' }),
}));

const mockListing = {
  id: '123',
  url: 'https://example.com/listing/123',
  title: 'Beautiful Katana by Nobuyoshi',
  item_type: 'katana',
  price_value: 1500000,
  price_currency: 'JPY',
  smith: 'Nobuyoshi',
  tosogu_maker: null,
  school: 'Shinto',
  tosogu_school: null,
  cert_type: 'Juyo',
  nagasa_cm: 70.5,
  images: ['https://example.com/image1.jpg'],
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
};

const exchangeRates = {
  base: 'USD',
  rates: { USD: 1, JPY: 150, EUR: 0.92 },
  timestamp: Date.now(),
};

describe('MobileListingCard', () => {
  const defaultProps = {
    listing: mockListing,
    currency: 'JPY' as const,
    exchangeRates: null,
  };

  beforeEach(() => {
    mockOpenQuickView.mockClear();
  });

  describe('rendering', () => {
    it('renders with data-testid for E2E testing', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByTestId('mobile-listing-card')).toBeInTheDocument();
    });

    it('renders listing title/type', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('Katana')).toBeInTheDocument();
    });

    it('renders dealer domain', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('aoijapan.com')).toBeInTheDocument();
    });

    it('renders artisan name', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('Nobuyoshi')).toBeInTheDocument();
    });

    it('renders certification badge', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('Jūyō')).toBeInTheDocument();
    });

    it('renders market time', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('3d')).toBeInTheDocument();
    });
  });

  describe('fixed height for virtual scrolling', () => {
    it('has fixed height matching MOBILE_CARD_HEIGHT constant', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      expect(card).toHaveStyle({ height: `${MOBILE_CARD_HEIGHT}px` });
    });

    it('exports MOBILE_CARD_HEIGHT constant as 320', () => {
      expect(MOBILE_CARD_HEIGHT).toBe(320);
    });
  });

  describe('image handling', () => {
    it('renders with 4:3 aspect ratio image container', () => {
      render(<MobileListingCard {...defaultProps} />);
      const imageContainer = document.querySelector('.aspect-\\[4\\/3\\]');
      expect(imageContainer).toBeInTheDocument();
    });

    it('uses object-cover for image cropping', () => {
      render(<MobileListingCard {...defaultProps} />);
      const image = screen.getByTestId('listing-image');
      expect(image).toHaveClass('object-cover');
    });

    it('does not use opacity-based transitions', () => {
      render(<MobileListingCard {...defaultProps} />);
      const image = screen.getByTestId('listing-image');
      // Should use visibility instead of opacity for no-jank loading
      expect(image.className).not.toMatch(/opacity-0|opacity-100/);
    });

    it('uses visibility for image loading state', () => {
      render(<MobileListingCard {...defaultProps} />);
      const image = screen.getByTestId('listing-image');
      // Before load, image should be invisible
      expect(image.className).toContain('invisible');
    });

    it('shows fallback when no image', () => {
      const listingNoImage = { ...mockListing, images: null };
      render(<MobileListingCard {...defaultProps} listing={listingNoImage} />);
      const fallbackIcon = document.querySelector('svg');
      expect(fallbackIcon).toBeInTheDocument();
    });

    it('uses full viewport width for image sizing', () => {
      render(<MobileListingCard {...defaultProps} />);
      const image = screen.getByTestId('listing-image');
      expect(image).toHaveAttribute('sizes', '100vw');
    });
  });

  describe('sold state', () => {
    it('shows sold overlay when item is sold', () => {
      const soldListing = { ...mockListing, is_sold: true };
      render(<MobileListingCard {...defaultProps} listing={soldListing} />);
      expect(screen.getByText('Sold')).toBeInTheDocument();
    });

    it('shows sold overlay for presumed_sold status', () => {
      const soldListing = { ...mockListing, status: 'presumed_sold' };
      render(<MobileListingCard {...defaultProps} listing={soldListing} />);
      expect(screen.getByText('Sold')).toBeInTheDocument();
    });
  });

  describe('price formatting', () => {
    it('displays price in selected currency', () => {
      render(<MobileListingCard {...defaultProps} />);
      expect(screen.getByText('¥1,500,000')).toBeInTheDocument();
    });

    it('converts price when exchange rates provided', () => {
      render(
        <MobileListingCard
          {...defaultProps}
          currency="USD"
          exchangeRates={exchangeRates}
        />
      );
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    it('shows "Ask" when price is null', () => {
      const askListing = { ...mockListing, price_value: null };
      render(<MobileListingCard {...defaultProps} listing={askListing} />);
      expect(screen.getByText('Ask')).toBeInTheDocument();
    });
  });

  describe('certification tiers', () => {
    it('renders Tokubetsu Juyo with correct styling', () => {
      const tokujuListing = { ...mockListing, cert_type: 'tokuju' };
      render(<MobileListingCard {...defaultProps} listing={tokujuListing} />);
      const badge = screen.getByText('Tokubetsu Jūyō');
      expect(badge).toHaveClass('bg-tokuju-bg');
      expect(badge).toHaveClass('text-tokuju');
    });

    it('renders Juyo with correct styling', () => {
      render(<MobileListingCard {...defaultProps} />);
      const badge = screen.getByText('Jūyō');
      expect(badge).toHaveClass('bg-juyo-bg');
      expect(badge).toHaveClass('text-juyo');
    });

    it('renders Hozon with correct styling', () => {
      const hozonListing = { ...mockListing, cert_type: 'Hozon' };
      render(<MobileListingCard {...defaultProps} listing={hozonListing} />);
      const badge = screen.getByText('Hozon');
      expect(badge).toHaveClass('bg-hozon-bg');
    });
  });

  describe('QuickView interaction', () => {
    it('opens QuickView on click', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      fireEvent.click(card);
      expect(mockOpenQuickView).toHaveBeenCalledTimes(1);
      expect(mockOpenQuickView).toHaveBeenCalledWith(expect.objectContaining({
        id: '123',
      }));
    });

    it('opens QuickView on Enter key', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockOpenQuickView).toHaveBeenCalledTimes(1);
    });

    it('opens QuickView on Space key', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockOpenQuickView).toHaveBeenCalledTimes(1);
    });

    it('has button role for accessibility', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });
  });

  describe('item type normalization', () => {
    it('normalizes Japanese katana character to English', () => {
      const japaneseListing = { ...mockListing, item_type: '刀' };
      render(<MobileListingCard {...defaultProps} listing={japaneseListing} />);
      expect(screen.getByText('Katana')).toBeInTheDocument();
    });

    it('normalizes tsuba character', () => {
      const tsubaListing = { ...mockListing, item_type: '鍔' };
      render(<MobileListingCard {...defaultProps} listing={tsubaListing} />);
      expect(screen.getByText('Tsuba')).toBeInTheDocument();
    });

    it('handles unknown item types gracefully', () => {
      const unknownListing = { ...mockListing, item_type: null, title: 'Custom Title' };
      render(<MobileListingCard {...defaultProps} listing={unknownListing} />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });
  });

  describe('touch interactions', () => {
    it('has active state for touch feedback', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      expect(card).toHaveClass('active:bg-linen/50');
    });

    it('does not have hover states (touch device)', () => {
      render(<MobileListingCard {...defaultProps} />);
      const card = screen.getByTestId('mobile-listing-card');
      expect(card.className).not.toContain('hover:');
    });
  });

  describe('content truncation', () => {
    it('truncates long artisan names', () => {
      const longNameListing = {
        ...mockListing,
        smith: 'Very Long Artisan Name That Should Be Truncated',
      };
      render(<MobileListingCard {...defaultProps} listing={longNameListing} />);
      const artisanElement = screen.getByText('Very Long Artisan Name That Should Be Truncated');
      expect(artisanElement).toHaveClass('truncate');
    });

    it('clamps long titles', () => {
      const longTitleListing = {
        ...mockListing,
        item_type: null,
        title: 'Very Long Title That Should Be Clamped To One Line Only',
      };
      render(<MobileListingCard {...defaultProps} listing={longTitleListing} />);
      const titleElement = screen.getByRole('heading');
      expect(titleElement).toHaveClass('line-clamp-1');
    });
  });
});
