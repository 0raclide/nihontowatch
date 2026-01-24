import { describe, it, expect } from 'vitest';
import {
  parseYuhinkaiUrl,
  buildYuhinkaiUrl,
  buildFullYuhinkaiUrl,
  getCollectionDisplayName,
} from '@/lib/yuhinkai/urlParser';

describe('parseYuhinkaiUrl', () => {
  describe('valid URLs', () => {
    it('parses full URL with https', () => {
      const result = parseYuhinkaiUrl('https://yuhinkai.com/item/juyo/68/14936');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Juyo');
        expect(result.data.volume).toBe(68);
        expect(result.data.itemNumber).toBe(14936);
      }
    });

    it('parses full URL with www', () => {
      const result = parseYuhinkaiUrl('https://www.yuhinkai.com/item/tokuju/25/5');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Tokuju');
        expect(result.data.volume).toBe(25);
        expect(result.data.itemNumber).toBe(5);
      }
    });

    it('parses path with leading slash', () => {
      const result = parseYuhinkaiUrl('/item/kokuho/1/100');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Kokuho');
        expect(result.data.volume).toBe(1);
        expect(result.data.itemNumber).toBe(100);
      }
    });

    it('parses path without leading slash', () => {
      const result = parseYuhinkaiUrl('item/juyo/45/7890');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Juyo');
        expect(result.data.volume).toBe(45);
        expect(result.data.itemNumber).toBe(7890);
      }
    });

    it('handles trailing slash', () => {
      const result = parseYuhinkaiUrl('/item/juyo/68/14936/');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Juyo');
      }
    });

    it('handles whitespace around URL', () => {
      const result = parseYuhinkaiUrl('  /item/juyo/68/14936  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Juyo');
      }
    });
  });

  describe('collection parsing', () => {
    it.each([
      ['juyo', 'Juyo'],
      ['JUYO', 'Juyo'],
      ['Juyo', 'Juyo'],
      ['tokuju', 'Tokuju'],
      ['TOKUJU', 'Tokuju'],
      ['kokuho', 'Kokuho'],
      ['jubun', 'JuBun'],
      ['jubi', 'Jubi'],
      ['imp_koto', 'IMP_Koto'],
      ['imp_shin', 'IMP_Shin'],
      ['je_koto', 'JE_Koto'],
    ])('parses collection %s as %s', (input, expected) => {
      const result = parseYuhinkaiUrl(`/item/${input}/1/1`);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe(expected);
      }
    });

    it('rejects invalid collection', () => {
      const result = parseYuhinkaiUrl('/item/invalid/1/1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid collection');
        expect(result.error).toContain('invalid');
      }
    });

    it('rejects hozon (not in Yuhinkai catalog)', () => {
      const result = parseYuhinkaiUrl('/item/hozon/1/1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid collection');
      }
    });
  });

  describe('number parsing', () => {
    it('parses large volume numbers', () => {
      const result = parseYuhinkaiUrl('/item/juyo/999/1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(999);
      }
    });

    it('parses large item numbers', () => {
      const result = parseYuhinkaiUrl('/item/juyo/1/999999');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.itemNumber).toBe(999999);
      }
    });

    it('rejects zero volume', () => {
      const result = parseYuhinkaiUrl('/item/juyo/0/1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Volume must be a positive number');
      }
    });

    it('rejects zero item number', () => {
      const result = parseYuhinkaiUrl('/item/juyo/1/0');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Item number must be a positive number');
      }
    });

    it('rejects negative volume', () => {
      // Negative numbers won't match the regex \d+
      const result = parseYuhinkaiUrl('/item/juyo/-1/1');
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric volume', () => {
      const result = parseYuhinkaiUrl('/item/juyo/abc/1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format');
      }
    });

    it('rejects non-numeric item number', () => {
      const result = parseYuhinkaiUrl('/item/juyo/1/abc');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format');
      }
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      const result = parseYuhinkaiUrl('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('URL is required');
      }
    });

    it('rejects null-like values', () => {
      // @ts-expect-error - testing runtime behavior
      expect(parseYuhinkaiUrl(null).success).toBe(false);
      // @ts-expect-error - testing runtime behavior
      expect(parseYuhinkaiUrl(undefined).success).toBe(false);
    });

    it('rejects missing item number', () => {
      const result = parseYuhinkaiUrl('/item/juyo/68');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format');
      }
    });

    it('rejects missing volume', () => {
      const result = parseYuhinkaiUrl('/item/juyo');
      expect(result.success).toBe(false);
    });

    it('rejects wrong path structure', () => {
      const result = parseYuhinkaiUrl('/items/juyo/68/14936');
      expect(result.success).toBe(false);
    });

    it('rejects extra path segments', () => {
      const result = parseYuhinkaiUrl('/item/juyo/68/14936/extra');
      expect(result.success).toBe(false);
    });

    it('rejects malformed full URL', () => {
      const result = parseYuhinkaiUrl('not://a-valid-url');
      expect(result.success).toBe(false);
    });

    it('rejects URL with query params in path', () => {
      // Query params should be stripped by URL parsing, but path should still be valid
      const result = parseYuhinkaiUrl('https://yuhinkai.com/item/juyo/68/14936?foo=bar');
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles URL with port', () => {
      const result = parseYuhinkaiUrl('https://yuhinkai.com:443/item/juyo/68/14936');
      expect(result.success).toBe(true);
    });

    it('handles http (not https)', () => {
      const result = parseYuhinkaiUrl('http://yuhinkai.com/item/juyo/68/14936');
      expect(result.success).toBe(true);
    });

    it('handles different domain (extracts path only)', () => {
      const result = parseYuhinkaiUrl('https://example.com/item/juyo/68/14936');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBe('Juyo');
      }
    });
  });
});

