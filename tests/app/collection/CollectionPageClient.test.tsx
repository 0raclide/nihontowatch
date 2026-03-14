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
    fetchHistoricalRate: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@/hooks/useHomeCurrency', () => ({
  useHomeCurrency: () => ({
    homeCurrency: 'USD',
    setHomeCurrency: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useVaultReturns', () => ({
  useVaultReturns: () => ({
    returnMap: new Map(),
    isLoadingRates: false,
  }),
}));

// ---------------------------------------------------------------------------
// Mock auth + subscription (needed by CollectionPageClient)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: null,
    session: null,
    isLoading: false,
    isAdmin: false,
  }),
}));

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    tier: 'free',
    isDealer: false,
    isFree: true,
    isInnerCircle: false,
    canAccessFeature: () => true,
  }),
}));

vi.mock('@/contexts/MobileUIContext', () => ({
  useMobileUI: () => ({
    openNavDrawer: vi.fn(),
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

vi.mock('@/components/collection/SortableCollectionGrid', () => ({
  SortableCollectionGrid: () => <div data-testid="sortable-grid" />,
}));

vi.mock('@/components/collection/VaultTableView', () => ({
  VaultTableView: () => <div data-testid="vault-table-view" />,
}));

vi.mock('@/components/collection/VaultViewToggle', () => ({
  VaultViewToggle: () => <div data-testid="vault-view-toggle" />,
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

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock('@/components/collection/HomeCurrencyPicker', () => ({
  HomeCurrencyPicker: () => <div data-testid="home-currency-picker" />,
}));

// ---------------------------------------------------------------------------
// Mock fetch — CollectionItemRow shape
// ---------------------------------------------------------------------------

const MOCK_ITEMS = [
  {
    // Identity (CollectionItemRow)
    id: 'pk-aaa',
    item_uuid: 'uuid-111',
    owner_id: 'user-1',

    // Collection-only
    visibility: 'private' as const,
    source_listing_id: null,
    personal_notes: null,

    // Shared fields (ItemDataFields)
    item_type: 'KATANA',
    item_category: 'nihonto',
    title: 'Test Katana',
    description: null,
    status: 'INVENTORY',
    is_available: true,
    is_sold: false,
    price_value: null,
    price_currency: null,

    // Attribution
    smith: '正宗',
    school: 'Sagami',
    province: null,
    era: null,
    mei_type: null,
    mei_text: null,
    mei_guaranteed: null,
    nakago_type: null,

    // Tosogu
    tosogu_maker: null,
    tosogu_school: null,
    material: null,
    height_cm: null,
    width_cm: null,
    thickness_mm: null,

    // Certification
    cert_type: 'Juyo',
    cert_session: null,
    cert_organization: null,

    // Measurements
    nagasa_cm: 70,
    sori_cm: null,
    motohaba_cm: null,
    sakihaba_cm: null,
    kasane_cm: null,
    weight_g: null,
    nakago_cm: null,

    // Media
    images: ['https://example.com/img.jpg'],
    stored_images: null,

    // Artisan
    artisan_id: null,
    artisan_confidence: null,

    // JSONB sections
    sayagaki: null,
    hakogaki: null,
    koshirae: null,
    provenance: null,
    kiwame: null,
    kanto_hibisho: null,

    // Setsumei
    setsumei_text_en: null,
    setsumei_text_ja: null,

    // Translation cache
    title_en: null,
    title_ja: null,
    description_en: null,
    description_ja: null,

    // AI curator
    ai_curator_note_en: null,
    ai_curator_note_ja: null,

    // Smart crop
    focal_x: null,
    focal_y: null,
    hero_image_index: null,
    video_count: 0,

    // Timestamps
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'pk-bbb',
    item_uuid: 'uuid-222',
    owner_id: 'user-1',
    visibility: 'private' as const,
    source_listing_id: null,
    personal_notes: null,
    item_type: 'WAKIZASHI',
    item_category: 'nihonto',
    title: 'Test Wakizashi',
    description: null,
    status: 'INVENTORY',
    is_available: true,
    is_sold: false,
    price_value: null,
    price_currency: null,
    smith: null,
    school: null,
    province: null,
    era: null,
    mei_type: null,
    mei_text: null,
    mei_guaranteed: null,
    nakago_type: null,
    tosogu_maker: null,
    tosogu_school: null,
    material: null,
    height_cm: null,
    width_cm: null,
    thickness_mm: null,
    cert_type: null,
    cert_session: null,
    cert_organization: null,
    nagasa_cm: 45,
    sori_cm: null,
    motohaba_cm: null,
    sakihaba_cm: null,
    kasane_cm: null,
    weight_g: null,
    nakago_cm: null,
    images: [],
    stored_images: null,
    artisan_id: null,
    artisan_confidence: null,
    sayagaki: null,
    hakogaki: null,
    koshirae: null,
    provenance: null,
    kiwame: null,
    kanto_hibisho: null,
    setsumei_text_en: null,
    setsumei_text_ja: null,
    title_en: null,
    title_ja: null,
    description_en: null,
    description_ja: null,
    ai_curator_note_en: null,
    ai_curator_note_ja: null,
    focal_x: null,
    focal_y: null,
    hero_image_index: null,
    video_count: 0,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  capturedGridProps = null;
  mockSearchParams = new URLSearchParams();

  // Force mobile viewport so isDesktop=false and ListingGrid is rendered (not SortableCollectionGrid)
  Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });

  // Mock localStorage (jsdom doesn't always provide it as a function)
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

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
  const { CollectionPageClient } = await import('@/app/vault/CollectionPageClient');
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

    // Items should be rendered — DisplayItem.id = item_uuid
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
    // DisplayItem.id should be item_uuid, not PK
    expect(capturedGridProps.preMappedItems[0].id).toBe('uuid-111');
  });

  it('renders Add button in toolbar', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('listing-grid')).toBeInTheDocument();
    });

    // The Add button is rendered as an inline button (not via appendSlot)
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('clicking Add button navigates to vault add page', async () => {
    // Mock window.location.href setter
    const locationHrefSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);
    const hrefSetter = vi.fn();
    Object.defineProperty(window.location, 'href', { set: hrefSetter, configurable: true });

    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('listing-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add'));
    expect(hrefSetter).toHaveBeenCalledWith('/vault/add');

    locationHrefSpy.mockRestore();
  });

  it('card click routes through openCollectionQuickView with item_uuid lookup', async () => {
    await act(async () => {
      await renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-uuid-111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('item-uuid-111'));

    expect(mockOpenCollectionQuickView).toHaveBeenCalledWith(
      expect.objectContaining({ item_uuid: 'uuid-111', title: 'Test Katana' }),
      'view'
    );
  });

  describe('deep link ?item=UUID', () => {
    it('auto-opens QuickView for matching item after load (matches item_uuid)', async () => {
      mockSearchParams = new URLSearchParams('item=uuid-222');

      await act(async () => {
        await renderPage();
      });

      await waitFor(() => {
        expect(mockOpenCollectionQuickView).toHaveBeenCalledWith(
          expect.objectContaining({ item_uuid: 'uuid-222' }),
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

    // Should be called with DisplayItem[] (adapted from CollectionItemRow[])
    const passedListings = mockSetListings.mock.calls[0][0];
    expect(passedListings).toHaveLength(2);
  });
});
