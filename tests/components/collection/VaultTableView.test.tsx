import { describe, it, expect, vi } from 'vitest';
import type { DisplayItem, CollectionExtension } from '@/types/displayItem';
import { getAttributionName } from '@/lib/listing/attribution';
import { getItemTypeLabel, CERT_LABELS, formatPrice } from '@/lib/collection/labels';

// =============================================================================
// Unit tests for table view helper logic
// (No DOM rendering — tests the data-layer logic used by VaultTableView)
// =============================================================================

function makeDisplayItem(overrides: Partial<DisplayItem> & { collection?: Partial<CollectionExtension> }): DisplayItem {
  return {
    id: 'test-uuid-1',
    source: 'collection',
    title: 'Test Katana',
    item_type: 'katana',
    price_value: null,
    price_currency: null,
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    cert_type: null,
    nagasa_cm: null,
    images: null,
    status: 'INVENTORY',
    is_available: false,
    is_sold: false,
    first_seen_at: '2026-01-01',
    dealer_display_name: 'Private Collection',
    collection: {
      item_uuid: 'test-uuid-1',
      personal_notes: null,
      visibility: 'private',
      source_listing_id: null,
      purchase_price: null,
      purchase_currency: null,
      purchase_date: null,
      purchase_source: null,
      current_value: null,
      current_currency: null,
      location: null,
      total_invested: null,
    },
    browse: null,
    ...overrides,
    // Merge collection extension deeply
    ...(overrides.collection ? {
      collection: {
        item_uuid: 'test-uuid-1',
        personal_notes: null,
        visibility: 'private',
        source_listing_id: null,
        purchase_price: null,
        purchase_currency: null,
        purchase_date: null,
        purchase_source: null,
        current_value: null,
        current_currency: null,
        location: null,
        total_invested: null,
        ...overrides.collection,
      },
    } : {}),
  } as DisplayItem;
}

describe('Table view data rendering', () => {
  describe('Attribution column', () => {
    it('shows smith for swords', () => {
      const item = makeDisplayItem({ smith: 'Masamune' });
      expect(getAttributionName(item)).toBe('Masamune');
    });

    it('shows tosogu_maker for fittings', () => {
      const item = makeDisplayItem({ tosogu_maker: 'Goto Yujo' });
      expect(getAttributionName(item)).toBe('Goto Yujo');
    });

    it('returns null when no attribution', () => {
      const item = makeDisplayItem({});
      expect(getAttributionName(item)).toBeNull();
    });

    it('prefers smith over tosogu_maker', () => {
      const item = makeDisplayItem({ smith: 'Masamune', tosogu_maker: 'Goto' });
      expect(getAttributionName(item)).toBe('Masamune');
    });
  });

  describe('Type pill', () => {
    it('capitalizes known item types', () => {
      expect(getItemTypeLabel('katana')).toBe('Katana');
      expect(getItemTypeLabel('tsuba')).toBe('Tsuba');
      expect(getItemTypeLabel('wakizashi')).toBe('Wakizashi');
    });

    it('falls back to capitalized raw value for unknown types', () => {
      expect(getItemTypeLabel('mytype')).toBe('Mytype');
    });

    it('returns "Item" for null', () => {
      expect(getItemTypeLabel(null)).toBe('Item');
    });
  });

  describe('Cert badge', () => {
    it('resolves known cert types', () => {
      expect(CERT_LABELS['Juyo']).toBeDefined();
      expect(CERT_LABELS['Juyo']?.shortLabel).toBe('Juyo');
      expect(CERT_LABELS['Juyo']?.tier).toBe('juyo');
    });

    it('resolves Tokubetsu Hozon', () => {
      expect(CERT_LABELS['Tokubetsu Hozon']).toBeDefined();
      expect(CERT_LABELS['Tokubetsu Hozon']?.shortLabel).toBe('Tokuho');
    });

    it('returns undefined for unknown cert type', () => {
      expect(CERT_LABELS['CustomCert']).toBeUndefined();
    });
  });

  describe('Price formatting', () => {
    it('formats JPY correctly', () => {
      const result = formatPrice(5000000, 'JPY');
      expect(result).toContain('5,000,000');
    });

    it('formats USD correctly', () => {
      const result = formatPrice(2500, 'USD');
      expect(result).toContain('2,500');
    });

    it('returns null for null value', () => {
      expect(formatPrice(null, 'JPY')).toBeNull();
    });

    it('returns null for zero value', () => {
      expect(formatPrice(0, 'JPY')).toBeNull();
    });
  });
});

describe('Footer total computation logic', () => {
  it('sums current_value grouped by currency', () => {
    const items = [
      makeDisplayItem({ collection: { current_value: 5000000, current_currency: 'JPY' } }),
      makeDisplayItem({ collection: { current_value: 3000000, current_currency: 'JPY' } }),
      makeDisplayItem({ collection: { current_value: 2500, current_currency: 'USD' } }),
    ];

    const byCurrency = new Map<string, number>();
    for (const item of items) {
      const ext = item.collection;
      if (!ext) continue;
      const val = ext.current_value;
      const cur = ext.current_currency || 'JPY';
      if (val != null && val > 0) {
        byCurrency.set(cur, (byCurrency.get(cur) || 0) + val);
      }
    }

    expect(byCurrency.get('JPY')).toBe(8000000);
    expect(byCurrency.get('USD')).toBe(2500);
  });

  it('skips items with no current_value', () => {
    const items = [
      makeDisplayItem({ collection: { current_value: 1000000, current_currency: 'JPY' } }),
      makeDisplayItem({ collection: { current_value: null, current_currency: null } }),
    ];

    const byCurrency = new Map<string, number>();
    for (const item of items) {
      const ext = item.collection;
      if (!ext) continue;
      const val = ext.current_value;
      const cur = ext.current_currency || 'JPY';
      if (val != null && val > 0) {
        byCurrency.set(cur, (byCurrency.get(cur) || 0) + val);
      }
    }

    expect(byCurrency.get('JPY')).toBe(1000000);
    expect(byCurrency.size).toBe(1);
  });
});

describe('Client-side sorting logic', () => {
  it('sorts by purchase_date with nulls last', () => {
    const items = [
      makeDisplayItem({ id: 'a', collection: { purchase_date: null } }),
      makeDisplayItem({ id: 'b', collection: { purchase_date: '2024-06-15' } }),
      makeDisplayItem({ id: 'c', collection: { purchase_date: '2023-01-01' } }),
    ];

    const sorted = [...items].sort((a, b) => {
      const va = a.collection?.purchase_date ?? null;
      const vb = b.collection?.purchase_date ?? null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return String(va).localeCompare(String(vb));
    });

    expect(sorted[0].id).toBe('c'); // 2023
    expect(sorted[1].id).toBe('b'); // 2024
    expect(sorted[2].id).toBe('a'); // null last
  });

  it('sorts by current_value numerically', () => {
    const items = [
      makeDisplayItem({ id: 'a', collection: { current_value: 3000000 } }),
      makeDisplayItem({ id: 'b', collection: { current_value: 1000000 } }),
      makeDisplayItem({ id: 'c', collection: { current_value: 5000000 } }),
    ];

    const sorted = [...items].sort((a, b) => {
      const va = a.collection?.current_value ?? null;
      const vb = b.collection?.current_value ?? null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va as number) - (vb as number);
    });

    expect(sorted[0].id).toBe('b'); // 1M
    expect(sorted[1].id).toBe('a'); // 3M
    expect(sorted[2].id).toBe('c'); // 5M
  });
});
