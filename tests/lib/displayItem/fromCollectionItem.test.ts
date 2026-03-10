import { describe, it, expect } from 'vitest';
import {
  collectionRowToDisplayItem,
  collectionRowsToDisplayItems,
} from '@/lib/displayItem/fromCollectionItem';
import type { CollectionItemRow } from '@/types/collectionItem';

// =============================================================================
// Fixtures
// =============================================================================

const BASE_ITEM: CollectionItemRow = {
  // Identity
  id: 'pk-aaaa-bbbb-cccc',
  item_uuid: 'uuid-1111-2222-3333',
  owner_id: 'user-123',

  // Collection-only
  visibility: 'private',
  source_listing_id: 42,
  personal_notes: 'Beautiful hamon',

  // Shared fields (ItemDataFields)
  item_type: 'KATANA',
  item_category: 'nihonto',
  title: 'Bizen Osafune Kanemitsu',
  description: 'A fine Nanbokucho period blade',
  status: 'INVENTORY',
  is_available: true,
  is_sold: false,
  price_value: 800000,
  price_currency: 'JPY',

  // Attribution (sword)
  smith: '兼光',
  school: 'Bizen',
  province: 'Bizen',
  era: 'Nanbokucho',
  mei_type: 'signed',
  mei_text: '備前国長船兼光',
  mei_guaranteed: true,
  nakago_type: 'ubu',

  // Tosogu
  tosogu_maker: null,
  tosogu_school: null,
  material: null,
  height_cm: null,
  width_cm: null,
  thickness_mm: null,

  // Certification
  cert_type: 'Juyo',
  cert_session: '55',
  cert_organization: 'NBTHK',

  // Measurements
  nagasa_cm: 72.5,
  sori_cm: 1.8,
  motohaba_cm: 3.2,
  sakihaba_cm: 2.1,
  kasane_cm: 0.68,
  weight_g: 750,
  nakago_cm: 21.5,

  // Media
  images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  stored_images: ['https://stored.example.com/img1.jpg'],

  // Artisan
  artisan_id: 'KAN100',
  artisan_confidence: 'HIGH',

  // JSONB sections
  sayagaki: [{ author: 'Honma Junji', text: 'A masterwork' }] as any,
  hakogaki: null,
  koshirae: { makers: [{ name: 'Test' }] } as any,
  provenance: [{ owner: 'Daimyo' }] as any,
  kiwame: null,
  kanto_hibisho: null,

  // Setsumei
  setsumei_text_en: 'This blade was designated...',
  setsumei_text_ja: 'この刀は...',

  // Translation cache
  title_en: 'Bizen Osafune Kanemitsu EN',
  title_ja: '備前長船兼光',
  description_en: 'Fine blade EN',
  description_ja: '名刀',

  // AI curator
  ai_curator_note_en: 'A remarkable example',
  ai_curator_note_ja: '素晴らしい一振り',

  // Smart crop
  focal_x: 45.5,
  focal_y: 30.2,
  hero_image_index: 1,
  video_count: 2,

  // Timestamps
  created_at: '2024-06-15T10:00:00Z',
  updated_at: '2024-06-20T12:00:00Z',
};

function makeItem(overrides: Partial<CollectionItemRow> = {}): CollectionItemRow {
  return { ...BASE_ITEM, ...overrides };
}

// =============================================================================
// Tests
// =============================================================================

