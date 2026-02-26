import { describe, it, expect } from 'vitest';
import { collectionItemToListing, collectionItemsToListings } from '@/lib/collection/adapter';
import { CollectionItem } from '@/types/collection';

// =============================================================================
// Fixtures
// =============================================================================

const BASE_ITEM: CollectionItem = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  user_id: 'user-123',
  source_listing_id: 42,
  item_type: 'KATANA',
  title: 'Bizen Osafune Kanemitsu',
  artisan_id: 'KAN100',
  artisan_display_name: 'Kanemitsu',
  cert_type: 'Juyo',
  cert_session: 55,
  cert_organization: 'NBTHK',
  smith: '兼光',
  school: 'Bizen',
  province: 'Bizen',
  era: 'Nanbokucho',
  mei_type: 'signed',
  nagasa_cm: 72.5,
  sori_cm: 1.8,
  motohaba_cm: 3.2,
  sakihaba_cm: 2.1,
  price_paid: 500000,
  price_paid_currency: 'JPY',
  current_value: 800000,
  current_value_currency: 'JPY',
  acquired_date: '2024-06-15',
  acquired_from: 'Aoi Art',
  condition: 'excellent' as const,
  status: 'owned' as const,
  notes: 'Beautiful hamon',
  images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  catalog_reference: null,
  is_public: false,
  folder_id: null,
  sort_order: 0,
  created_at: '2024-06-15T10:00:00Z',
  updated_at: '2024-06-20T12:00:00Z',
};

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return Object.assign({}, BASE_ITEM, overrides);
}

// =============================================================================
// Tests
// =============================================================================

