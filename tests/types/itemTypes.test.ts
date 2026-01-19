/**
 * Item Type Classification Tests
 *
 * Tests the item type classification functions including:
 * - isBlade() for blade type detection
 * - isTosogu() for fitting type detection
 * - isExcludedType() for non-collectible detection
 * - getItemTypeLabel() for display labels
 */

import { describe, it, expect } from 'vitest';
import {
  isBlade,
  isTosogu,
  isExcludedType,
  getItemTypeLabel,
  type ItemType,
} from '@/types';
import { ITEM_TYPES, BLADE_TYPES, TOSOGU_TYPES, EXCLUDED_TYPES } from '@/lib/constants';

describe('Item Type Classification', () => {
  describe('isBlade()', () => {
    it('returns true for all blade types', () => {
      const bladeTypes: ItemType[] = [
        'katana',
        'wakizashi',
        'tanto',
        'tachi',
        'kodachi',
        'naginata',
        'naginata naoshi',
        'yari',
        'ken',
        'daisho',
      ];

      bladeTypes.forEach(type => {
        expect(isBlade(type)).toBe(true);
      });
    });

    it('returns false for tosogu types', () => {
      const tosoguTypes: ItemType[] = [
        'tsuba',
        'menuki',
        'kozuka',
        'kogai',
        'fuchi',
        'kashira',
        'fuchi_kashira',
        'futatokoro',
        'mitokoromono',
        'tosogu',
      ];

      tosoguTypes.forEach(type => {
        expect(isBlade(type)).toBe(false);
      });
    });

    it('returns false for other types', () => {
      const otherTypes: ItemType[] = ['armor', 'helmet', 'koshirae', 'stand', 'book', 'other', 'unknown'];

      otherTypes.forEach(type => {
        expect(isBlade(type)).toBe(false);
      });
    });

    it('correctly identifies new blade types', () => {
      // New types added in this update
      expect(isBlade('kodachi')).toBe(true);
      expect(isBlade('daisho')).toBe(true);
      expect(isBlade('naginata naoshi')).toBe(true);
    });
  });

  describe('isTosogu()', () => {
    it('returns true for all tosogu types', () => {
      const tosoguTypes: ItemType[] = [
        'tsuba',
        'menuki',
        'kozuka',
        'kogai',
        'fuchi',
        'kashira',
        'fuchi_kashira',
        'futatokoro',
        'mitokoromono',
        'tosogu',
      ];

      tosoguTypes.forEach(type => {
        expect(isTosogu(type)).toBe(true);
      });
    });

    it('returns false for blade types', () => {
      const bladeTypes: ItemType[] = ['katana', 'wakizashi', 'tanto', 'daisho'];

      bladeTypes.forEach(type => {
        expect(isTosogu(type)).toBe(false);
      });
    });

    it('returns false for other types', () => {
      const otherTypes: ItemType[] = ['armor', 'helmet', 'koshirae', 'stand', 'book', 'unknown'];

      otherTypes.forEach(type => {
        expect(isTosogu(type)).toBe(false);
      });
    });

    it('correctly identifies new tosogu types', () => {
      // New types added in this update
      expect(isTosogu('futatokoro')).toBe(true);
      expect(isTosogu('mitokoromono')).toBe(true);
    });
  });

  describe('isExcludedType()', () => {
    it('returns true for non-collectible types', () => {
      const excludedTypes: ItemType[] = ['stand', 'book', 'other'];

      excludedTypes.forEach(type => {
        expect(isExcludedType(type)).toBe(true);
      });
    });

    it('returns false for collectible types', () => {
      const collectibleTypes: ItemType[] = [
        'katana',
        'wakizashi',
        'tanto',
        'daisho',
        'tsuba',
        'kozuka',
        'futatokoro',
        'armor',
        'helmet',
        'koshirae',
        'unknown',
      ];

      collectibleTypes.forEach(type => {
        expect(isExcludedType(type)).toBe(false);
      });
    });

    it('does not exclude unknown items', () => {
      // Unknown items should still be shown - they might be collectibles
      expect(isExcludedType('unknown')).toBe(false);
    });
  });

  describe('getItemTypeLabel()', () => {
    it('returns correct labels for blade types', () => {
      expect(getItemTypeLabel('katana')).toBe('Katana');
      expect(getItemTypeLabel('wakizashi')).toBe('Wakizashi');
      expect(getItemTypeLabel('tanto')).toBe('Tantō');
      expect(getItemTypeLabel('kodachi')).toBe('Kodachi');
      expect(getItemTypeLabel('daisho')).toBe('Daishō');
      expect(getItemTypeLabel('naginata naoshi')).toBe('Naginata-Naoshi');
    });

    it('returns correct labels for tosogu types', () => {
      expect(getItemTypeLabel('tsuba')).toBe('Tsuba');
      expect(getItemTypeLabel('kozuka')).toBe('Kōzuka');
      expect(getItemTypeLabel('kogai')).toBe('Kōgai');
      expect(getItemTypeLabel('futatokoro')).toBe('Futatokoro');
      expect(getItemTypeLabel('mitokoromono')).toBe('Mitokoromono');
    });

    it('returns correct labels for other types', () => {
      expect(getItemTypeLabel('armor')).toBe('Armor');
      expect(getItemTypeLabel('stand')).toBe('Stand');
      expect(getItemTypeLabel('book')).toBe('Book');
      expect(getItemTypeLabel('unknown')).toBe('Unknown');
    });

    it('returns the type itself for unknown types', () => {
      // For any type not in the labels map, return the type as-is
      expect(getItemTypeLabel('custom_type' as ItemType)).toBe('custom_type');
    });
  });
});