describe('collectionRowToDisplayItem', () => {
  it('maps item_uuid to DisplayItem.id (not PK)', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.id).toBe('uuid-1111-2222-3333');
    // NOT the PK
    expect(di.id).not.toBe('pk-aaaa-bbbb-cccc');
  });

  it('maps source as collection', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.source).toBe('collection');
  });

  it('maps content fields directly', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.title).toBe('Bizen Osafune Kanemitsu');
    expect(di.item_type).toBe('KATANA');
    expect(di.description).toBe('A fine Nanbokucho period blade');
    expect(di.title_en).toBe('Bizen Osafune Kanemitsu EN');
    expect(di.title_ja).toBe('備前長船兼光');
    expect(di.description_en).toBe('Fine blade EN');
    expect(di.description_ja).toBe('名刀');
  });

  it('maps price_value and price_currency directly', () => {
    const di = collectionRowToDisplayItem(makeItem({ price_value: 800000, price_currency: 'JPY' }));
    expect(di.price_value).toBe(800000);
    expect(di.price_currency).toBe('JPY');
  });

  it('returns null price when fields are null', () => {
    const di = collectionRowToDisplayItem(makeItem({ price_value: null, price_currency: null }));
    expect(di.price_value).toBeNull();
    expect(di.price_currency).toBeNull();
  });

  it('maps sword attribution fields', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.smith).toBe('兼光');
    expect(di.school).toBe('Bizen');
    expect(di.province).toBe('Bizen');
    expect(di.era).toBe('Nanbokucho');
    expect(di.mei_type).toBe('signed');
    expect(di.mei_text).toBe('備前国長船兼光');
    expect(di.mei_guaranteed).toBe(true);
  });

  it('maps tosogu attribution fields', () => {
    const di = collectionRowToDisplayItem(makeItem({
      tosogu_maker: 'Goto Ichijo',
      tosogu_school: 'Goto',
    }));
    expect(di.tosogu_maker).toBe('Goto Ichijo');
    expect(di.tosogu_school).toBe('Goto');
  });

  it('converts cert_session TEXT to number', () => {
    const di = collectionRowToDisplayItem(makeItem({ cert_session: '55' }));
    expect(di.cert_session).toBe(55);
  });

  it('handles invalid cert_session string gracefully', () => {
    const di = collectionRowToDisplayItem(makeItem({ cert_session: 'not-a-number' }));
    expect(di.cert_session).toBeNull();
  });

  it('handles null cert_session', () => {
    const di = collectionRowToDisplayItem(makeItem({ cert_session: null }));
    expect(di.cert_session).toBeNull();
  });

  it('handles numeric cert_session', () => {
    const di = collectionRowToDisplayItem(makeItem({ cert_session: 42 }));
    expect(di.cert_session).toBe(42);
  });

  it('maps measurement fields', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.nagasa_cm).toBe(72.5);
    expect(di.sori_cm).toBe(1.8);
    expect(di.motohaba_cm).toBe(3.2);
    expect(di.sakihaba_cm).toBe(2.1);
    expect(di.kasane_cm).toBe(0.68);
    expect(di.weight_g).toBe(750);
  });

  it('maps images when non-empty', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.images).toEqual(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
  });

  it('maps empty images to null', () => {
    const di = collectionRowToDisplayItem(makeItem({ images: [] }));
    expect(di.images).toBeNull();
  });

  it('maps stored_images', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.stored_images).toEqual(['https://stored.example.com/img1.jpg']);
  });

  it('maps focal point and hero image', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.focal_x).toBe(45.5);
    expect(di.focal_y).toBe(30.2);
    expect(di.hero_image_index).toBe(1);
  });

  it('maps video_count', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.video_count).toBe(2);
  });

  it('maps artisan fields', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.artisan_id).toBe('KAN100');
    expect(di.artisan_confidence).toBe('HIGH');
    // Display name is not in CollectionItemRow — stays null
    expect(di.artisan_display_name).toBeNull();
  });

  it('suppresses "New" badge via is_initial_import', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.is_initial_import).toBe(true);
  });

  it('sets first_seen_at from created_at', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.first_seen_at).toBe('2024-06-15T10:00:00Z');
  });

  it('always sets dealer_display_name to "Personal Collection"', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.dealer_display_name).toBe('Personal Collection');
  });

  it('derives has_setsumei from setsumei_text_en', () => {
    const di = collectionRowToDisplayItem(makeItem({ setsumei_text_en: 'Text', setsumei_text_ja: null }));
    expect(di.has_setsumei).toBe(true);
  });

  it('derives has_setsumei from setsumei_text_ja', () => {
    const di = collectionRowToDisplayItem(makeItem({ setsumei_text_en: null, setsumei_text_ja: 'テキスト' }));
    expect(di.has_setsumei).toBe(true);
  });

  it('has_setsumei is false when both are null', () => {
    const di = collectionRowToDisplayItem(makeItem({ setsumei_text_en: null, setsumei_text_ja: null }));
    expect(di.has_setsumei).toBe(false);
  });

  it('uses item status or defaults to INVENTORY', () => {
    const di1 = collectionRowToDisplayItem(makeItem({ status: 'SOLD' }));
    expect(di1.status).toBe('SOLD');

    const di2 = collectionRowToDisplayItem(makeItem({ status: '' }));
    expect(di2.status).toBe('INVENTORY');
  });

  it('populates collection extension with Phase 2a fields', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.collection).not.toBeNull();
    expect(di.collection!.item_uuid).toBe('uuid-1111-2222-3333');
    expect(di.collection!.personal_notes).toBe('Beautiful hamon');
    expect(di.collection!.visibility).toBe('private');
    expect(di.collection!.source_listing_id).toBe(42);
  });

  it('sets browse and dealer extensions to null', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.browse).toBeNull();
    expect(di.dealer).toBeNull();
  });

  it('sets dealer_id to null', () => {
    const di = collectionRowToDisplayItem(makeItem());
    expect(di.dealer_id).toBeNull();
  });

  it('handles all-null nullable fields gracefully', () => {
    const item = makeItem({
      title: null,
      item_type: null,
      description: null,
      smith: null,
      school: null,
      province: null,
      era: null,
      mei_type: null,
      mei_text: null,
      nagasa_cm: null,
      sori_cm: null,
      motohaba_cm: null,
      sakihaba_cm: null,
      kasane_cm: null,
      weight_g: null,
      cert_type: null,
      cert_session: null,
      cert_organization: null,
      artisan_id: null,
      artisan_confidence: null,
      personal_notes: null,
      source_listing_id: null,
    });
    const di = collectionRowToDisplayItem(item);
    expect(di.title).toBeNull();
    expect(di.item_type).toBeNull();
    expect(di.smith).toBeNull();
    expect(di.cert_type).toBeNull();
    expect(di.artisan_id).toBeNull();
    expect(di.collection!.personal_notes).toBeNull();
    expect(di.collection!.source_listing_id).toBeNull();
  });
});

describe('collectionRowsToDisplayItems (batch)', () => {
  it('returns same-length array', () => {
    const items = [
      makeItem({ item_uuid: 'aaa' }),
      makeItem({ item_uuid: 'bbb' }),
    ];
    const dis = collectionRowsToDisplayItems(items);
    expect(dis).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(collectionRowsToDisplayItems([])).toEqual([]);
  });

  it('preserves item order', () => {
    const a = makeItem({ item_uuid: 'first', title: 'First' });
    const b = makeItem({ item_uuid: 'second', title: 'Second' });
    const c = makeItem({ item_uuid: 'third', title: 'Third' });
    const dis = collectionRowsToDisplayItems([a, b, c]);
    expect(dis[0].id).toBe('first');
    expect(dis[1].id).toBe('second');
    expect(dis[2].id).toBe('third');
    expect(dis[0].title).toBe('First');
    expect(dis[1].title).toBe('Second');
    expect(dis[2].title).toBe('Third');
  });

  it('all items have source=collection', () => {
    const items = [makeItem({ item_uuid: 'a' }), makeItem({ item_uuid: 'b' })];
    const dis = collectionRowsToDisplayItems(items);
    dis.forEach(di => expect(di.source).toBe('collection'));
  });
});


