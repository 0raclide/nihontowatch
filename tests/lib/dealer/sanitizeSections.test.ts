import { describe, it, expect } from 'vitest';
import {
  sanitizeSayagaki,
  sanitizeHakogaki,
  sanitizeProvenance,
  sanitizeKiwame,
  sanitizeKantoHibisho,
} from '@/lib/dealer/sanitizeSections';

// =============================================================================
// sanitizeSayagaki
// =============================================================================

describe('sanitizeSayagaki', () => {
  it('returns null for non-array input', () => {
    expect(sanitizeSayagaki(null)).toBeNull();
    expect(sanitizeSayagaki(undefined)).toBeNull();
    expect(sanitizeSayagaki('hello')).toBeNull();
    expect(sanitizeSayagaki(42)).toBeNull();
    expect(sanitizeSayagaki({})).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(sanitizeSayagaki([])).toBeNull();
  });

  it('sanitizes valid entries', () => {
    const result = sanitizeSayagaki([{
      id: 'abc-123',
      author: 'tanobe_michihiro',
      author_custom: null,
      content: 'Test content',
      images: ['https://example.com/img.jpg'],
    }]);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('abc-123');
    expect(result![0].author).toBe('tanobe_michihiro');
    expect(result![0].content).toBe('Test content');
    expect(result![0].images).toEqual(['https://example.com/img.jpg']);
  });

  it('defaults invalid author to "other"', () => {
    const result = sanitizeSayagaki([{ author: 'INVALID_AUTHOR' }]);
    expect(result![0].author).toBe('other');
  });

  it('strips blob: URLs from images', () => {
    const result = sanitizeSayagaki([{
      author: 'other',
      images: ['blob:http://localhost/abc', 'https://real.com/img.jpg'],
    }]);
    expect(result![0].images).toEqual(['https://real.com/img.jpg']);
  });

  it('enforces max 5 images per entry', () => {
    const images = Array.from({ length: 8 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = sanitizeSayagaki([{ author: 'other', images }]);
    expect(result![0].images).toHaveLength(5);
  });

  it('enforces max 10 entries', () => {
    const entries = Array.from({ length: 15 }, () => ({ author: 'other' }));
    const result = sanitizeSayagaki(entries);
    expect(result).toHaveLength(10);
  });

  it('trims content and enforces length limit', () => {
    const longContent = 'x'.repeat(6000);
    const result = sanitizeSayagaki([{ author: 'other', content: longContent }]);
    expect(result![0].content).toHaveLength(5000);
  });

  it('generates UUID for entries without id', () => {
    const result = sanitizeSayagaki([{ author: 'honma_junji' }]);
    expect(result![0].id).toBeDefined();
    expect(result![0].id.length).toBeGreaterThan(0);
  });

  it('only preserves author_custom for "other" author', () => {
    const result = sanitizeSayagaki([
      { author: 'other', author_custom: 'Custom person' },
      { author: 'tanobe_michihiro', author_custom: 'Should be dropped' },
    ]);
    expect(result![0].author_custom).toBe('Custom person');
    expect(result![1].author_custom).toBeNull();
  });
});

// =============================================================================
// sanitizeHakogaki
// =============================================================================

describe('sanitizeHakogaki', () => {
  it('returns null for non-array input', () => {
    expect(sanitizeHakogaki(null)).toBeNull();
    expect(sanitizeHakogaki(undefined)).toBeNull();
    expect(sanitizeHakogaki({})).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(sanitizeHakogaki([])).toBeNull();
  });

  it('sanitizes valid entries', () => {
    const result = sanitizeHakogaki([{
      id: 'h-1',
      author: 'Some author',
      content: 'Box inscription text',
      images: ['https://example.com/box.jpg'],
    }]);
    expect(result).toHaveLength(1);
    expect(result![0].author).toBe('Some author');
    expect(result![0].content).toBe('Box inscription text');
  });

  it('strips blob: URLs from images', () => {
    const result = sanitizeHakogaki([{
      images: ['blob:http://localhost/abc', 'https://real.com/img.jpg'],
    }]);
    expect(result![0].images).toEqual(['https://real.com/img.jpg']);
  });

  it('trims author to max length', () => {
    const longAuthor = 'A'.repeat(300);
    const result = sanitizeHakogaki([{ author: longAuthor }]);
    expect(result![0].author).toHaveLength(200);
  });
});

// =============================================================================
// sanitizeProvenance
// =============================================================================

describe('sanitizeProvenance', () => {
  it('returns null for non-array input', () => {
    expect(sanitizeProvenance(null)).toBeNull();
    expect(sanitizeProvenance(42)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(sanitizeProvenance([])).toBeNull();
  });

  it('sanitizes valid entries', () => {
    const result = sanitizeProvenance([{
      id: 'p-1',
      owner_name: 'Tokugawa Ieyasu',
      owner_name_ja: '徳川家康',
      notes: 'Presented as a gift',
      images: ['https://example.com/doc.jpg'],
    }]);
    expect(result).toHaveLength(1);
    expect(result![0].owner_name).toBe('Tokugawa Ieyasu');
    expect(result![0].owner_name_ja).toBe('徳川家康');
    expect(result![0].notes).toBe('Presented as a gift');
  });

  it('defaults owner_name to empty string when missing', () => {
    const result = sanitizeProvenance([{}]);
    expect(result![0].owner_name).toBe('');
  });

  it('enforces max 20 entries', () => {
    const entries = Array.from({ length: 25 }, () => ({ owner_name: 'Test' }));
    const result = sanitizeProvenance(entries);
    expect(result).toHaveLength(20);
  });

  it('strips blob: URLs from images', () => {
    const result = sanitizeProvenance([{
      owner_name: 'Test',
      images: ['blob:x', 'https://real.com/img.jpg', ''],
    }]);
    expect(result![0].images).toEqual(['https://real.com/img.jpg']);
  });
});

// =============================================================================
// sanitizeKiwame
// =============================================================================

describe('sanitizeKiwame', () => {
  it('returns null for non-array input', () => {
    expect(sanitizeKiwame(null)).toBeNull();
    expect(sanitizeKiwame('test')).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(sanitizeKiwame([])).toBeNull();
  });

  it('sanitizes valid entries', () => {
    const result = sanitizeKiwame([{
      id: 'k-1',
      judge_name: 'Hon\'ami Kōtoku',
      judge_name_ja: '本阿弥光徳',
      kiwame_type: 'origami',
      notes: 'Attribution to Masamune',
    }]);
    expect(result).toHaveLength(1);
    expect(result![0].judge_name).toBe('Hon\'ami Kōtoku');
    expect(result![0].kiwame_type).toBe('origami');
  });

  it('defaults invalid kiwame_type to "origami"', () => {
    const result = sanitizeKiwame([{ kiwame_type: 'INVALID' }]);
    expect(result![0].kiwame_type).toBe('origami');
  });

  it('allows all valid kiwame types', () => {
    for (const type of ['origami', 'kinzogan', 'saya_mei', 'other']) {
      const result = sanitizeKiwame([{ kiwame_type: type }]);
      expect(result![0].kiwame_type).toBe(type);
    }
  });

  it('defaults judge_name to empty string when missing', () => {
    const result = sanitizeKiwame([{}]);
    expect(result![0].judge_name).toBe('');
  });

  it('enforces max 10 entries', () => {
    const entries = Array.from({ length: 15 }, () => ({ judge_name: 'Test' }));
    const result = sanitizeKiwame(entries);
    expect(result).toHaveLength(10);
  });
});

// =============================================================================
// sanitizeKantoHibisho
// =============================================================================

describe('sanitizeKantoHibisho', () => {
  it('returns null for falsy input', () => {
    expect(sanitizeKantoHibisho(null)).toBeNull();
    expect(sanitizeKantoHibisho(undefined)).toBeNull();
    expect(sanitizeKantoHibisho('')).toBeNull();
    expect(sanitizeKantoHibisho(0)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(sanitizeKantoHibisho('hello')).toBeNull();
    expect(sanitizeKantoHibisho(42)).toBeNull();
    expect(sanitizeKantoHibisho(true)).toBeNull();
  });

  it('returns null when all fields are empty', () => {
    expect(sanitizeKantoHibisho({})).toBeNull();
    expect(sanitizeKantoHibisho({ volume: '', entry_number: '', text: '', images: [] })).toBeNull();
  });

  it('sanitizes valid input', () => {
    const result = sanitizeKantoHibisho({
      volume: '2',
      entry_number: '1110',
      text: 'Some scholarly commentary',
      images: ['https://example.com/page1.jpg'],
    });
    expect(result).toEqual({
      volume: '2',
      entry_number: '1110',
      text: 'Some scholarly commentary',
      images: ['https://example.com/page1.jpg'],
    });
  });

  it('strips blob: URLs from images', () => {
    const result = sanitizeKantoHibisho({
      volume: '1',
      images: ['blob:http://localhost/abc', 'https://real.com/scan.jpg'],
    });
    expect(result!.images).toEqual(['https://real.com/scan.jpg']);
  });

  it('enforces max 10 images', () => {
    const images = Array.from({ length: 15 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = sanitizeKantoHibisho({ volume: '1', images });
    expect(result!.images).toHaveLength(10);
  });

  it('trims text and enforces length limit', () => {
    const longText = 'x'.repeat(12000);
    const result = sanitizeKantoHibisho({ volume: '1', text: longText });
    expect(result!.text).toHaveLength(10000);
  });

  it('trims whitespace from volume and entry_number', () => {
    const result = sanitizeKantoHibisho({ volume: '  3  ', entry_number: '  42  ' });
    expect(result!.volume).toBe('3');
    expect(result!.entry_number).toBe('42');
  });
});
