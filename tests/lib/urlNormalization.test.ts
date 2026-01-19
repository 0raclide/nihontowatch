import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  urlsMatch,
  deduplicateListings,
  countDuplicateGroups,
} from '@/lib/urlNormalization';

describe('normalizeUrl', () => {
  describe('protocol handling', () => {
    it('removes http:// protocol', () => {
      expect(normalizeUrl('http://example.com/page')).toBe('example.com/page');
    });

    it('removes https:// protocol', () => {
      expect(normalizeUrl('https://example.com/page')).toBe('example.com/page');
    });

    it('handles URLs without protocol', () => {
      expect(normalizeUrl('example.com/page')).toBe('example.com/page');
    });
  });

  describe('www prefix handling', () => {
    it('removes www. prefix', () => {
      expect(normalizeUrl('https://www.example.com/page')).toBe(
        'example.com/page'
      );
    });

    it('removes www. prefix with http', () => {
      expect(normalizeUrl('http://www.example.com/page')).toBe(
        'example.com/page'
      );
    });

    it('handles URLs without www', () => {
      expect(normalizeUrl('https://example.com/page')).toBe('example.com/page');
    });
  });

  describe('trailing slash handling', () => {
    it('removes single trailing slash', () => {
      expect(normalizeUrl('https://example.com/page/')).toBe(
        'example.com/page'
      );
    });

    it('removes multiple trailing slashes', () => {
      expect(normalizeUrl('https://example.com/page///')).toBe(
        'example.com/page'
      );
    });

    it('preserves internal slashes', () => {
      expect(normalizeUrl('https://example.com/path/to/page')).toBe(
        'example.com/path/to/page'
      );
    });
  });

  describe('real-world URLs (Nipponto)', () => {
    it('normalizes http Nipponto URL', () => {
      expect(normalizeUrl('http://www.nipponto.co.jp/swords2/KT221624.htm')).toBe(
        'nipponto.co.jp/swords2/KT221624.htm'
      );
    });

    it('normalizes https Nipponto URL', () => {
      expect(normalizeUrl('https://www.nipponto.co.jp/swords2/KT221624.htm')).toBe(
        'nipponto.co.jp/swords2/KT221624.htm'
      );
    });

    it('normalizes http without www Nipponto URL', () => {
      expect(normalizeUrl('http://nipponto.co.jp/swords2/KT221624.htm')).toBe(
        'nipponto.co.jp/swords2/KT221624.htm'
      );
    });

    it('normalizes https without www Nipponto URL', () => {
      expect(normalizeUrl('https://nipponto.co.jp/swords2/KT221624.htm')).toBe(
        'nipponto.co.jp/swords2/KT221624.htm'
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeUrl('')).toBe('');
    });

    it('handles null-like input', () => {
      // TypeScript would prevent null, but test runtime safety
      expect(normalizeUrl(null as unknown as string)).toBe('');
      expect(normalizeUrl(undefined as unknown as string)).toBe('');
    });

    it('handles root URL', () => {
      expect(normalizeUrl('https://example.com/')).toBe('example.com');
    });

    it('handles URL with query string', () => {
      expect(normalizeUrl('https://example.com/page?id=123')).toBe(
        'example.com/page?id=123'
      );
    });

    it('handles URL with hash', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe(
        'example.com/page#section'
      );
    });
  });
});

describe('urlsMatch', () => {
  describe('protocol differences', () => {
    it('matches http and https versions', () => {
      expect(
        urlsMatch(
          'http://nipponto.co.jp/swords2/KT221624.htm',
          'https://nipponto.co.jp/swords2/KT221624.htm'
        )
      ).toBe(true);
    });
  });

  describe('www prefix differences', () => {
    it('matches with and without www', () => {
      expect(
        urlsMatch(
          'https://www.nipponto.co.jp/page',
          'https://nipponto.co.jp/page'
        )
      ).toBe(true);
    });
  });

  describe('combined differences', () => {
    it('matches http+www with https (no www)', () => {
      expect(
        urlsMatch(
          'http://www.nipponto.co.jp/swords2/KT221624.htm',
          'https://nipponto.co.jp/swords2/KT221624.htm'
        )
      ).toBe(true);
    });
  });

  describe('non-matching URLs', () => {
    it('does not match different paths', () => {
      expect(
        urlsMatch(
          'https://nipponto.co.jp/page1',
          'https://nipponto.co.jp/page2'
        )
      ).toBe(false);
    });

    it('does not match different domains', () => {
      expect(
        urlsMatch(
          'https://nipponto.co.jp/page',
          'https://aoijapan.com/page'
        )
      ).toBe(false);
    });

    it('does not match different item IDs', () => {
      expect(
        urlsMatch(
          'https://nipponto.co.jp/swords2/KT221624.htm',
          'https://nipponto.co.jp/swords2/KT221625.htm'
        )
      ).toBe(false);
    });
  });

  describe('trailing slash handling', () => {
    it('matches with and without trailing slash', () => {
      expect(
        urlsMatch(
          'https://example.com/page/',
          'https://example.com/page'
        )
      ).toBe(true);
    });
  });
});

