import { describe, it, expect } from 'vitest';
import { collectionItemToDisplayItem, collectionItemsToDisplayItems } from '@/lib/displayItem/fromCollectionItem';
import type { CollectionItem } from '@/types/collection';

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

describe('collectionItemToDisplayItem', () => {
  it('maps identity fields correctly', () => {
    const item = makeItem();
    const di = collectionItemToDisplayItem(item);

    expect(di.id).toBe(item.id);
    expect(di.source).toBe('collection');
  });

  it('maps content fields', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.title).toBe('Bizen Osafune Kanemitsu');
    expect(di.item_type).toBe('KATANA');
    expect(di.title_en).toBeNull();
    expect(di.title_ja).toBeNull();
  });

  it('prefers current_value over price_paid for price_value', () => {
    const di = collectionItemToDisplayItem(makeItem({ current_value: 800000, price_paid: 500000 }));
    expect(di.price_value).toBe(800000);
    expect(di.price_currency).toBe('JPY');
  });

  it('falls back to price_paid when current_value is null', () => {
    const item = makeItem();
    item.current_value = null;
    item.current_value_currency = null;
    item.price_paid = 500000;
    item.price_paid_currency = 'USD';
    const di = collectionItemToDisplayItem(item);
    expect(di.price_value).toBe(500000);
    expect(di.price_currency).toBe('USD');
  });

  it('returns null price when both current_value and price_paid are null', () => {
    const item = makeItem();
    item.current_value = null;
    item.current_value_currency = null;
    item.price_paid = null;
    item.price_paid_currency = null;
    const di = collectionItemToDisplayItem(item);
    expect(di.price_value).toBeNull();
    expect(di.price_currency).toBeNull();
  });

  it('sets dealer_display_name from acquired_from', () => {
    const di = collectionItemToDisplayItem(makeItem({ acquired_from: 'Aoi Art' }));
    expect(di.dealer_display_name).toBe('Aoi Art');
  });

  it('uses "Personal Collection" when acquired_from is null', () => {
    const item = makeItem();
    item.acquired_from = null;
    const di = collectionItemToDisplayItem(item);
    expect(di.dealer_display_name).toBe('Personal Collection');
  });

  it('uses "Personal Collection" when acquired_from is empty string', () => {
    const di = collectionItemToDisplayItem(makeItem({ acquired_from: '' }));
    expect(di.dealer_display_name).toBe('Personal Collection');
  });

  it('sets is_initial_import to true (suppresses "New" badge)', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.is_initial_import).toBe(true);
  });

  it('always sets status to available', () => {
    const di = collectionItemToDisplayItem(makeItem({ status: 'sold' }));
    expect(di.status).toBe('available');
    expect(di.is_available).toBe(true);
    expect(di.is_sold).toBe(false);
  });

  it('maps artisan_id and artisan_display_name', () => {
    const di = collectionItemToDisplayItem(makeItem({ artisan_id: 'KAN100', artisan_display_name: 'Kanemitsu' }));
    expect(di.artisan_id).toBe('KAN100');
    expect(di.artisan_display_name).toBe('Kanemitsu');
    expect(di.artisan_confidence).toBe('HIGH');
  });

  it('sets artisan_confidence to null when artisan_id is null', () => {
    const item = makeItem();
    item.artisan_id = null;
    item.artisan_display_name = null;
    const di = collectionItemToDisplayItem(item);
    expect(di.artisan_id).toBeNull();
    expect(di.artisan_display_name).toBeNull();
    expect(di.artisan_confidence).toBeNull();
  });

  it('maps images array when non-empty', () => {
    const di = collectionItemToDisplayItem(makeItem({ images: ['a.jpg', 'b.jpg'] }));
    expect(di.images).toEqual(['a.jpg', 'b.jpg']);
  });

  it('maps empty images array to null', () => {
    const di = collectionItemToDisplayItem(makeItem({ images: [] }));
    expect(di.images).toBeNull();
  });

  it('maps measurement fields', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.nagasa_cm).toBe(72.5);
    expect(di.sori_cm).toBe(1.8);
    expect(di.motohaba_cm).toBe(3.2);
    expect(di.sakihaba_cm).toBe(2.1);
  });

  it('maps attribution fields', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.smith).toBe('兼光');
    expect(di.school).toBe('Bizen');
    expect(di.province).toBe('Bizen');
    expect(di.era).toBe('Nanbokucho');
    expect(di.mei_type).toBe('signed');
    expect(di.tosogu_maker).toBeNull();
    expect(di.tosogu_school).toBeNull();
  });

  it('populates collection extension with all collection-specific fields', () => {
    const di = collectionItemToDisplayItem(makeItem());

    expect(di.collection).not.toBeNull();
    expect(di.collection!.notes).toBe('Beautiful hamon');
    expect(di.collection!.condition).toBe('excellent');
    expect(di.collection!.collection_status).toBe('owned');
    expect(di.collection!.price_paid).toBe(500000);
    expect(di.collection!.price_paid_currency).toBe('JPY');
    expect(di.collection!.current_value).toBe(800000);
    expect(di.collection!.current_value_currency).toBe('JPY');
    expect(di.collection!.acquired_from).toBe('Aoi Art');
    expect(di.collection!.acquired_date).toBe('2024-06-15');
    expect(di.collection!.source_listing_id).toBe(42);
  });

  it('sets browse extension to null', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.browse).toBeNull();
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
    const di = collectionItemToDisplayItem(item);
    expect(di.title).toBeNull();
    expect(di.item_type).toBeNull();
    expect(di.smith).toBeNull();
    expect(di.school).toBeNull();
    expect(di.cert_type).toBeNull();
    expect(di.nagasa_cm).toBeNull();
    expect(di.era).toBeNull();
    expect(di.province).toBeNull();
    expect(di.mei_type).toBeNull();
    expect(di.sori_cm).toBeNull();
    expect(di.motohaba_cm).toBeNull();
    expect(di.sakihaba_cm).toBeNull();
  });

  it('sets first_seen_at from created_at', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.first_seen_at).toBe('2024-06-15T10:00:00Z');
  });

  it('maps description from notes', () => {
    const di = collectionItemToDisplayItem(makeItem({ notes: 'Beautiful hamon with choji' }));
    expect(di.description).toBe('Beautiful hamon with choji');
  });

  it('sets setsumei fields to null/false', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.setsumei_text_en).toBeNull();
    expect(di.has_setsumei).toBe(false);
    expect(di.yuhinkai_enrichment).toBeNull();
  });

  it('sets dealer_id to null (not -1)', () => {
    const di = collectionItemToDisplayItem(makeItem());
    expect(di.dealer_id).toBeNull();
  });
});

