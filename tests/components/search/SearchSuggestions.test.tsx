import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchSuggestions } from '@/components/search/SearchSuggestions';
import type { SearchSuggestion } from '@/lib/search/types';

// Mock scrollIntoView which doesn't exist in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="suggestion-image" {...props} />
  ),
}));

const mockSuggestions: SearchSuggestion[] = [
  {
    id: '1',
    title: 'Katana by Masamune',
    item_type: 'katana',
    price_value: 1000000,
    price_currency: 'JPY',
    image_url: 'https://example.com/image1.jpg',
    dealer_name: 'Aoi Art',
    dealer_domain: 'aoijapan.com',
    url: 'https://aoijapan.com/listing/1',
    cert_type: 'Juyo',
    smith: 'Masamune',
    tosogu_maker: null,
  },
  {
    id: '2',
    title: 'Tsuba with Dragon',
    item_type: 'tsuba',
    price_value: 50000,
    price_currency: 'JPY',
    image_url: null,
    dealer_name: 'Eirakudo',
    dealer_domain: 'eirakudo.com',
    url: 'https://eirakudo.com/listing/2',
    cert_type: 'Hozon',
    smith: null,
    tosogu_maker: 'Yoshioka',
  },
];

describe('SearchSuggestions', () => {
  const defaultProps = {
    suggestions: mockSuggestions,
    total: 10,
    isLoading: false,
    onSelect: vi.fn(),
    onViewAll: vi.fn(),
    onClose: vi.fn(),
    highlightedIndex: -1,
  };

  it('renders suggestions list', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // The component uses SearchResultPreview which displays artisan or title
    // First suggestion has smith (Masamune), second has tosogu_maker (Yoshioka)
    expect(screen.getByText('Masamune')).toBeInTheDocument();
    expect(screen.getByText('Yoshioka')).toBeInTheDocument();
  });

  it('renders item type badges', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Item types are displayed as uppercase badges
    expect(screen.getByText('Katana')).toBeInTheDocument();
    expect(screen.getByText('Tsuba')).toBeInTheDocument();
  });

  it('renders dealer domain for each suggestion', () => {
    render(<SearchSuggestions {...defaultProps} />);

    expect(screen.getByText('aoijapan.com')).toBeInTheDocument();
    expect(screen.getByText('eirakudo.com')).toBeInTheDocument();
  });

  it('shows view all link with total count when more results available', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // total (10) - suggestions.length (2) = 8 remaining, so show "View all 10 results"
    expect(screen.getByText('View all 10 results')).toBeInTheDocument();
  });

  it('does not show view all link when all results shown', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        total={2} // Same as suggestions.length
      />
    );

    expect(screen.queryByText(/View all/i)).not.toBeInTheDocument();
  });

  it('calls onSelect when clicking suggestion', () => {
    const onSelect = vi.fn();
    render(<SearchSuggestions {...defaultProps} onSelect={onSelect} />);

    // Click on the first suggestion (by artisan name)
    fireEvent.click(screen.getByText('Masamune'));
    expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
  });

  it('calls onViewAll when clicking view all link', () => {
    const onViewAll = vi.fn();
    render(<SearchSuggestions {...defaultProps} onViewAll={onViewAll} />);

    fireEvent.click(screen.getByText('View all 10 results'));
    expect(onViewAll).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        suggestions={[]}
        total={0}
        isLoading={true}
      />
    );

    // Loading state shows spinner and "Searching..." text
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('shows no results message when empty and not loading', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        suggestions={[]}
        total={0}
        isLoading={false}
      />
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('highlights selected suggestion', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        highlightedIndex={0}
      />
    );

    // First suggestion should be highlighted (aria-selected)
    const buttons = screen.getAllByRole('option');
    expect(buttons[0]).toHaveAttribute('aria-selected', 'true');
    expect(buttons[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('highlights different suggestion when index changes', () => {
    const { rerender } = render(
      <SearchSuggestions
        {...defaultProps}
        highlightedIndex={0}
      />
    );

    // Initially first is selected
    let buttons = screen.getAllByRole('option');
    expect(buttons[0]).toHaveAttribute('aria-selected', 'true');

    // Change to second
    rerender(
      <SearchSuggestions
        {...defaultProps}
        highlightedIndex={1}
      />
    );

    buttons = screen.getAllByRole('option');
    expect(buttons[0]).toHaveAttribute('aria-selected', 'false');
    expect(buttons[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('has proper accessibility attributes', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Container should be a listbox
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Search suggestions');

    // Each suggestion should be an option
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
  });

  describe('Suggestion display', () => {
    it('shows artisan name (smith) when available', () => {
      const suggestionsWithSmith: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        smith: 'Muramasa',
        tosogu_maker: null,
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsWithSmith}
          total={1}
        />
      );

      expect(screen.getByText('Muramasa')).toBeInTheDocument();
    });

    it('shows artisan name (tosogu_maker) for fittings', () => {
      const suggestionsWithMaker: SearchSuggestion[] = [{
        ...mockSuggestions[1],
        smith: null,
        tosogu_maker: 'Hamano Shozui',
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsWithMaker}
          total={1}
        />
      );

      expect(screen.getByText('Hamano Shozui')).toBeInTheDocument();
    });

    it('shows truncated title when no artisan', () => {
      const suggestionsNoArtisan: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        title: 'A very long title that should be truncated for display purposes in the compact view',
        smith: null,
        tosogu_maker: null,
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsNoArtisan}
          total={1}
        />
      );

      // Title should be truncated (substring(0, 47) + '...' = 50 chars display)
      // The actual implementation truncates to 47 chars then adds '...'
      // 'A very long title that should be truncated for ' is 47 chars
      expect(screen.getByText('A very long title that should be truncated for ...')).toBeInTheDocument();
    });
  });

  describe('Image handling', () => {
    it('renders image when URL is provided', () => {
      render(<SearchSuggestions {...defaultProps} />);

      const images = screen.getAllByTestId('suggestion-image');
      expect(images.length).toBeGreaterThan(0);
    });

    it('shows placeholder when no image URL', () => {
      const suggestionsNoImage: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        image_url: null,
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsNoImage}
          total={1}
        />
      );

      // Should have a placeholder SVG (no img element)
      expect(screen.queryByTestId('suggestion-image')).not.toBeInTheDocument();
    });
  });

  describe('Click outside handling', () => {
    it('calls onClose when clicking outside', () => {
      const onClose = vi.fn();

      // Create a container to click outside of
      const { container } = render(
        <div>
          <div data-testid="outside">Outside</div>
          <SearchSuggestions {...defaultProps} onClose={onClose} />
        </div>
      );

      // Click outside the suggestions
      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose when clicking inside', () => {
      const onClose = vi.fn();

      render(<SearchSuggestions {...defaultProps} onClose={onClose} />);

      // Click inside the suggestions
      fireEvent.mouseDown(screen.getByRole('listbox'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Price display', () => {
    it('formats JPY price correctly', () => {
      const suggestionsJPY: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        price_value: 1500000,
        price_currency: 'JPY',
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsJPY}
          total={1}
        />
      );

      // Should display formatted JPY (Intl format)
      expect(screen.getByText(/1,500,000/)).toBeInTheDocument();
    });

    it('shows "Ask" for null price', () => {
      const suggestionsNoPrice: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        price_value: null,
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsNoPrice}
          total={1}
        />
      );

      expect(screen.getByText('Ask')).toBeInTheDocument();
    });

    it('formats USD price correctly', () => {
      const suggestionsUSD: SearchSuggestion[] = [{
        ...mockSuggestions[0],
        price_value: 10000,
        price_currency: 'USD',
      }];

      render(
        <SearchSuggestions
          {...defaultProps}
          suggestions={suggestionsUSD}
          total={1}
        />
      );

      // Should display formatted USD
      expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
    });
  });
});
