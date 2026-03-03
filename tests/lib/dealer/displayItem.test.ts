import { describe, it, expect, vi } from 'vitest';
import { listingToDisplayItem } from '@/lib/displayItem/fromListing';
import { dealerListingToDisplayItem } from '@/lib/displayItem/fromDealerListing';

// =============================================================================
// Dealer DisplayItem Mapping — Golden Tests
//
// Tests source auto-detection in fromListing.ts AND the dealer-specific mapper.
// These prevent the regression where browse would render wrong QuickView slots
// for dealer listings after Phase 3 go-live.
// =============================================================================

vi.mock('@/lib/dealers/displayName', () => ({
  getDealerDisplayName: (dealer: { name: string; name_ja?: string | null }, locale: string) => {
    if (locale === 'ja' && dealer.name_ja) return dealer.name_ja;
    return dealer.name;
  },
}));

function makeListing(overrides: Record<string, any> = {}) {
  return {
    id: 500,
    url: 'https://example.com/listing/500',
    title: 'Test Katana',
    item_type: 'KATANA',
    images: ['img1.jpg'],
    status: 'available',
    is_available: true,
    is_sold: false,
    first_seen_at: '2026-03-01T00:00:00Z',
    dealers: { id: 10, name: 'Aoi Art', name_ja: '葵美術', domain: 'aoi-art.com' },
    ...overrides,
  };
}

// =============================================================================
// Source auto-detection in listingToDisplayItem (fromListing.ts)
// =============================================================================

describe('listingToDisplayItem — source auto-detection', () => {
  it('sets source="browse" for scraper listings (default)', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.source).toBe('browse');
    expect(di.dealer).toBeNull();
  });

  it('sets source="browse" when source is explicitly "scraper"', () => {
    const di = listingToDisplayItem(makeListing({ source: 'scraper' }), 'en');
    expect(di.source).toBe('browse');
    expect(di.dealer).toBeNull();
  });

  it('GOLDEN: auto-detects source="dealer" from listing.source field', () => {
    const di = listingToDisplayItem(makeListing({ source: 'dealer' }), 'en');
    expect(di.source).toBe('dealer');
    expect(di.dealer).toEqual({ isOwnListing: false });
  });

  it('GOLDEN: auto-detects source="dealer" even without nw:// URL', () => {
    // In browse, dealer listings have normal-looking URLs but source='dealer'
    const di = listingToDisplayItem(
      makeListing({ source: 'dealer', url: 'https://nihontowatch.com/something' }),
      'en'
    );
    expect(di.source).toBe('dealer');
    expect(di.dealer).toEqual({ isOwnListing: false });
  });

  it('sets source="browse" when source is null/undefined', () => {
    const di = listingToDisplayItem(makeListing({ source: null }), 'en');
    expect(di.source).toBe('browse');
    expect(di.dealer).toBeNull();
  });

  it('sets source="browse" when source field is absent', () => {
    const listing = makeListing();
    delete listing.source;
    const di = listingToDisplayItem(listing, 'en');
    expect(di.source).toBe('browse');
    expect(di.dealer).toBeNull();
  });
});

// =============================================================================
// dealerListingToDisplayItem (fromDealerListing.ts)
// =============================================================================

describe('dealerListingToDisplayItem', () => {
  it('overrides source to "dealer"', () => {
    const di = dealerListingToDisplayItem(makeListing(), 'en', true);
    expect(di.source).toBe('dealer');
  });

  it('sets dealer extension with isOwnListing=true', () => {
    const di = dealerListingToDisplayItem(makeListing(), 'en', true);
    expect(di.dealer).toEqual({ isOwnListing: true });
  });

  it('sets dealer extension with isOwnListing=false', () => {
    const di = dealerListingToDisplayItem(makeListing(), 'en', false);
    expect(di.dealer).toEqual({ isOwnListing: false });
  });

  it('preserves all base fields from listingToDisplayItem', () => {
    const listing = makeListing({
      price_value: 300000,
      price_currency: 'JPY',
      cert_type: 'Hozon',
      smith: '正宗',
    });
    const di = dealerListingToDisplayItem(listing, 'en', true);

    // Base fields should pass through
    expect(di.id).toBe(500);
    expect(di.title).toBe('Test Katana');
    expect(di.price_value).toBe(300000);
    expect(di.cert_type).toBe('Hozon');
    expect(di.smith).toBe('正宗');
    expect(di.dealer_display_name).toBe('Aoi Art');
  });

  it('preserves browse extension from base mapper', () => {
    const di = dealerListingToDisplayItem(
      makeListing({ featured_score: 100 }),
      'en',
      true
    );
    expect(di.browse).not.toBeNull();
    expect(di.browse!.featured_score).toBe(100);
  });

  it('respects locale for dealer display name', () => {
    const di = dealerListingToDisplayItem(makeListing(), 'ja', true);
    expect(di.dealer_display_name).toBe('葵美術');
  });
});
