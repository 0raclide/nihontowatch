import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListingCard } from '@/components/browse/ListingCard';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="listing-image" {...props} />
  ),
}));

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

  it('renders dealer domain', () => {
    render(<ListingCard {...defaultProps} />);

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
    const soldListing = { ...mockListing, is_sold: true };
    render(<ListingCard {...defaultProps} listing={soldListing} />);

    expect(screen.getByText('Sold')).toBeInTheDocument();
  });

  it('links to the listing URL', () => {
    render(<ListingCard {...defaultProps} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', mockListing.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  describe('Responsive styling', () => {
    it('has responsive content padding', () => {
      render(<ListingCard {...defaultProps} />);

      // Find content container with responsive padding
      const contentDiv = document.querySelector('.p-2\\.5.lg\\:p-3');
      expect(contentDiv).toBeInTheDocument();
    });

    it('has responsive title font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Title should have responsive font classes
      const title = document.querySelector('.text-sm.lg\\:text-\\[15px\\]');
      expect(title).toBeInTheDocument();
    });

    it('has responsive price font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Price should have responsive font classes
      const price = document.querySelector('.text-sm.lg\\:text-\\[15px\\]');
      expect(price).toBeInTheDocument();
    });

    it('has responsive dealer domain padding', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer header should have responsive padding
      const dealerHeader = document.querySelector('.px-2\\.5.py-2.lg\\:px-3.lg\\:py-2\\.5');
      expect(dealerHeader).toBeInTheDocument();
    });

    it('has responsive dealer domain font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Dealer domain should have responsive font
      const dealerDomain = document.querySelector('.text-\\[9px\\].lg\\:text-\\[10px\\]');
      expect(dealerDomain).toBeInTheDocument();
    });

    it('has responsive certification badge font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Cert badge should have responsive font
      const certBadge = document.querySelector('.text-\\[8px\\].lg\\:text-\\[9px\\]');
      expect(certBadge).toBeInTheDocument();
    });

    it('has responsive artisan font size', () => {
      render(<ListingCard {...defaultProps} />);

      // Artisan text should have responsive font
      const artisan = document.querySelector('.text-\\[11px\\].lg\\:text-\\[12px\\]');
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
    it('shows premier tier styling for Juyo', () => {
      render(<ListingCard {...defaultProps} />);

      const badge = document.querySelector('.bg-burgundy\\/10');
      expect(badge).toBeInTheDocument();
    });

    it('shows high tier styling for TokuHozon', () => {
      const tokuHozonListing = { ...mockListing, cert_type: 'TokuHozon' };
      render(<ListingCard {...defaultProps} listing={tokuHozonListing} />);

      const badge = document.querySelector('.bg-toku-hozon\\/10');
      expect(badge).toBeInTheDocument();
    });

    it('shows standard tier styling for Hozon', () => {
      const hozonListing = { ...mockListing, cert_type: 'Hozon' };
      render(<ListingCard {...defaultProps} listing={hozonListing} />);

      const badge = document.querySelector('.bg-hozon\\/10');
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
});
