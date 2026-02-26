import { describe, it, expect, vi } from 'vitest';
import { listingToDisplayItem } from '@/lib/displayItem/fromListing';

// Mock getDealerDisplayName
vi.mock('@/lib/dealers/displayName', () => ({
  getDealerDisplayName: (dealer: { name: string; name_ja?: string | null }, locale: string) => {
    if (locale === 'ja' && dealer.name_ja) return dealer.name_ja;
    return dealer.name;
  },
}));

// =============================================================================
// Fixtures
// =============================================================================

function makeListing(overrides: Record<string, any> = {}) {
  return {
    id: 123,
    url: 'https://example.com/listing/123',
    title: 'Test Katana by Kanemitsu',
    title_en: 'English Title',
    title_ja: null,
    description: 'A fine blade',
    description_en: 'An English description',
    description_ja: null,
    item_type: 'KATANA',
    price_value: 500000,
    price_currency: 'JPY',
    smith: '兼光',
    tosogu_maker: null,
    school: 'Bizen',
    tosogu_school: null,
    province: 'Bizen',
    era: 'Nanbokucho',
    mei_type: 'signed',
    cert_type: 'Juyo',
    cert_session: 55,
    cert_organization: 'NBTHK',
    nagasa_cm: 72.5,
    sori_cm: 1.8,
    motohaba_cm: 3.2,
    sakihaba_cm: 2.1,
    kasane_cm: 0.7,
    weight_g: null,
    images: ['img1.jpg', 'img2.jpg'],
    stored_images: ['stored1.jpg'],
    og_image_url: 'og.jpg',
    focal_x: 45.2,
    focal_y: 30.1,
    thumbnail_url: 'thumb.jpg',
    artisan_id: 'KAN100',
    artisan_display_name: 'Kanemitsu',
    artisan_name_kanji: '兼光',
    artisan_confidence: 'HIGH' as const,
    artisan_tier: 'elite',
    artisan_method: 'kanji_exact',
    artisan_candidates: [{ artisan_id: 'KAN100' }],
    artisan_verified: null,
    status: 'available',
    is_available: true,
    is_sold: false,
    first_seen_at: '2024-01-15T10:00:00Z',
    is_initial_import: false,
    dealer_earliest_seen_at: '2023-01-01T00:00:00Z',
    last_scraped_at: '2024-01-20T10:00:00Z',
    dealer_id: 5,
    dealers: {
      id: 5,
      name: 'Aoi Art',
      name_ja: '葵美術',
      domain: 'aoi-art.com',
    },
    admin_hidden: false,
    status_admin_locked: false,
    featured_score: 245.5,
    sold_data: null,
    setsumei_text_en: 'A scholarly description',
    has_setsumei: true,
    yuhinkai_enrichment: { some: 'data' },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('listingToDisplayItem', () => {
  it('maps identity fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.id).toBe(123);
    expect(di.source).toBe('browse');
  });

  it('maps content fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.title).toBe('Test Katana by Kanemitsu');
    expect(di.title_en).toBe('English Title');
    expect(di.item_type).toBe('KATANA');
    expect(di.description).toBe('A fine blade');
  });

  it('maps pricing', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.price_value).toBe(500000);
    expect(di.price_currency).toBe('JPY');
  });

  it('maps attribution fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.smith).toBe('兼光');
    expect(di.tosogu_maker).toBeNull();
    expect(di.school).toBe('Bizen');
    expect(di.tosogu_school).toBeNull();
    expect(di.province).toBe('Bizen');
    expect(di.era).toBe('Nanbokucho');
    expect(di.mei_type).toBe('signed');
  });

  it('maps certification', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.cert_type).toBe('Juyo');
    expect(di.cert_session).toBe(55);
    expect(di.cert_organization).toBe('NBTHK');
  });

  it('maps measurements', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.nagasa_cm).toBe(72.5);
    expect(di.sori_cm).toBe(1.8);
    expect(di.motohaba_cm).toBe(3.2);
    expect(di.sakihaba_cm).toBe(2.1);
    expect(di.kasane_cm).toBe(0.7);
    expect(di.weight_g).toBeNull();
  });

  it('maps media fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.images).toEqual(['img1.jpg', 'img2.jpg']);
    expect(di.stored_images).toEqual(['stored1.jpg']);
    expect(di.og_image_url).toBe('og.jpg');
    expect(di.focal_x).toBe(45.2);
    expect(di.focal_y).toBe(30.1);
    expect(di.thumbnail_url).toBe('thumb.jpg');
  });

  it('maps artisan fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.artisan_id).toBe('KAN100');
    expect(di.artisan_display_name).toBe('Kanemitsu');
    expect(di.artisan_name_kanji).toBe('兼光');
    expect(di.artisan_confidence).toBe('HIGH');
    expect(di.artisan_tier).toBe('elite');
    expect(di.artisan_method).toBe('kanji_exact');
    expect(di.artisan_candidates).toEqual([{ artisan_id: 'KAN100' }]);
    expect(di.artisan_verified).toBeNull();
  });

  it('maps status fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.status).toBe('available');
    expect(di.is_available).toBe(true);
    expect(di.is_sold).toBe(false);
  });

  it('maps temporal fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.first_seen_at).toBe('2024-01-15T10:00:00Z');
    expect(di.is_initial_import).toBe(false);
    expect(di.dealer_earliest_seen_at).toBe('2023-01-01T00:00:00Z');
    expect(di.last_scraped_at).toBe('2024-01-20T10:00:00Z');
  });

  it('resolves dealer_display_name for EN locale', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.dealer_display_name).toBe('Aoi Art');
    expect(di.dealer_display_name_ja).toBe('葵美術');
    expect(di.dealer_domain).toBe('aoi-art.com');
    expect(di.dealer_id).toBe(5);
  });

  it('resolves dealer_display_name for JA locale', () => {
    const di = listingToDisplayItem(makeListing(), 'ja');
    expect(di.dealer_display_name).toBe('葵美術');
  });

  it('populates browse extension', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.browse).not.toBeNull();
    expect(di.browse!.url).toBe('https://example.com/listing/123');
    expect(di.browse!.admin_hidden).toBe(false);
    expect(di.browse!.status_admin_locked).toBe(false);
    expect(di.browse!.featured_score).toBe(245.5);
    expect(di.browse!.sold_data).toBeNull();
  });

  it('sets collection extension to null', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.collection).toBeNull();
  });

  it('maps setsumei fields', () => {
    const di = listingToDisplayItem(makeListing(), 'en');
    expect(di.setsumei_text_en).toBe('A scholarly description');
    expect(di.yuhinkai_enrichment).toEqual({ some: 'data' });
  });

  it('handles missing optional fields with null defaults', () => {
    const minimal = {
      id: 1,
      title: null,
      item_type: null,
      images: null,
      status: 'available',
      is_available: true,
      is_sold: false,
      first_seen_at: '2024-01-01T00:00:00Z',
    };
    const di = listingToDisplayItem(minimal, 'en');

    expect(di.title).toBeNull();
    expect(di.item_type).toBeNull();
    expect(di.images).toBeNull();
    expect(di.price_value).toBeNull();
    expect(di.smith).toBeNull();
    expect(di.cert_type).toBeNull();
    expect(di.nagasa_cm).toBeNull();
    expect(di.artisan_id).toBeNull();
    expect(di.dealer_display_name).toBe('Dealer');
    expect(di.dealer_id).toBeNull();
  });

  it('prefers dealers (plural) over dealer (singular)', () => {
    const listing = makeListing({
      dealers: { name: 'Plural Dealer', name_ja: null, domain: 'plural.com' },
      dealer: { name: 'Singular Dealer', name_ja: null, domain: 'singular.com' },
    });
    const di = listingToDisplayItem(listing, 'en');
    expect(di.dealer_display_name).toBe('Plural Dealer');
    expect(di.dealer_domain).toBe('plural.com');
  });

  it('falls back to dealer (singular) when dealers is null', () => {
    const listing = makeListing({
      dealers: null,
      dealer: { name: 'Singular Dealer', name_ja: null, domain: 'singular.com' },
    });
    const di = listingToDisplayItem(listing, 'en');
    expect(di.dealer_display_name).toBe('Singular Dealer');
    expect(di.dealer_domain).toBe('singular.com');
  });

  it('handles sold listing correctly', () => {
    const listing = makeListing({
      status: 'sold',
      is_available: false,
      is_sold: true,
      sold_data: {
        sale_date: '2024-02-01',
        days_on_market: 30,
        days_on_market_display: '30 days',
        confidence: 'high',
      },
    });
    const di = listingToDisplayItem(listing, 'en');
    expect(di.status).toBe('sold');
    expect(di.is_available).toBe(false);
    expect(di.is_sold).toBe(true);
    expect(di.browse!.sold_data).toEqual({
      sale_date: '2024-02-01',
      days_on_market: 30,
      days_on_market_display: '30 days',
      confidence: 'high',
    });
  });

  it('maps admin_hidden to browse extension', () => {
    const listing = makeListing({ admin_hidden: true });
    const di = listingToDisplayItem(listing, 'en');
    expect(di.browse!.admin_hidden).toBe(true);
  });

  it('sets browse.url to empty string when url is missing', () => {
    const listing = makeListing({ url: undefined });
    const di = listingToDisplayItem(listing, 'en');
    expect(di.browse!.url).toBe('');
  });
});
