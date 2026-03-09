import { describe, it, expect } from 'vitest';
import { buildContentStream } from '@/lib/media/contentStream';
import type { ContentBlock } from '@/lib/media/contentStream';
import type { Listing } from '@/types';

// ============================================================================
// Helpers
// ============================================================================

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/listing/1',
    title: 'Test Katana',
    item_type: 'katana',
    first_seen_at: '2026-03-01T00:00:00Z',
    last_scraped_at: '2026-03-01T00:00:00Z',
    scrape_count: 1,
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    ...overrides,
  } as Listing;
}

function blockTypes(blocks: ContentBlock[]): string[] {
  return blocks.map(b => b.type);
}

// ============================================================================
// Tests
// ============================================================================

describe('buildContentStream', () => {
  it('returns empty result for null listing', () => {
    const result = buildContentStream(['img1.jpg'], null, true, []);
    expect(result.blocks).toHaveLength(0);
    expect(result.imageCount).toBe(0);
    expect(result.allImageUrls).toHaveLength(0);
    expect(result.sections).toHaveLength(0);
  });

  it('builds hero + photos for listing with no section data', () => {
    const listing = makeListing();
    const result = buildContentStream(['img1.jpg', 'img2.jpg', 'img3.jpg'], listing, true, []);

    expect(blockTypes(result.blocks)).toEqual(['hero_image', 'image', 'image']);
    expect(result.imageCount).toBe(3);
    expect(result.allImageUrls).toEqual(['img1.jpg', 'img2.jpg', 'img3.jpg']);
    expect(result.sections).toHaveLength(0);
  });

  it('includes video blocks after hero', () => {
    const listing = makeListing();
    const videos = [
      { streamUrl: 'video1.m3u8', thumbnailUrl: 'thumb1.jpg', duration: 30, status: 'ready' as const },
    ];
    const result = buildContentStream(['img1.jpg', 'img2.jpg'], listing, true, videos);

    const types = blockTypes(result.blocks);
    expect(types[0]).toBe('hero_image');
    expect(types[1]).toBe('video');
    expect(types[2]).toBe('image');
  });

  it('includes curator note after hero when present', () => {
    const listing = makeListing({
      ai_curator_note_en: 'A fine blade by Masamune.',
      ai_curator_note_ja: '正宗の名刀。',
    });
    const result = buildContentStream(['img1.jpg', 'img2.jpg'], listing, true, []);

    const types = blockTypes(result.blocks);
    expect(types[0]).toBe('hero_image');
    expect(types[1]).toBe('curator_note');
    expect(types[2]).toBe('image');

    const note = result.blocks[1];
    expect(note.type).toBe('curator_note');
    if (note.type === 'curator_note') {
      expect(note.noteEn).toBe('A fine blade by Masamune.');
      expect(note.noteJa).toBe('正宗の名刀。');
    }
  });

  it('builds all section blocks when detailLoaded and data exists', () => {
    const listing = makeListing({
      setsumei_text_en: 'Setsumei text',
      sayagaki: [{ id: 's1', author: 'tanobe_michihiro', content: 'text', images: [] }],
      hakogaki: [{ id: 'h1', author: 'Author', content: 'text', images: [] }],
      provenance: [{ id: 'p1', owner_name: 'Owner', notes: 'notes', images: [] }],
      kiwame: [{ id: 'k1', appraiser: 'Expert', content: 'text' }],
      koshirae: { components: [], images: [] } as any,
      kanto_hibisho: { volume: 1, entry_number: 5, text: 'text', images: [] },
    });
    const result = buildContentStream(['img1.jpg'], listing, true, []);

    const types = blockTypes(result.blocks);
    // Hero + 7 sections (each with divider + block)
    expect(types.filter(t => t === 'section_divider')).toHaveLength(7);
    expect(types).toContain('setsumei');
    expect(types).toContain('sayagaki');
    expect(types).toContain('hakogaki');
    expect(types).toContain('provenance');
    expect(types).toContain('kiwame');
    expect(types).toContain('koshirae');
    expect(types).toContain('kanto_hibisho');

    expect(result.sections).toHaveLength(7);
    expect(result.sections.map(s => s.id)).toEqual([
      'stream-setsumei',
      'stream-sayagaki',
      'stream-hakogaki',
      'stream-provenance',
      'stream-kiwame',
      'stream-koshirae',
      'stream-kanto-hibisho',
    ]);
  });

  it('suppresses section blocks when detailLoaded is false', () => {
    const listing = makeListing({
      setsumei_text_en: 'Setsumei text',
      sayagaki: [{ id: 's1', author: 'tanobe_michihiro', content: 'text', images: [] }],
      koshirae: { components: [], images: ['kosh1.jpg'] } as any,
    });
    const result = buildContentStream(['img1.jpg', 'img2.jpg'], listing, false, []);

    const types = blockTypes(result.blocks);
    expect(types).not.toContain('section_divider');
    expect(types).not.toContain('setsumei');
    expect(types).not.toContain('sayagaki');
    expect(types).not.toContain('koshirae');
    expect(result.sections).toHaveLength(0);
  });

  it('deduplicates section images from photos block', () => {
    const listing = makeListing({
      koshirae: { components: [], images: ['img2.jpg', 'kosh-only.jpg'] } as any,
    });
    // img2.jpg appears in both displayImages and koshirae.images
    const result = buildContentStream(['img1.jpg', 'img2.jpg', 'img3.jpg'], listing, true, []);

    // img2.jpg should be removed from the photos block (it will show in koshirae section)
    const imageBlocks = result.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
    const imageSrcs = imageBlocks.map(b => b.src);
    expect(imageSrcs).not.toContain('img2.jpg');
    expect(imageSrcs).toContain('img3.jpg');

    // allImageUrls should include section images
    expect(result.allImageUrls).toContain('img2.jpg');
    expect(result.allImageUrls).toContain('kosh-only.jpg');
  });

  it('omits empty sections — no orphan dividers', () => {
    const listing = makeListing({
      sayagaki: [], // empty array
      koshirae: null,
      provenance: undefined,
    });
    const result = buildContentStream(['img1.jpg'], listing, true, []);

    const types = blockTypes(result.blocks);
    expect(types).not.toContain('section_divider');
    expect(result.sections).toHaveLength(0);
  });

  it('allImageUrls contains hero + photos + section images in order', () => {
    const listing = makeListing({
      koshirae: { components: [], images: ['kosh1.jpg', 'kosh2.jpg'] } as any,
      sayagaki: [{ id: 's1', author: 'tanobe_michihiro', content: 'text', images: ['say1.jpg'] }],
    });
    const result = buildContentStream(['img1.jpg', 'img2.jpg'], listing, true, []);

    // Hero + remaining photos + section images
    expect(result.allImageUrls[0]).toBe('img1.jpg'); // hero
    expect(result.allImageUrls).toContain('img2.jpg'); // photo
    expect(result.allImageUrls).toContain('say1.jpg'); // sayagaki section
    expect(result.allImageUrls).toContain('kosh1.jpg'); // koshirae section
    expect(result.allImageUrls).toContain('kosh2.jpg');
  });

  it('sections array matches only sections with data', () => {
    const listing = makeListing({
      setsumei_text_en: 'Some text',
      koshirae: { components: [], images: [] } as any,
      // No sayagaki, hakogaki, provenance, kiwame, kanto_hibisho
    });
    const result = buildContentStream(['img1.jpg'], listing, true, []);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].id).toBe('stream-setsumei');
    expect(result.sections[1].id).toBe('stream-koshirae');
  });

  it('handles no images gracefully', () => {
    const listing = makeListing({ setsumei_text_en: 'Text only' });
    const result = buildContentStream([], listing, true, []);

    expect(result.blocks[0]?.type).toBe('section_divider');
    expect(result.imageCount).toBe(0);
  });

  it('globalIndex is sequential across hero, videos, and photos', () => {
    const listing = makeListing();
    const videos = [
      { streamUrl: 'v1.m3u8' },
      { streamUrl: 'v2.m3u8' },
    ];
    const result = buildContentStream(['img1.jpg', 'img2.jpg', 'img3.jpg'], listing, true, videos);

    const indexed = result.blocks.filter(
      (b): b is ContentBlock & { globalIndex: number } => 'globalIndex' in b
    );
    const indices = indexed.map(b => b.globalIndex);
    expect(indices).toEqual([0, 1, 2, 3, 4]); // hero=0, video=1, video=2, photo=3, photo=4
  });
});
