import { describe, it, expect } from 'vitest';
import {
  parseNumericFilters,
  isNumericFilter,
  getSupportedFieldAliases,
  getFieldForAlias,
} from '@/lib/search/numericFilters';

describe('parseNumericFilters', () => {
  describe('nagasa filters', () => {
    it('parses nagasa>70 correctly', () => {
      const result = parseNumericFilters('nagasa>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses cm>70 correctly (alias for nagasa_cm)', () => {
      const result = parseNumericFilters('cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses length>70 correctly (alias for nagasa_cm)', () => {
      const result = parseNumericFilters('length>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses nagasa<65 correctly', () => {
      const result = parseNumericFilters('nagasa<65');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'lt', value: 65 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses nagasa>=72 correctly', () => {
      const result = parseNumericFilters('nagasa>=72');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gte', value: 72 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses nagasa<=60 correctly', () => {
      const result = parseNumericFilters('nagasa<=60');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'lte', value: 60 });
      expect(result.textWords).toHaveLength(0);
    });
  });

  describe('price filters', () => {
    it('parses price>100000 correctly', () => {
      const result = parseNumericFilters('price>100000');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'gt', value: 100000 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses yen<500000 correctly (alias for price_value)', () => {
      const result = parseNumericFilters('yen<500000');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'lt', value: 500000 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses jpy>=1000000 correctly (alias for price_value)', () => {
      const result = parseNumericFilters('jpy>=1000000');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'gte', value: 1000000 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses price<=250000 correctly', () => {
      const result = parseNumericFilters('price<=250000');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'lte', value: 250000 });
      expect(result.textWords).toHaveLength(0);
    });
  });

  describe('mixed queries (text + filters)', () => {
    it('extracts filter and text from "bizen cm>70"', () => {
      const result = parseNumericFilters('bizen cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toEqual(['bizen']);
    });

    it('extracts filter and text from "soshu katana nagasa>=72"', () => {
      const result = parseNumericFilters('soshu katana nagasa>=72');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gte', value: 72 });
      expect(result.textWords).toEqual(['soshu', 'katana']);
    });

    it('handles filter in the middle of query', () => {
      const result = parseNumericFilters('juyo price>500000 tanto');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'gt', value: 500000 });
      expect(result.textWords).toEqual(['juyo', 'tanto']);
    });

    it('handles filter at the start of query', () => {
      const result = parseNumericFilters('cm<65 wakizashi');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'lt', value: 65 });
      expect(result.textWords).toEqual(['wakizashi']);
    });
  });

  describe('multiple filters', () => {
    it('parses "katana cm>70 price<500000" with two filters', () => {
      const result = parseNumericFilters('katana cm>70 price<500000');
      expect(result.filters).toHaveLength(2);
      expect(result.filters).toContainEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.filters).toContainEqual({ field: 'price_value', op: 'lt', value: 500000 });
      expect(result.textWords).toEqual(['katana']);
    });

    it('parses multiple nagasa filters', () => {
      const result = parseNumericFilters('nagasa>65 nagasa<80');
      expect(result.filters).toHaveLength(2);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 65 });
      expect(result.filters[1]).toEqual({ field: 'nagasa_cm', op: 'lt', value: 80 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses three filters with text', () => {
      const result = parseNumericFilters('bizen cm>=70 cm<=80 price<1000000');
      expect(result.filters).toHaveLength(3);
      expect(result.filters).toContainEqual({ field: 'nagasa_cm', op: 'gte', value: 70 });
      expect(result.filters).toContainEqual({ field: 'nagasa_cm', op: 'lte', value: 80 });
      expect(result.filters).toContainEqual({ field: 'price_value', op: 'lt', value: 1000000 });
      expect(result.textWords).toEqual(['bizen']);
    });
  });

  describe('no filters (text only)', () => {
    it('returns empty filters for "juyo katana"', () => {
      const result = parseNumericFilters('juyo katana');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['juyo', 'katana']);
    });

    it('returns empty filters for "soshu masamune"', () => {
      const result = parseNumericFilters('soshu masamune');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['soshu', 'masamune']);
    });

    it('returns empty filters for single word', () => {
      const result = parseNumericFilters('katana');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['katana']);
    });

    it('returns empty filters for empty string', () => {
      const result = parseNumericFilters('');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toHaveLength(0);
    });

    it('returns empty filters for whitespace only', () => {
      const result = parseNumericFilters('   ');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toHaveLength(0);
    });
  });

  describe('edge cases - invalid operators', () => {
    it('treats "nagasa=70" as text (= is not a valid operator)', () => {
      const result = parseNumericFilters('nagasa=70');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa=70']);
    });

    it('treats "cm>>70" as text (invalid operator)', () => {
      const result = parseNumericFilters('cm>>70');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['cm>>70']);
    });

    it('treats "price<>100000" as text (invalid operator)', () => {
      const result = parseNumericFilters('price<>100000');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['price<>100000']);
    });

    it('treats "nagasa=>70" as text (wrong order for >=)', () => {
      const result = parseNumericFilters('nagasa=>70');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa=>70']);
    });

    it('treats "nagasa=<70" as text (wrong order for <=)', () => {
      const result = parseNumericFilters('nagasa=<70');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa=<70']);
    });
  });

  describe('edge cases - non-numeric values', () => {
    it('treats "nagasa>abc" as text', () => {
      const result = parseNumericFilters('nagasa>abc');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa>abc']);
    });

    it('treats "price<expensive" as text', () => {
      const result = parseNumericFilters('price<expensive');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['price<expensive']);
    });

    it('treats "cm>" as text (missing value)', () => {
      const result = parseNumericFilters('cm>');
      // cm> is less than 2 chars after potential split, or might not match pattern
      expect(result.filters).toHaveLength(0);
    });

    it('treats "nagasa>" as text (missing value)', () => {
      const result = parseNumericFilters('nagasa>');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa>']);
    });
  });

  describe('edge cases - unknown field aliases', () => {
    it('treats "width>10" as text (width not a supported alias)', () => {
      const result = parseNumericFilters('width>10');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['width>10']);
    });

    it('treats "sori>1" as text (sori not a supported alias)', () => {
      const result = parseNumericFilters('sori>1');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['sori>1']);
    });

    it('treats "weight>500" as text (weight not a supported alias)', () => {
      const result = parseNumericFilters('weight>500');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['weight>500']);
    });

    it('treats "usd>100" as text (usd not a supported alias)', () => {
      const result = parseNumericFilters('usd>100');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['usd>100']);
    });
  });

  describe('decimal values', () => {
    it('parses cm>70.5 correctly', () => {
      const result = parseNumericFilters('cm>70.5');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70.5 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses nagasa>=72.25 correctly', () => {
      const result = parseNumericFilters('nagasa>=72.25');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gte', value: 72.25 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses price<500000.99 correctly', () => {
      const result = parseNumericFilters('price<500000.99');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'lt', value: 500000.99 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses length<=60.1 correctly', () => {
      const result = parseNumericFilters('length<=60.1');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'lte', value: 60.1 });
      expect(result.textWords).toHaveLength(0);
    });
  });

  describe('boundary values', () => {
    it('parses nagasa>0 correctly', () => {
      const result = parseNumericFilters('nagasa>0');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 0 });
      expect(result.textWords).toHaveLength(0);
    });

    it('parses price>=0 correctly', () => {
      const result = parseNumericFilters('price>=0');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'gte', value: 0 });
      expect(result.textWords).toHaveLength(0);
    });

    it('handles very large numbers', () => {
      const result = parseNumericFilters('price<999999999999');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'lt', value: 999999999999 });
      expect(result.textWords).toHaveLength(0);
    });

    it('handles small decimal values', () => {
      const result = parseNumericFilters('nagasa>0.1');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 0.1 });
      expect(result.textWords).toHaveLength(0);
    });

    it('treats negative numbers as text (no negative support in pattern)', () => {
      const result = parseNumericFilters('nagasa>-10');
      expect(result.filters).toHaveLength(0);
      expect(result.textWords).toEqual(['nagasa>-10']);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase NAGASA>70', () => {
      const result = parseNumericFilters('NAGASA>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
    });

    it('handles mixed case CM>70', () => {
      const result = parseNumericFilters('Cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
    });

    it('handles uppercase PRICE<500000', () => {
      const result = parseNumericFilters('PRICE<500000');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'price_value', op: 'lt', value: 500000 });
    });

    it('handles mixed case text with filter', () => {
      const result = parseNumericFilters('BIZEN Cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toEqual(['bizen']);
    });
  });

  describe('whitespace handling', () => {
    it('handles multiple spaces between words', () => {
      const result = parseNumericFilters('bizen    cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(result.textWords).toEqual(['bizen']);
    });

    it('handles leading whitespace', () => {
      const result = parseNumericFilters('   nagasa>70');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
    });

    it('handles trailing whitespace', () => {
      const result = parseNumericFilters('nagasa>70   ');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
    });

    it('handles tabs and mixed whitespace', () => {
      const result = parseNumericFilters('katana\t\tcm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.textWords).toEqual(['katana']);
    });
  });

  describe('short word filtering', () => {
    it('filters out single character words', () => {
      const result = parseNumericFilters('a b cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.textWords).toHaveLength(0);
    });

    it('keeps words with 2+ characters', () => {
      const result = parseNumericFilters('ab cd cm>70');
      expect(result.filters).toHaveLength(1);
      expect(result.textWords).toEqual(['ab', 'cd']);
    });
  });
});

describe('isNumericFilter', () => {
  it('returns true for valid numeric filters', () => {
    expect(isNumericFilter('nagasa>70')).toBe(true);
    expect(isNumericFilter('cm<65')).toBe(true);
    expect(isNumericFilter('price>=100000')).toBe(true);
    expect(isNumericFilter('jpy<=500000')).toBe(true);
  });

  it('returns false for regular text', () => {
    expect(isNumericFilter('katana')).toBe(false);
    expect(isNumericFilter('bizen')).toBe(false);
    expect(isNumericFilter('juyo')).toBe(false);
  });

  it('returns false for invalid patterns', () => {
    expect(isNumericFilter('nagasa=70')).toBe(false);
    expect(isNumericFilter('width>10')).toBe(false);
    expect(isNumericFilter('nagasa>abc')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isNumericFilter('NAGASA>70')).toBe(true);
    expect(isNumericFilter('Cm<65')).toBe(true);
  });
});

describe('getSupportedFieldAliases', () => {
  it('returns all supported aliases', () => {
    const aliases = getSupportedFieldAliases();
    expect(aliases).toContain('nagasa');
    expect(aliases).toContain('cm');
    expect(aliases).toContain('length');
    expect(aliases).toContain('price');
    expect(aliases).toContain('yen');
    expect(aliases).toContain('jpy');
  });

  it('returns exactly 6 aliases', () => {
    const aliases = getSupportedFieldAliases();
    expect(aliases).toHaveLength(6);
  });
});

describe('getFieldForAlias', () => {
  it('returns nagasa_cm for length aliases', () => {
    expect(getFieldForAlias('nagasa')).toBe('nagasa_cm');
    expect(getFieldForAlias('cm')).toBe('nagasa_cm');
    expect(getFieldForAlias('length')).toBe('nagasa_cm');
  });

  it('returns price_value for price aliases', () => {
    expect(getFieldForAlias('price')).toBe('price_value');
    expect(getFieldForAlias('yen')).toBe('price_value');
    expect(getFieldForAlias('jpy')).toBe('price_value');
  });

  it('returns undefined for unknown aliases', () => {
    expect(getFieldForAlias('width')).toBeUndefined();
    expect(getFieldForAlias('sori')).toBeUndefined();
    expect(getFieldForAlias('unknown')).toBeUndefined();
  });

  it('is case insensitive', () => {
    expect(getFieldForAlias('NAGASA')).toBe('nagasa_cm');
    expect(getFieldForAlias('CM')).toBe('nagasa_cm');
    expect(getFieldForAlias('Price')).toBe('price_value');
  });
});
