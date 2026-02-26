/**
 * Tests for CollectionPageClient:
 * - Renders ListingGrid with adapted items
 * - Deep link ?item=UUID opens QuickView after items load
 * - Card click routes through openCollectionQuickView
 * - AddItemCard rendered via appendSlot
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import type { DisplayItem } from '@/types/displayItem';

// ---------------------------------------------------------------------------
// Mock QuickView context — track calls
// ---------------------------------------------------------------------------

const mockOpenCollectionQuickView = vi.fn();
const mockOpenCollectionAddForm = vi.fn();
const mockSetListings = vi.fn();
const mockSetOnCollectionSaved = vi.fn();

vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickView: () => ({
    isOpen: false,
    currentListing: null,
    openQuickView: vi.fn(),
    closeQuickView: vi.fn(),
    dismissForNavigation: vi.fn(),
    listings: [],
    currentIndex: -1,
    goToNext: vi.fn(),
    goToPrevious: vi.fn(),
    hasNext: false,
    hasPrevious: false,
    setListings: mockSetListings,
    isAlertMode: false,
    setAlertMode: vi.fn(),
    refreshCurrentListing: vi.fn(),
    detailLoaded: false,
    source: 'browse' as const,
    collectionItem: null,
    collectionMode: null,
    openCollectionQuickView: mockOpenCollectionQuickView,
    openCollectionAddForm: mockOpenCollectionAddForm,
    setCollectionMode: vi.fn(),
    onCollectionSaved: null,
    setOnCollectionSaved: mockSetOnCollectionSaved,
  }),
  useQuickViewOptional: () => null,
}));

// ---------------------------------------------------------------------------
// Mock search params
// ---------------------------------------------------------------------------

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/collection',
}));

// ---------------------------------------------------------------------------
// Mock locale
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

// ---------------------------------------------------------------------------
// Mock currency
// ---------------------------------------------------------------------------

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JPY' as const,
    exchangeRates: null,
    setCurrency: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock ListingGrid — capture props
// ---------------------------------------------------------------------------

let capturedGridProps: any = null;

vi.mock('@/components/browse/ListingGrid', () => ({
  ListingGrid: (props: any) => {
    capturedGridProps = props;
    return (
      <div data-testid="listing-grid">
        {props.preMappedItems?.map((item: DisplayItem) => (
          <div
            key={item.id}
            data-testid={`item-${item.id}`}
            onClick={() => props.onCardClick?.(item)}
          >
            {item.title}
          </div>
        ))}
        {props.appendSlot}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Mock other components
// ---------------------------------------------------------------------------

vi.mock('@/components/collection/CollectionFilterContent', () => ({
  CollectionFilterContent: () => <div data-testid="filter-content" />,
}));

vi.mock('@/components/collection/CollectionBottomBar', () => ({
  CollectionBottomBar: () => <div data-testid="bottom-bar" />,
}));

vi.mock('@/components/collection/AddItemCard', () => ({
  AddItemCard: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="add-item-card" onClick={onClick}>Add</button>
  ),
}));

vi.mock('@/components/ui/Drawer', () => ({
  Drawer: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="drawer">{children}</div> : null,
}));

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const MOCK_ITEMS = [
  {
    id: 'uuid-111',
    user_id: 'user-1',
    source_listing_id: null,
    item_type: 'KATANA',
    title: 'Test Katana',
    artisan_id: null,
    artisan_display_name: null,
    cert_type: 'Juyo',
    cert_session: null,
    cert_organization: null,
    smith: '正宗',
    school: 'Sagami',
    province: null,
    era: null,
    mei_type: null,
    nagasa_cm: 70,
    sori_cm: null,
    motohaba_cm: null,
    sakihaba_cm: null,
    price_paid: null,
    price_paid_currency: null,
    current_value: null,
    current_value_currency: null,
    acquired_date: null,
    acquired_from: null,
    condition: 'good' as const,
    status: 'owned' as const,
    notes: null,
    images: ['https://example.com/img.jpg'],
    catalog_reference: null,
    is_public: false,
    folder_id: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'uuid-222',
    user_id: 'user-1',
    source_listing_id: null,
    item_type: 'WAKIZASHI',
    title: 'Test Wakizashi',
    artisan_id: null,
    artisan_display_name: null,
    cert_type: null,
    cert_session: null,
    cert_organization: null,
    smith: null,
    school: null,
    province: null,
    era: null,
    mei_type: null,
    nagasa_cm: 45,
    sori_cm: null,
    motohaba_cm: null,
    sakihaba_cm: null,
    price_paid: null,
    price_paid_currency: null,
    current_value: null,
    current_value_currency: null,
    acquired_date: null,
    acquired_from: null,
    condition: 'fair' as const,
    status: 'owned' as const,
    notes: null,
    images: [],
    catalog_reference: null,
    is_public: false,
    folder_id: null,
    sort_order: 1,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  capturedGridProps = null;
  mockSearchParams = new URLSearchParams();

  // Default: API returns mock items
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      data: MOCK_ITEMS,
      total: 2,
      facets: {
        itemTypes: [],
        certifications: [],
        statuses: [],
        conditions: [],
        folders: [],
      },
    }),
  });
});

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

// Use dynamic import to avoid hoisting issues
async function renderPage() {
  const { CollectionPageClient } = await import('@/app/collection/CollectionPageClient');
  return render(<CollectionPageClient />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionPageClient', () => {
  it('renders ListingGrid with adapted items after fetch', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('listing-grid')).toBeInTheDocument();
    });

    // Items should be rendered
    expect(screen.getByTestId('item-uuid-111')).toBeInTheDocument();
    expect(screen.getByTestId('item-uuid-222')).toBeInTheDocument();
  });

  it('passes preMappedItems (not raw listings) to ListingGrid', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(capturedGridProps).not.toBeNull();
    });

    // listings should be empty (we pass preMappedItems instead)
    expect(capturedGridProps.listings).toEqual([]);
    // preMappedItems should have 2 DisplayItems
    expect(capturedGridProps.preMappedItems).toHaveLength(2);
    // First item should be a DisplayItem with source='collection'
    expect(capturedGridProps.preMappedItems[0].source).toBe('collection');
    expect(capturedGridProps.preMappedItems[0].title).toBe('Test Katana');
  });

  it('renders AddItemCard via appendSlot', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('add-item-card')).toBeInTheDocument();
    });
  });

  it('clicking AddItemCard opens collection add form', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('add-item-card')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-item-card'));
    expect(mockOpenCollectionAddForm).toHaveBeenCalled();
  });

  it('card click routes through openCollectionQuickView', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-uuid-111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('item-uuid-111'));

    expect(mockOpenCollectionQuickView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uuid-111', title: 'Test Katana' }),
      'view'
    );
  });

  describe('deep link ?item=UUID', () => {
    it('auto-opens QuickView for matching item after load', async () => {
      mockSearchParams = new URLSearchParams('item=uuid-222');

      await act(async () => {
        await renderPage();
      });

      await waitFor(() => {
        expect(mockOpenCollectionQuickView).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'uuid-222' }),
          'view'
        );
      });
    });

    it('does not open QuickView when item not found', async () => {
      mockSearchParams = new URLSearchParams('item=nonexistent');

      await act(async () => {
        await renderPage();
      });

      // Wait for items to load
      await waitFor(() => {
        expect(screen.getByTestId('listing-grid')).toBeInTheDocument();
      });

      expect(mockOpenCollectionQuickView).not.toHaveBeenCalled();
    });
  });

  it('sets listings in QuickView context for J/K navigation', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(mockSetListings).toHaveBeenCalled();
    });

    // Should be called with DisplayItem[] (adapted from CollectionItems)
    const passedListings = mockSetListings.mock.calls[0][0];
    expect(passedListings).toHaveLength(2);
  });
});
