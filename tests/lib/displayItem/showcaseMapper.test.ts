import { describe, it, expect } from 'vitest';
import { showcaseItemToDisplayItem, showcaseItemsToDisplayItems } from '@/lib/displayItem/fromShowcaseItem';
import type { ShowcaseApiRow } from '@/lib/displayItem/fromShowcaseItem';

function makeRow(overrides: Partial<ShowcaseApiRow> = {}): ShowcaseApiRow {
  return {
    id: 'row-1',
    item_uuid: 'uuid-1',
    owner_id: 'owner-1',
    visibility: 'collectors',
    source_listing_id: null,
    personal_notes: null,
    title: 'Test Katana',
    item_type: 'KATANA',
    created_at: '2026-03-10T00:00:00Z',
    profiles: {
      display_name: 'Collector X',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    ...overrides,
  };
}

describe('showcaseItemToDisplayItem', () => {
  it('maps basic fields correctly', () => {
    const row = makeRow();
    const di = showcaseItemToDisplayItem(row);

    expect(di.id).toBe('uuid-1');
    expect(di.source).toBe('showcase');
    expect(di.title).toBe('Test Katana');
    expect(di.item_type).toBe('KATANA');
    expect(di.dealer_display_name).toBe('Society member');
  });

  it('includes showcase extension with anonymous owner', () => {
    const row = makeRow();
    const di = showcaseItemToDisplayItem(row);

    expect(di.showcase).toEqual({
      item_uuid: 'uuid-1',
      visibility: 'collectors',
      owner_display_name: null,
      owner_avatar_url: null,
    });
    expect(di.browse).toBeNull();
    expect(di.collection).toBeNull();
    expect(di.dealer).toBeNull();
  });

  it('strips price for collectors visibility', () => {
    const row = makeRow({
      visibility: 'collectors',
      price_value: 500000,
      price_currency: 'JPY',
    });
    const di = showcaseItemToDisplayItem(row);

    expect(di.price_value).toBeNull();
    expect(di.price_currency).toBeNull();
  });

  it('shows price for dealers visibility', () => {
    const row = makeRow({
      visibility: 'dealers',
      price_value: 500000,
      price_currency: 'JPY',
    });
    const di = showcaseItemToDisplayItem(row);

    expect(di.price_value).toBe(500000);
    expect(di.price_currency).toBe('JPY');
  });

  it('handles null profile gracefully', () => {
    const row = makeRow({ profiles: null });
    const di = showcaseItemToDisplayItem(row);

    expect(di.dealer_display_name).toBe('Society member');
    expect(di.showcase?.owner_display_name).toBeNull();
    expect(di.showcase?.owner_avatar_url).toBeNull();
  });

  it('handles null images correctly', () => {
    const row = makeRow({ images: null });
    const di = showcaseItemToDisplayItem(row);
    expect(di.images).toBeNull();
  });

  it('handles empty images array', () => {
    const row = makeRow({ images: [] });
    const di = showcaseItemToDisplayItem(row);
    expect(di.images).toBeNull();
  });

  it('parses cert_session as number', () => {
    const row = makeRow({ cert_session: '42' });
    const di = showcaseItemToDisplayItem(row);
    expect(di.cert_session).toBe(42);
  });

  it('suppresses New badge via is_initial_import', () => {
    const di = showcaseItemToDisplayItem(makeRow());
    expect(di.is_initial_import).toBe(true);
  });
});

describe('showcaseItemsToDisplayItems', () => {
  it('maps multiple items', () => {
    const rows = [
      makeRow({ item_uuid: 'a', title: 'Item A' }),
      makeRow({ item_uuid: 'b', title: 'Item B' }),
    ];
    const result = showcaseItemsToDisplayItems(rows);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    expect(result[0].source).toBe('showcase');
    expect(result[1].source).toBe('showcase');
  });
});
