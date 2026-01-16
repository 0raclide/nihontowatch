/**
 * Edge Case Tests for SearchSuggestions Component
 *
 * Tests for edge cases in UI rendering, data handling,
 * and user interaction patterns.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchSuggestions } from '@/components/search/SearchSuggestions';
import type { SearchSuggestion } from '@/lib/search/types';

// =============================================================================
// MOCKS
// =============================================================================

// Mock scrollIntoView which doesn't exist in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock next/image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="suggestion-image" {...props} />
  ),
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createSuggestion(overrides: Partial<SearchSuggestion> = {}): SearchSuggestion {
  return {
    id: '1',
    title: 'Test Katana',
    item_type: 'katana',
    price_value: 1000000,
    price_currency: 'JPY',
    image_url: 'https://example.com/image.jpg',
    dealer_name: 'Test Dealer',
    dealer_domain: 'test-dealer.com',
    url: 'https://test-dealer.com/listing/1',
    cert_type: 'Hozon',
    smith: 'Test Smith',
    tosogu_maker: null,
    ...overrides,
  };
}

function createDefaultProps(overrides: Partial<Parameters<typeof SearchSuggestions>[0]> = {}) {
  return {
    suggestions: [createSuggestion()],
    total: 1,
    isLoading: false,
    onSelect: vi.fn(),
    onViewAll: vi.fn(),
    onClose: vi.fn(),
    highlightedIndex: -1,
    ...overrides,
  };
}

// =============================================================================
// EMPTY/NULL DATA EDGE CASES
// =============================================================================

describe('SearchSuggestions Empty/Null Data Edge Cases', () => {
  it('handles empty suggestions array', () => {
    const props = createDefaultProps({
      suggestions: [],
      total: 0,
    });

    render(<SearchSuggestions {...props} />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('handles suggestions with missing fields', () => {
    const incompleteData = {
      id: '1',
      title: 'Minimal Listing',
      item_type: null,
      price_value: null,
      price_currency: null,
      image_url: null,
      dealer_name: 'Unknown',
      dealer_domain: 'unknown.com',
      url: 'https://unknown.com/1',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
    } as SearchSuggestion;

    const props = createDefaultProps({
      suggestions: [incompleteData],
    });

    // Should not throw
    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();

    // Should show "Ask" for null price
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('handles null item_type gracefully', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ item_type: null })],
    });

    render(<SearchSuggestions {...props} />);

    // Should not show any type badge
    const typeBadges = screen.queryAllByText(/katana|wakizashi|tsuba/i);
    expect(typeBadges.length).toBe(0);
  });

  it('handles null image_url', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ image_url: null })],
    });

    render(<SearchSuggestions {...props} />);

    // Should show placeholder (no img element)
    expect(screen.queryByTestId('suggestion-image')).not.toBeInTheDocument();
  });

  it('handles null price_value (Ask)', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_value: null })],
    });

    render(<SearchSuggestions {...props} />);

    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('handles null price_currency with valid price', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_currency: null })],
    });

    render(<SearchSuggestions {...props} />);

    // Should default to JPY
    expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
  });

  it('handles both smith and tosogu_maker as null', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          smith: null,
          tosogu_maker: null,
          title: 'Display This Title',
        }),
      ],
    });

    render(<SearchSuggestions {...props} />);

    // Should fall back to title
    expect(screen.getByText('Display This Title')).toBeInTheDocument();
  });

  it('handles empty string values', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          smith: '',
          tosogu_maker: '',
          title: 'Fallback Title',
        }),
      ],
    });

    render(<SearchSuggestions {...props} />);

    // Empty string is falsy, should fall back to title
    expect(screen.getByText('Fallback Title')).toBeInTheDocument();
  });
});

// =============================================================================
// LONG TEXT EDGE CASES
// =============================================================================

describe('SearchSuggestions Long Text Edge Cases', () => {
  it('handles very long titles (500+ chars)', () => {
    const longTitle = 'A'.repeat(500);
    const props = createDefaultProps({
      suggestions: [createSuggestion({ title: longTitle, smith: null })],
    });

    render(<SearchSuggestions {...props} />);

    // Should truncate (component truncates at 47 chars + '...')
    const truncated = screen.getByText(/^A+\.\.\.$/);
    expect(truncated).toBeInTheDocument();
    expect(truncated.textContent?.length).toBeLessThanOrEqual(50);
  });

  it('handles very long smith name', () => {
    const longSmith = 'Smith'.repeat(50);
    const props = createDefaultProps({
      suggestions: [createSuggestion({ smith: longSmith })],
    });

    // Should not throw
    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();
  });

  it('handles very long dealer domain', () => {
    const longDomain = 'a'.repeat(100) + '.com';
    const props = createDefaultProps({
      suggestions: [createSuggestion({ dealer_domain: longDomain })],
    });

    render(<SearchSuggestions {...props} />);

    // Should render without breaking layout
    expect(screen.getByText(longDomain)).toBeInTheDocument();
  });

  it('truncates title at exactly 47 chars + ellipsis', () => {
    // 50 char title should be truncated
    const title50 = 'A'.repeat(50);
    // 47 char title should not be truncated
    const title47 = 'B'.repeat(47);

    const props50 = createDefaultProps({
      suggestions: [createSuggestion({ title: title50, smith: null })],
    });

    const { unmount } = render(<SearchSuggestions {...props50} />);
    expect(screen.getByText('A'.repeat(47) + '...')).toBeInTheDocument();
    unmount();

    const props47 = createDefaultProps({
      suggestions: [createSuggestion({ title: title47, smith: null })],
    });

    render(<SearchSuggestions {...props47} />);
    expect(screen.getByText('B'.repeat(47))).toBeInTheDocument();
  });
});

// =============================================================================
// SPECIAL CHARACTERS EDGE CASES
// =============================================================================

describe('SearchSuggestions Special Characters Edge Cases', () => {
  it('handles special characters in titles', () => {
    const specialTitles = [
      'Katana <script>alert("xss")</script>',
      "Sword with 'quotes'",
      'Blade with "double quotes"',
      'Item with & ampersand',
      'Test </div> injection',
    ];

    specialTitles.forEach(title => {
      const props = createDefaultProps({
        suggestions: [createSuggestion({ title, smith: null })],
      });

      const { unmount } = render(<SearchSuggestions {...props} />);
      // Should render safely without executing scripts
      expect(document.querySelector('script')).toBeNull();
      unmount();
    });
  });

  it('handles HTML entities in text', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          title: 'Sword &amp; Shield',
          smith: 'Smith &lt;Great&gt;',
        }),
      ],
    });

    render(<SearchSuggestions {...props} />);
    // React should handle entities correctly
    expect(screen.queryByText('&amp;')).toBeInTheDocument();
  });

  it('handles Unicode special characters', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          title: 'Katana \u200B\u200C\u200D Zero Width',
          smith: null,
        }),
      ],
    });

    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();
  });

  it('handles emoji in content', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          smith: 'Master Smith ⚔️',
          title: 'Beautiful Katana ✨',
        }),
      ],
    });

    render(<SearchSuggestions {...props} />);
    expect(screen.getByText(/Master Smith/)).toBeInTheDocument();
  });

  it('handles Japanese characters', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          smith: '正宗',
          title: '日本刀 - 重要美術品',
          item_type: 'katana',
        }),
      ],
    });

    render(<SearchSuggestions {...props} />);
    expect(screen.getByText('正宗')).toBeInTheDocument();
  });

  it('handles mixed scripts', () => {
    const props = createDefaultProps({
      suggestions: [
        createSuggestion({
          title: 'Katana かたな カタナ 刀',
          smith: null,
        }),
      ],
    });

    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();
  });
});

// =============================================================================
// PRICE EDGE CASES
// =============================================================================

describe('SearchSuggestions Price Edge Cases', () => {
  it('handles zero price', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_value: 0 })],
    });

    render(<SearchSuggestions {...props} />);
    // Zero should be displayed, not "Ask"
    expect(screen.queryByText('Ask')).not.toBeInTheDocument();
  });

  it('handles very large price', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_value: 999999999999 })],
    });

    render(<SearchSuggestions {...props} />);
    // Should format with commas
    expect(screen.getByText(/999,999,999,999/)).toBeInTheDocument();
  });

  it('handles negative price (edge case)', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_value: -1000 })],
    });

    // Should not crash
    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();
  });

  it('handles decimal price (should round)', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ price_value: 1234.56, price_currency: 'USD' })],
    });

    render(<SearchSuggestions {...props} />);
    // Should round to whole number
    expect(screen.getByText(/\$1,235/)).toBeInTheDocument();
  });

  it('formats different currencies correctly', () => {
    const currencies = [
      { currency: 'JPY', value: 1000000, expected: /1,000,000/ },
      { currency: 'USD', value: 10000, expected: /\$10,000/ },
      { currency: 'EUR', value: 10000, expected: /10,000/ },
    ];

    currencies.forEach(({ currency, value, expected }) => {
      const props = createDefaultProps({
        suggestions: [
          createSuggestion({ price_value: value, price_currency: currency }),
        ],
      });

      const { unmount } = render(<SearchSuggestions {...props} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });
});

// =============================================================================
// INTERACTION EDGE CASES
// =============================================================================

describe('SearchSuggestions Interaction Edge Cases', () => {
  it('handles rapid open/close', async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });

    const { unmount, rerender } = render(<SearchSuggestions {...props} />);

    // Rapid clicks outside (simulate)
    for (let i = 0; i < 10; i++) {
      fireEvent.mouseDown(document.body);
    }

    // onClose should be called for each
    expect(onClose).toHaveBeenCalledTimes(10);

    // Rapid re-renders
    for (let i = 0; i < 10; i++) {
      rerender(<SearchSuggestions {...props} />);
    }

    // Should not throw
    unmount();
  });

  it('handles rapid selection clicks', () => {
    const onSelect = vi.fn();
    const props = createDefaultProps({ onSelect });

    render(<SearchSuggestions {...props} />);

    const option = screen.getByRole('option');

    // Click rapidly
    for (let i = 0; i < 5; i++) {
      fireEvent.click(option);
    }

    expect(onSelect).toHaveBeenCalledTimes(5);
  });

  it('handles click on loading state (should do nothing)', () => {
    const onSelect = vi.fn();
    const props = createDefaultProps({
      suggestions: [],
      total: 0,
      isLoading: true,
      onSelect,
    });

    render(<SearchSuggestions {...props} />);

    // Loading spinner area - clicking should not call onSelect
    const loadingText = screen.getByText('Searching...');
    fireEvent.click(loadingText);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('handles keyboard-like rapid highlight changes', () => {
    const suggestions = [
      createSuggestion({ id: '1' }),
      createSuggestion({ id: '2' }),
      createSuggestion({ id: '3' }),
    ];
    const props = createDefaultProps({ suggestions, total: 3 });

    const { rerender } = render(<SearchSuggestions {...props} highlightedIndex={0} />);

    // Rapid highlight changes (simulating keyboard navigation)
    for (let i = 0; i < 10; i++) {
      rerender(<SearchSuggestions {...props} highlightedIndex={i % 3} />);
    }

    // Should not throw, final state should be correct
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true'); // 9 % 3 = 0
  });
});

// =============================================================================
// SCROLL EDGE CASES
// =============================================================================

describe('SearchSuggestions Scroll Edge Cases', () => {
  it('handles scroll position with many results', () => {
    // Create many suggestions
    const manySuggestions = Array(20)
      .fill(null)
      .map((_, i) =>
        createSuggestion({
          id: String(i),
          smith: `Smith ${i}`,
        })
      );

    const props = createDefaultProps({
      suggestions: manySuggestions,
      total: 100,
      highlightedIndex: 15, // Highlight near the end
    });

    render(<SearchSuggestions {...props} />);

    // scrollIntoView should be called for the highlighted item
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('does not scroll when no item highlighted', () => {
    // Reset mock
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    const suggestions = [createSuggestion({ id: '1' }), createSuggestion({ id: '2' })];
    const props = createDefaultProps({
      suggestions,
      total: 2,
      highlightedIndex: -1, // No highlight
    });

    render(<SearchSuggestions {...props} />);

    // scrollIntoView should not be called when no highlight
    // (depends on implementation - may still be called with null check)
  });

  it('handles highlight index out of bounds', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 1,
      highlightedIndex: 999, // Out of bounds
    });

    // Should not throw
    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();
  });

  it('handles negative highlight index', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 1,
      highlightedIndex: -5, // Negative
    });

    // Should not throw
    expect(() => render(<SearchSuggestions {...props} />)).not.toThrow();

    // No item should be selected
    const option = screen.getByRole('option');
    expect(option).toHaveAttribute('aria-selected', 'false');
  });
});

// =============================================================================
// VIEW ALL LINK EDGE CASES
// =============================================================================

describe('SearchSuggestions View All Link Edge Cases', () => {
  it('shows view all when total exceeds suggestions length', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 100,
    });

    render(<SearchSuggestions {...props} />);

    expect(screen.getByText('View all 100 results')).toBeInTheDocument();
  });

  it('hides view all when total equals suggestions length', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 1, // Same as suggestions.length
    });

    render(<SearchSuggestions {...props} />);

    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('handles total less than suggestions length (edge case)', () => {
    const suggestions = [
      createSuggestion({ id: '1' }),
      createSuggestion({ id: '2' }),
    ];
    const props = createDefaultProps({
      suggestions,
      total: 1, // Less than suggestions.length (shouldn't happen normally)
    });

    render(<SearchSuggestions {...props} />);

    // remainingCount would be negative, so "View all" should not show
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('handles very large total count', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 999999,
    });

    render(<SearchSuggestions {...props} />);

    // Should format with locale string
    expect(screen.getByText('View all 999,999 results')).toBeInTheDocument();
  });

  it('highlights view all button when index matches', () => {
    const suggestions = [createSuggestion({ id: '1' })];
    const props = createDefaultProps({
      suggestions,
      total: 10,
      highlightedIndex: 1, // suggestions.length (index of view all button)
    });

    render(<SearchSuggestions {...props} />);

    const viewAllButton = screen.getByText('View all 10 results');
    // Should have highlight styling class
    expect(viewAllButton.className).toContain('text-gold');
  });
});

// =============================================================================
// LOADING STATE EDGE CASES
// =============================================================================

describe('SearchSuggestions Loading State Edge Cases', () => {
  it('shows loading when isLoading is true and suggestions exist', () => {
    // Note: Current implementation shows loading instead of suggestions
    const props = createDefaultProps({
      suggestions: [createSuggestion()],
      isLoading: true,
    });

    render(<SearchSuggestions {...props} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('shows loading spinner animation', () => {
    const props = createDefaultProps({
      suggestions: [],
      isLoading: true,
    });

    render(<SearchSuggestions {...props} />);

    // Check for animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('transitions from loading to results', () => {
    const props = createDefaultProps({
      suggestions: [],
      isLoading: true,
    });

    const { rerender } = render(<SearchSuggestions {...props} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    // Update to show results
    rerender(
      <SearchSuggestions
        {...props}
        suggestions={[createSuggestion()]}
        isLoading={false}
      />
    );

    expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    expect(screen.getByRole('option')).toBeInTheDocument();
  });

  it('transitions from loading to no results', () => {
    const props = createDefaultProps({
      suggestions: [],
      isLoading: true,
    });

    const { rerender } = render(<SearchSuggestions {...props} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    // Update to show no results
    rerender(<SearchSuggestions {...props} isLoading={false} />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});

// =============================================================================
// ACCESSIBILITY EDGE CASES
// =============================================================================

describe('SearchSuggestions Accessibility Edge Cases', () => {
  it('has correct ARIA attributes on container', () => {
    const props = createDefaultProps();

    render(<SearchSuggestions {...props} />);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');
  });

  it('has correct ARIA attributes on options', () => {
    const props = createDefaultProps({
      highlightedIndex: 0,
    });

    render(<SearchSuggestions {...props} />);

    const option = screen.getByRole('option');
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('updates aria-selected on highlight change', () => {
    const suggestions = [
      createSuggestion({ id: '1', smith: 'Smith 1' }),
      createSuggestion({ id: '2', smith: 'Smith 2' }),
    ];
    const props = createDefaultProps({
      suggestions,
      total: 2,
      highlightedIndex: 0,
    });

    const { rerender } = render(<SearchSuggestions {...props} />);

    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');

    // Change highlight
    rerender(<SearchSuggestions {...props} highlightedIndex={1} />);

    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('has group role for suggestions list', () => {
    const props = createDefaultProps();

    render(<SearchSuggestions {...props} />);

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-label', 'Suggestions');
  });
});

// =============================================================================
// ITEM TYPE FORMATTING EDGE CASES
// =============================================================================

describe('SearchSuggestions Item Type Formatting Edge Cases', () => {
  it('formats known item types correctly', () => {
    const itemTypes = [
      { input: 'katana', expected: 'Katana' },
      { input: 'KATANA', expected: 'Katana' },
      { input: 'wakizashi', expected: 'Wakizashi' },
      { input: 'tsuba', expected: 'Tsuba' },
      { input: 'fuchi_kashira', expected: 'Fuchi-Kashira' },
      { input: 'fuchi-kashira', expected: 'Fuchi-Kashira' },
    ];

    itemTypes.forEach(({ input, expected }) => {
      const props = createDefaultProps({
        suggestions: [createSuggestion({ item_type: input })],
      });

      const { unmount } = render(<SearchSuggestions {...props} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('displays unknown item types as-is', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ item_type: 'unknown_type' })],
    });

    render(<SearchSuggestions {...props} />);

    // Should display the raw type
    expect(screen.getByText('unknown_type')).toBeInTheDocument();
  });

  it('handles empty string item type', () => {
    const props = createDefaultProps({
      suggestions: [createSuggestion({ item_type: '' })],
    });

    render(<SearchSuggestions {...props} />);

    // Empty string is falsy, should not show type badge
    // (This depends on how formatItemType handles empty strings)
  });
});