describe('deduplicateListings', () => {
  describe('basic deduplication', () => {
    it('keeps only the oldest listing when duplicates exist', () => {
      const listings = [
        {
          id: 11117,
          url: 'http://nipponto.co.jp/swords2/KT221624.htm',
          first_seen_at: '2026-01-17T12:00:00Z',
        },
        {
          id: 4282,
          url: 'https://nipponto.co.jp/swords2/KT221624.htm',
          first_seen_at: '2026-01-02T08:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4282); // Older one kept
    });

    it('preserves unique listings', () => {
      const listings = [
        {
          id: 1,
          url: 'https://example.com/item1',
          first_seen_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          url: 'https://example.com/item2',
          first_seen_at: '2026-01-02T00:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(2);
    });
  });

  describe('multiple duplicate groups', () => {
    it('handles multiple duplicate groups correctly', () => {
      const listings = [
        {
          id: 1,
          url: 'http://example.com/item1',
          first_seen_at: '2026-01-17T00:00:00Z',
        },
        {
          id: 2,
          url: 'https://example.com/item1',
          first_seen_at: '2026-01-02T00:00:00Z',
        },
        {
          id: 3,
          url: 'http://example.com/item2',
          first_seen_at: '2026-01-15T00:00:00Z',
        },
        {
          id: 4,
          url: 'https://example.com/item2',
          first_seen_at: '2026-01-05T00:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(2);
      expect(result.map((l) => l.id).sort()).toEqual([2, 4]); // Older ones kept
    });
  });

  describe('order independence', () => {
    it('keeps oldest regardless of input order (older first)', () => {
      const listings = [
        {
          id: 4282,
          url: 'https://example.com/item',
          first_seen_at: '2026-01-02T00:00:00Z',
        },
        {
          id: 11117,
          url: 'http://example.com/item',
          first_seen_at: '2026-01-17T00:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4282);
    });

    it('keeps oldest regardless of input order (newer first)', () => {
      const listings = [
        {
          id: 11117,
          url: 'http://example.com/item',
          first_seen_at: '2026-01-17T00:00:00Z',
        },
        {
          id: 4282,
          url: 'https://example.com/item',
          first_seen_at: '2026-01-02T00:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4282);
    });
  });

  describe('null/missing first_seen_at handling', () => {
    it('treats null first_seen_at as infinitely old (keeps listing with date)', () => {
      const listings = [
        { id: 1, url: 'http://example.com/item', first_seen_at: null },
        {
          id: 2,
          url: 'https://example.com/item',
          first_seen_at: '2026-01-02T00:00:00Z',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2); // The one with actual date
    });

    it('handles both null first_seen_at (keeps first encountered)', () => {
      const listings = [
        { id: 1, url: 'http://example.com/item', first_seen_at: null },
        { id: 2, url: 'https://example.com/item', first_seen_at: null },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1); // First one kept when both are null
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      expect(deduplicateListings([])).toEqual([]);
    });

    it('returns empty array for null/undefined input', () => {
      expect(deduplicateListings(null as unknown as [])).toEqual([]);
      expect(deduplicateListings(undefined as unknown as [])).toEqual([]);
    });

    it('handles single listing', () => {
      const listings = [
        { id: 1, url: 'https://example.com/item', first_seen_at: '2026-01-01' },
      ];
      expect(deduplicateListings(listings)).toEqual(listings);
    });

    it('preserves all other properties of the listing', () => {
      const listings = [
        {
          id: 1,
          url: 'http://example.com/item',
          first_seen_at: '2026-01-17',
          title: 'Newer Item',
          price_value: 1000,
        },
        {
          id: 2,
          url: 'https://example.com/item',
          first_seen_at: '2026-01-02',
          title: 'Older Item',
          price_value: 900,
        },
      ];

      const result = deduplicateListings(listings);
      expect(result[0].title).toBe('Older Item');
      expect(result[0].price_value).toBe(900);
    });
  });

  describe('real-world Nipponto scenario', () => {
    it('deduplicates the actual KT221624 case', () => {
      const listings = [
        {
          id: 11117,
          url: 'http://www.nipponto.co.jp/swords2/KT221624.htm',
          first_seen_at: '2026-01-17T12:25:58.720119+00:00',
          title: '日本刀 国行(山城京来派の祖)',
        },
        {
          id: 4282,
          url: 'https://www.nipponto.co.jp/swords2/KT221624.htm',
          first_seen_at: '2026-01-02T08:54:06.810908+00:00',
          title: '国行（山城京来派の祖）',
        },
      ];

      const result = deduplicateListings(listings);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4282);
      expect(result[0].first_seen_at).toBe('2026-01-02T08:54:06.810908+00:00');
    });
  });
});

describe('countDuplicateGroups', () => {
  it('returns 0 for no duplicates', () => {
    const listings = [
      { url: 'https://example.com/item1' },
      { url: 'https://example.com/item2' },
    ];
    expect(countDuplicateGroups(listings)).toBe(0);
  });

  it('returns 1 for a single duplicate pair', () => {
    const listings = [
      { url: 'http://example.com/item' },
      { url: 'https://example.com/item' },
    ];
    expect(countDuplicateGroups(listings)).toBe(1);
  });

  it('returns correct count for multiple duplicate groups', () => {
    const listings = [
      { url: 'http://example.com/item1' },
      { url: 'https://example.com/item1' },
      { url: 'http://example.com/item2' },
      { url: 'https://example.com/item2' },
      { url: 'https://example.com/item3' }, // No duplicate
    ];
    expect(countDuplicateGroups(listings)).toBe(2);
  });

  it('handles triplet duplicates', () => {
    const listings = [
      { url: 'http://example.com/item' },
      { url: 'https://example.com/item' },
      { url: 'http://www.example.com/item' },
    ];
    expect(countDuplicateGroups(listings)).toBe(1); // Still one group
  });

  it('returns 0 for empty array', () => {
    expect(countDuplicateGroups([])).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(countDuplicateGroups(null as unknown as [])).toBe(0);
    expect(countDuplicateGroups(undefined as unknown as [])).toBe(0);
  });
});