describe('collectionItemsToDisplayItems', () => {
  it('returns same-length array', () => {
    const items = [makeItem(), makeItem({ id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff' })];
    const dis = collectionItemsToDisplayItems(items);
    expect(dis).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(collectionItemsToDisplayItems([])).toEqual([]);
  });

  it('preserves item order', () => {
    const a = makeItem({ id: 'aaaa-1111-2222-3333-444444444444', title: 'First' });
    const b = makeItem({ id: 'bbbb-1111-2222-3333-444444444444', title: 'Second' });
    const c = makeItem({ id: 'cccc-1111-2222-3333-444444444444', title: 'Third' });
    const dis = collectionItemsToDisplayItems([a, b, c]);
    expect(dis[0].id).toBe('aaaa-1111-2222-3333-444444444444');
    expect(dis[1].id).toBe('bbbb-1111-2222-3333-444444444444');
    expect(dis[2].id).toBe('cccc-1111-2222-3333-444444444444');
    expect(dis[0].title).toBe('First');
    expect(dis[1].title).toBe('Second');
    expect(dis[2].title).toBe('Third');
  });

  it('all items have source=collection', () => {
    const items = [makeItem(), makeItem({ id: 'bbb' })];
    const dis = collectionItemsToDisplayItems(items);
    dis.forEach(di => expect(di.source).toBe('collection'));
  });
});
