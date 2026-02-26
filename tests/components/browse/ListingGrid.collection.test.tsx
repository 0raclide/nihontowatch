/**
 * Tests for ListingGrid collection-mode features:
 * - appendSlot renders after cards
 * - preMappedItems bypasses internal mapping
 * - onCardClick overrides default QuickView behavior
 * - Empty collection with appendSlot shows slot (no empty state)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ListingGrid } from '@/components/browse/ListingGrid';
import type { DisplayItem } from '@/types/displayItem';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// Track onClick calls on ListingCard
const listingCardOnClicks: DisplayItem[] = [];
vi.mock('@/components/browse/ListingCard', () => ({
  ListingCard: ({ listing, onClick }: { listing: DisplayItem; onClick?: (l: DisplayItem) => void }) => (
    <div
      data-testid={`listing-card-${listing.id}`}
      onClick={() => onClick?.(listing)}
    >
      {listing.title}
    </div>
  ),
}));

vi.mock('@/hooks/useAdaptiveVirtualScroll', () => ({
  useAdaptiveVirtualScroll: ({ items }: { items: unknown[] }) => ({
    visibleItems: items,
    startIndex: 0,
    totalHeight: 0,
    offsetY: 0,
    columns: 3,
    rowHeight: 310,
    isVirtualized: false,
  }),
}));

vi.mock('@/hooks/useScrollPositionLock', () => ({
  useScrollPositionLock: () => ({
    lockScrollPosition: vi.fn(),
    unlockScrollPosition: vi.fn(),
    isLocked: false,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDisplayItem(id: string, title: string): DisplayItem {
  return {
    id,
    source: 'collection',
    title,
    title_en: null,
    title_ja: null,
    description: null,
    description_en: null,
    description_ja: null,
    item_type: 'KATANA',
    price_value: 100000,
    price_currency: 'JPY',
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    province: null,
    era: null,
    mei_type: null,
    cert_type: null,
    cert_session: null,
    cert_organization: null,
    nagasa_cm: null,
    sori_cm: null,
    motohaba_cm: null,
    sakihaba_cm: null,
    kasane_cm: null,
    weight_g: null,
    images: ['https://example.com/img.jpg'],
    stored_images: null,
    og_image_url: null,
    focal_x: null,
    focal_y: null,
    thumbnail_url: null,
    artisan_id: null,
    artisan_display_name: null,
    artisan_name_kanji: null,
    artisan_confidence: null,
    artisan_tier: null,
    artisan_method: null,
    artisan_candidates: null,
    artisan_verified: null,
    status: 'available',
    is_available: true,
    is_sold: false,
    first_seen_at: '2024-01-01',
    is_initial_import: true,
    dealer_earliest_seen_at: null,
    last_scraped_at: null,
    dealer_display_name: 'Personal Collection',
    dealer_display_name_ja: null,
    dealer_domain: undefined,
    dealer_id: null,
    setsumei_text_en: null,
    has_setsumei: false,
    yuhinkai_enrichment: null,
    browse: null,
    collection: {
      notes: null,
      condition: 'good',
      collection_status: 'owned',
      price_paid: null,
      price_paid_currency: null,
      current_value: null,
      current_value_currency: null,
      acquired_from: null,
      acquired_date: null,
      source_listing_id: null,
    },
  };
}

const defaultProps = {
  listings: [] as any[],
  total: 0,
  page: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
  isLoading: false,
  currency: 'JPY' as const,
  exchangeRates: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListingGrid — Collection Mode', () => {
  describe('appendSlot', () => {
    it('renders appendSlot after listing cards', () => {
      const items = [
        makeDisplayItem('uuid-1', 'My Katana'),
        makeDisplayItem('uuid-2', 'My Wakizashi'),
      ];

      render(
        <ListingGrid
          {...defaultProps}
          preMappedItems={items}
          total={2}
          appendSlot={<button data-testid="add-item-btn">Add Item</button>}
        />
      );

      expect(screen.getByTestId('listing-card-uuid-1')).toBeInTheDocument();
      expect(screen.getByTestId('listing-card-uuid-2')).toBeInTheDocument();
      expect(screen.getByTestId('add-item-btn')).toBeInTheDocument();
    });

    it('shows appendSlot even when collection is empty (no empty state)', () => {
      render(
        <ListingGrid
          {...defaultProps}
          preMappedItems={[]}
          total={0}
          appendSlot={<button data-testid="add-item-btn">Add Item</button>}
        />
      );

      // Should NOT show browse empty state
      expect(screen.queryByText('No items found')).not.toBeInTheDocument();
      // Should show the add button
      expect(screen.getByTestId('add-item-btn')).toBeInTheDocument();
    });
  });

  describe('preMappedItems', () => {
    it('renders pre-mapped DisplayItems without re-mapping', () => {
      const items = [
        makeDisplayItem('uuid-1', 'Pre-mapped Katana'),
      ];

      render(
        <ListingGrid
          {...defaultProps}
          preMappedItems={items}
          total={1}
        />
      );

      // The card should show the pre-mapped title directly
      expect(screen.getByText('Pre-mapped Katana')).toBeInTheDocument();
    });

    it('uses preMappedItems length for hasMore calculation', () => {
      const items = [makeDisplayItem('uuid-1', 'Item 1')];

      const { container } = render(
        <ListingGrid
          {...defaultProps}
          preMappedItems={items}
          total={10} // More than items.length — but collection doesn't use infinite scroll
          infiniteScroll={true}
        />
      );

      // hasMore should be true since 1 < 10
      // The load-more trigger should be present
      const placeholder = container.querySelector('.load-more-placeholder');
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe('onCardClick', () => {
    it('calls onCardClick instead of default QuickView open', () => {
      const onCardClick = vi.fn();
      const items = [makeDisplayItem('uuid-1', 'Clickable Katana')];

      render(
        <ListingGrid
          {...defaultProps}
          preMappedItems={items}
          total={1}
          onCardClick={onCardClick}
        />
      );

      fireEvent.click(screen.getByTestId('listing-card-uuid-1'));
      expect(onCardClick).toHaveBeenCalledWith(items[0]);
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when isLoading', () => {
      render(
        <ListingGrid
          {...defaultProps}
          isLoading={true}
          preMappedItems={[]}
          total={0}
        />
      );

      // Should show skeleton (img-loading class)
      const skeletons = document.querySelectorAll('.img-loading');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