describe('collectionItemToListing', () => {
  it('maps all required Listing fields', () => {
    const item = makeItem();
    const listing = collectionItemToListing(item);

    expect(listing.id).toBe(item.id);
    expect(listing.url).toBe('');
    expect(listing.title).toBe('Bizen Osafune Kanemitsu');
    expect(listing.item_type).toBe('KATANA');
    expect(listing.smith).toBe('兼光');
    expect(listing.school).toBe('Bizen');
    expect(listing.cert_type).toBe('Juyo');
    expect(listing.nagasa_cm).toBe(72.5);
    expect(listing.era).toBe('Nanbokucho');
    expect(listing.first_seen_at).toBe('2024-06-15T10:00:00Z');
  });

  it('prefers current_value over price_paid for price_value', () => {
    const item = makeItem({ current_value: 800000, price_paid: 500000 });
    const listing = collectionItemToListing(item);
    expect(listing.price_value).toBe(800000);
    expect(listing.price_currency).toBe('JPY');
  });

  it('falls back to price_paid when current_value is null', () => {
    const item = makeItem();
    item.current_value = null;
    item.current_value_currency = null;
    item.price_paid = 500000;
    item.price_paid_currency = 'USD';
    const listing = collectionItemToListing(item);
    expect(listing.price_value).toBe(500000);
    expect(listing.price_currency).toBe('USD');
  });

  it('returns null price when both current_value and price_paid are null', () => {
    const item = makeItem();
    item.current_value = null;
    item.current_value_currency = null;
    item.price_paid = null;
    item.price_paid_currency = null;
    const listing = collectionItemToListing(item);
    expect(listing.price_value).toBeNull();
    expect(listing.price_currency).toBeNull();
  });

  it('creates valid synthetic dealers object from acquired_from', () => {
    const item = makeItem({ acquired_from: 'Aoi Art' });
    const listing = collectionItemToListing(item);
    expect(listing.dealers).toEqual({
      id: -1,
      name: 'Aoi Art',
      name_ja: null,
      domain: '',
    });
    expect(listing.dealer_id).toBe(-1);
  });

  it('uses "Personal Collection" when acquired_from is null', () => {
    const item = makeItem();
    item.acquired_from = null;
    const listing = collectionItemToListing(item);
    expect(listing.dealers.name).toBe('Personal Collection');
  });

  it('uses "Personal Collection" when acquired_from is empty string', () => {
    const item = makeItem({ acquired_from: '' });
    const listing = collectionItemToListing(item);
    expect(listing.dealers.name).toBe('Personal Collection');
  });

  it('sets is_initial_import to true (suppresses "New" badge)', () => {
    const listing = collectionItemToListing(makeItem());
    expect(listing.is_initial_import).toBe(true);
  });

  it('always sets status to available', () => {
    const listing = collectionItemToListing(makeItem({ status: 'sold' }));
    expect(listing.status).toBe('available');
    expect(listing.is_available).toBe(true);
    expect(listing.is_sold).toBe(false);
  });

  it('maps artisan_id and artisan_display_name correctly', () => {
    const item = makeItem({ artisan_id: 'KAN100', artisan_display_name: 'Kanemitsu' });
    const listing = collectionItemToListing(item);
    expect(listing.artisan_id).toBe('KAN100');
    expect(listing.artisan_display_name).toBe('Kanemitsu');
    expect(listing.artisan_confidence).toBe('HIGH');
  });

  it('sets artisan_confidence to null when artisan_id is null', () => {
    const item = makeItem();
    item.artisan_id = null;
    item.artisan_display_name = null;
    const listing = collectionItemToListing(item);
    expect(listing.artisan_id).toBeNull();
    expect(listing.artisan_display_name).toBeNull();
    expect(listing.artisan_confidence).toBeNull();
  });

  it('maps images array when non-empty', () => {
    const item = makeItem({ images: ['a.jpg', 'b.jpg'] });
    const listing = collectionItemToListing(item);
    expect(listing.images).toEqual(['a.jpg', 'b.jpg']);
  });

  it('maps empty images array to null', () => {
    const item = makeItem({ images: [] });
    const listing = collectionItemToListing(item);
    expect(listing.images).toBeNull();
  });

  it('maps notes to description', () => {
    const item = makeItem({ notes: 'Beautiful hamon with choji pattern' });
    const listing = collectionItemToListing(item);
    expect(listing.description).toBe('Beautiful hamon with choji pattern');
  });

  it('maps measurement fields (province, mei_type, sori, motohaba, sakihaba)', () => {
    const item = makeItem();
    const listing = collectionItemToListing(item);
    expect(listing.province).toBe('Bizen');
    expect(listing.mei_type).toBe('signed');
    expect(listing.sori_cm).toBe(1.8);
    expect(listing.motohaba_cm).toBe(3.2);
    expect(listing.sakihaba_cm).toBe(2.1);
  });

  it('handles null fields gracefully', () => {
    const item = makeItem();
    item.title = null;
    item.item_type = null;
    item.smith = null;
    item.school = null;
    item.cert_type = null;
    item.nagasa_cm = null;
    item.era = null;
    item.notes = null;
    item.province = null;
    item.mei_type = null;
    item.sori_cm = null;
    item.motohaba_cm = null;
    item.sakihaba_cm = null;
    const listing = collectionItemToListing(item);
    expect(listing.title).toBeNull();
    expect(listing.item_type).toBeNull();
    expect(listing.smith).toBeNull();
    expect(listing.school).toBeNull();
    expect(listing.cert_type).toBeNull();
    expect(listing.nagasa_cm).toBeNull();
    expect(listing.era).toBeNull();
    expect(listing.description).toBeNull();
    expect(listing.province).toBeNull();
    expect(listing.mei_type).toBeNull();
    expect(listing.sori_cm).toBeNull();
    expect(listing.motohaba_cm).toBeNull();
    expect(listing.sakihaba_cm).toBeNull();
  });

  it('sets tosogu_maker and tosogu_school to null', () => {
    const listing = collectionItemToListing(makeItem());
    expect(listing.tosogu_maker).toBeNull();
    expect(listing.tosogu_school).toBeNull();
  });

  it('sets focal_x and focal_y to null', () => {
    const listing = collectionItemToListing(makeItem());
    expect(listing.focal_x).toBeNull();
    expect(listing.focal_y).toBeNull();
  });
});

describe('collectionItemsToListings', () => {
  it('returns same-length array', () => {
    const items = [makeItem(), makeItem({ id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff' })];
    const listings = collectionItemsToListings(items);
    expect(listings).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(collectionItemsToListings([])).toEqual([]);
  });

  it('preserves item order', () => {
    const a = makeItem({ id: 'aaaa-1111-2222-3333-444444444444', title: 'First' });
    const b = makeItem({ id: 'bbbb-1111-2222-3333-444444444444', title: 'Second' });
    const c = makeItem({ id: 'cccc-1111-2222-3333-444444444444', title: 'Third' });
    const listings = collectionItemsToListings([a, b, c]);
    expect(listings[0].id).toBe('aaaa-1111-2222-3333-444444444444');
    expect(listings[1].id).toBe('bbbb-1111-2222-3333-444444444444');
    expect(listings[2].id).toBe('cccc-1111-2222-3333-444444444444');
    expect(listings[0].title).toBe('First');
    expect(listings[1].title).toBe('Second');
    expect(listings[2].title).toBe('Third');
  });
});