describe('buildYuhinkaiUrl', () => {
  it('builds correct path', () => {
    const url = buildYuhinkaiUrl({ collection: 'Juyo', volume: 68, itemNumber: 14936 });
    expect(url).toBe('/item/juyo/68/14936');
  });

  it('lowercases collection', () => {
    const url = buildYuhinkaiUrl({ collection: 'Tokuju', volume: 25, itemNumber: 5 });
    expect(url).toBe('/item/tokuju/25/5');
  });

  it('handles special collection names', () => {
    const url = buildYuhinkaiUrl({ collection: 'IMP_Koto', volume: 1, itemNumber: 1 });
    expect(url).toBe('/item/imp_koto/1/1');
  });
});

describe('buildFullYuhinkaiUrl', () => {
  it('builds full URL with domain', () => {
    const url = buildFullYuhinkaiUrl({ collection: 'Juyo', volume: 68, itemNumber: 14936 });
    expect(url).toBe('https://yuhinkai.com/item/juyo/68/14936');
  });
});

describe('getCollectionDisplayName', () => {
  it.each([
    ['Kokuho', 'Kokuho (National Treasure)'],
    ['Tokuju', 'Tokubetsu Juyo'],
    ['Juyo', 'Juyo'],
    ['JuBun', 'Juyo Bijutsuhin'],
    ['IMP_Koto', 'Imperial Collection (Koto)'],
    ['IMP_Shin', 'Imperial Collection (Shinto)'],
  ])('returns display name for %s', (collection, expected) => {
    expect(getCollectionDisplayName(collection)).toBe(expected);
  });

  it('returns input for unknown collection', () => {
    expect(getCollectionDisplayName('Unknown')).toBe('Unknown');
  });
});

describe('roundtrip parsing', () => {
  it('parse → build → parse produces same result', () => {
    const original = '/item/juyo/68/14936';
    const parsed1 = parseYuhinkaiUrl(original);
    expect(parsed1.success).toBe(true);
    if (parsed1.success) {
      const rebuilt = buildYuhinkaiUrl(parsed1.data);
      const parsed2 = parseYuhinkaiUrl(rebuilt);
      expect(parsed2.success).toBe(true);
      if (parsed2.success) {
        expect(parsed2.data).toEqual(parsed1.data);
      }
    }
  });
});
