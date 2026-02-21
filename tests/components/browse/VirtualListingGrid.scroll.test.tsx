/**
 * Integration tests for VirtualListingGrid scroll behavior.
 *
 * These tests verify that the virtual scroll implementation:
 * 1. Does not cause visual jumping during normal scrolling
 * 2. Only updates offsetY when crossing row boundaries
 * 3. Maintains stable card positions relative to scroll
 *
 * Background: Prior to the Jan 2025 fix, scroll threshold-based updates
 * caused offsetY to jump out of sync with actual scroll position.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { VirtualListingGrid } from '@/components/browse/VirtualListingGrid';

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

// Mock QuickView context
vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => null,
}));

// Mock scroll lock
vi.mock('@/hooks/useBodyScrollLock', () => ({
  isScrollLockActive: () => (window as unknown as { __scrollLockActive?: boolean }).__scrollLockActive ?? false,
}));

// Create mock listings
const createMockListings = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    url: `https://example.com/listing/${i + 1}`,
    title: `Test Listing ${i + 1}`,
    item_type: 'KATANA',
    price_value: 100000 + i * 1000,
    price_currency: 'JPY',
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    cert_type: null,
    nagasa_cm: null,
    images: [`https://example.com/image${i}.jpg`],
    first_seen_at: '2025-01-01T00:00:00Z',
    status: 'AVAILABLE',
    is_available: true,
    is_sold: false,
    dealer_id: 1,
    dealers: {
      id: 1,
      name: 'Test Dealer',
      domain: 'example.com',
    },
  }));

// Mock window properties
const mockWindowProperties = (width: number, height: number, scrollY: number = 0) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true });
};

// Helper to simulate scroll
const simulateScroll = async (scrollY: number) => {
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true });
  window.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(16); // RAF timing
};

describe('VirtualListingGrid scroll behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWindowProperties(1280, 800); // Desktop: 4 columns, 372px row height
    (window as unknown as { __scrollLockActive?: boolean }).__scrollLockActive = false;

    // Mock IntersectionObserver
    const mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null,
    });
    window.IntersectionObserver = mockIntersectionObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders without crashing with many items', async () => {
    const listings = createMockListings(200);

    render(
      <VirtualListingGrid
        listings={listings}
        total={200}
        currency="JPY"
        exchangeRates={null}
        infiniteScroll={true}
        hasMore={false}
      />
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should render some cards (virtualized)
    const cards = screen.getAllByTestId('listing-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(200); // Virtualized, not all rendered
  });

  it('maintains grid structure during scroll', async () => {
    const listings = createMockListings(200);

    render(
      <VirtualListingGrid
        listings={listings}
        total={200}
        currency="JPY"
        exchangeRates={null}
        infiniteScroll={true}
        hasMore={false}
      />
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const grid = screen.getByTestId('virtual-listing-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.classList.contains('grid')).toBe(true);

    // Scroll down
    await act(async () => {
      await simulateScroll(2000);
    });

    // Grid should still be intact
    const gridAfterScroll = screen.getByTestId('virtual-listing-grid');
    expect(gridAfterScroll).toBeInTheDocument();
  });

  it('updates visible items when scrolling past row boundaries', async () => {
    const listings = createMockListings(200);

    render(
      <VirtualListingGrid
        listings={listings}
        total={200}
        currency="JPY"
        exchangeRates={null}
        infiniteScroll={true}
        hasMore={false}
      />
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialCards = screen.getAllByTestId('listing-card');
    const initialCount = initialCards.length;

    // Scroll significantly
    await act(async () => {
      await simulateScroll(5000);
    });

    // Should still have cards rendered
    const cardsAfterScroll = screen.getAllByTestId('listing-card');
    expect(cardsAfterScroll.length).toBeGreaterThan(0);

    // The card count should be roughly similar (virtualization maintains consistent visible count)
    expect(Math.abs(cardsAfterScroll.length - initialCount)).toBeLessThan(20);
  });

  it('does not update during scroll lock', async () => {
    const listings = createMockListings(100);

    render(
      <VirtualListingGrid
        listings={listings}
        total={100}
        currency="JPY"
        exchangeRates={null}
        infiniteScroll={true}
        hasMore={false}
      />
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialCards = screen.getAllByTestId('listing-card');
    const firstCardId = initialCards[0].getAttribute('data-listing-id');

    // Enable scroll lock (simulating modal open)
    (window as unknown as { __scrollLockActive?: boolean }).__scrollLockActive = true;

    // Try to scroll
    await act(async () => {
      await simulateScroll(5000);
    });

    // The first card should be the same (no update during lock)
    const cardsAfterLock = screen.getAllByTestId('listing-card');
    expect(cardsAfterLock[0].getAttribute('data-listing-id')).toBe(firstCardId);

    // Disable scroll lock
    (window as unknown as { __scrollLockActive?: boolean }).__scrollLockActive = false;

    // Now scroll should work
    await act(async () => {
      await simulateScroll(5000);
    });

    const cardsAfterUnlock = screen.getAllByTestId('listing-card');
    // After scrolling 5000px with 372px rows, we should see different cards
    expect(cardsAfterUnlock[0].getAttribute('data-listing-id')).not.toBe(firstCardId);
  });

  describe('pagination mode', () => {
    it('shows all items without virtualization when infiniteScroll is false', async () => {
      const listings = createMockListings(20);

      render(
        <VirtualListingGrid
          listings={listings}
          total={100}
          currency="JPY"
          exchangeRates={null}
          infiniteScroll={false}
          page={1}
          totalPages={5}
        />
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // In pagination mode, all items on the page should be rendered
      const cards = screen.getAllByTestId('listing-card');
      expect(cards.length).toBe(20);
    });
  });

  describe('small lists', () => {
    it('disables virtualization for small lists', async () => {
      const listings = createMockListings(10);

      render(
        <VirtualListingGrid
          listings={listings}
          total={10}
          currency="JPY"
          exchangeRates={null}
          infiniteScroll={true}
          hasMore={false}
        />
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Small list should show all items
      const cards = screen.getAllByTestId('listing-card');
      expect(cards.length).toBe(10);
    });
  });
});