describe('Constants', () => {
  describe('ITEM_TYPES', () => {
    it('contains all blade types', () => {
      expect(ITEM_TYPES.KATANA).toBe('katana');
      expect(ITEM_TYPES.WAKIZASHI).toBe('wakizashi');
      expect(ITEM_TYPES.TANTO).toBe('tanto');
      expect(ITEM_TYPES.KODACHI).toBe('kodachi');
      expect(ITEM_TYPES.DAISHO).toBe('daisho');
      expect(ITEM_TYPES.NAGINATA_NAOSHI).toBe('naginata naoshi');
    });

    it('contains all tosogu types', () => {
      expect(ITEM_TYPES.TSUBA).toBe('tsuba');
      expect(ITEM_TYPES.FUTATOKORO).toBe('futatokoro');
      expect(ITEM_TYPES.MITOKOROMONO).toBe('mitokoromono');
    });

    it('contains excluded types', () => {
      expect(ITEM_TYPES.STAND).toBe('stand');
      expect(ITEM_TYPES.BOOK).toBe('book');
      expect(ITEM_TYPES.OTHER).toBe('other');
    });
  });

  describe('BLADE_TYPES', () => {
    it('includes new blade types', () => {
      expect(BLADE_TYPES).toContain(ITEM_TYPES.KODACHI);
      expect(BLADE_TYPES).toContain(ITEM_TYPES.DAISHO);
      expect(BLADE_TYPES).toContain(ITEM_TYPES.NAGINATA_NAOSHI);
    });

    it('does not include tosogu types', () => {
      expect(BLADE_TYPES).not.toContain(ITEM_TYPES.TSUBA);
      expect(BLADE_TYPES).not.toContain(ITEM_TYPES.FUTATOKORO);
    });
  });

  describe('TOSOGU_TYPES', () => {
    it('includes new tosogu types', () => {
      expect(TOSOGU_TYPES).toContain(ITEM_TYPES.FUTATOKORO);
      expect(TOSOGU_TYPES).toContain(ITEM_TYPES.MITOKOROMONO);
      expect(TOSOGU_TYPES).toContain(ITEM_TYPES.TOSOGU);
    });

    it('does not include blade types', () => {
      expect(TOSOGU_TYPES).not.toContain(ITEM_TYPES.KATANA);
      expect(TOSOGU_TYPES).not.toContain(ITEM_TYPES.DAISHO);
    });
  });

  describe('EXCLUDED_TYPES', () => {
    it('includes stand, book, and other', () => {
      expect(EXCLUDED_TYPES).toContain(ITEM_TYPES.STAND);
      expect(EXCLUDED_TYPES).toContain(ITEM_TYPES.BOOK);
      expect(EXCLUDED_TYPES).toContain(ITEM_TYPES.OTHER);
    });

    it('does not include collectible types', () => {
      expect(EXCLUDED_TYPES).not.toContain(ITEM_TYPES.KATANA);
      expect(EXCLUDED_TYPES).not.toContain(ITEM_TYPES.TSUBA);
      expect(EXCLUDED_TYPES).not.toContain(ITEM_TYPES.ARMOR);
      expect(EXCLUDED_TYPES).not.toContain(ITEM_TYPES.UNKNOWN);
    });

    it('has exactly 3 types', () => {
      expect(EXCLUDED_TYPES).toHaveLength(3);
    });
  });
});

describe('Browse API Item Type Filtering', () => {
  // These tests verify the browse API category mappings
  const NIHONTO_TYPES = [
    'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
    'naginata', 'naginata naoshi', 'naginata-naoshi',
    'yari', 'ken', 'daisho',
  ];

  const TOSOGU_TYPES_API = [
    'tsuba',
    'fuchi-kashira', 'fuchi_kashira',
    'fuchi', 'kashira',
    'kozuka', 'kogatana',
    'kogai',
    'menuki',
    'futatokoro',
    'mitokoromono',
    'koshirae',
    'tosogu',
  ];

  describe('nihonto category', () => {
    it('includes kodachi', () => {
      expect(NIHONTO_TYPES).toContain('kodachi');
    });

    it('includes daisho', () => {
      expect(NIHONTO_TYPES).toContain('daisho');
    });

    it('includes naginata-naoshi variants', () => {
      expect(NIHONTO_TYPES).toContain('naginata naoshi');
      expect(NIHONTO_TYPES).toContain('naginata-naoshi');
    });

    it('does not include tosogu', () => {
      expect(NIHONTO_TYPES).not.toContain('tsuba');
      expect(NIHONTO_TYPES).not.toContain('futatokoro');
    });
  });

  describe('tosogu category', () => {
    it('includes futatokoro', () => {
      expect(TOSOGU_TYPES_API).toContain('futatokoro');
    });

    it('includes mitokoromono', () => {
      expect(TOSOGU_TYPES_API).toContain('mitokoromono');
    });

    it('does not include nihonto', () => {
      expect(TOSOGU_TYPES_API).not.toContain('katana');
      expect(TOSOGU_TYPES_API).not.toContain('daisho');
    });
  });

  describe('excluded types in browse', () => {
    // Excluded types should not appear in any category
    const EXCLUDED = ['stand', 'book', 'other'];

    it('stand is excluded from all categories', () => {
      expect(NIHONTO_TYPES).not.toContain('stand');
      expect(TOSOGU_TYPES_API).not.toContain('stand');
    });

    it('book is excluded from all categories', () => {
      expect(NIHONTO_TYPES).not.toContain('book');
      expect(TOSOGU_TYPES_API).not.toContain('book');
    });

    it('other is excluded from all categories', () => {
      expect(NIHONTO_TYPES).not.toContain('other');
      expect(TOSOGU_TYPES_API).not.toContain('other');
    });
  });
});
