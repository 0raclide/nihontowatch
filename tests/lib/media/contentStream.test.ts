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

    // Find the koshirae divider position
    const koshDividerIdx = result.blocks.findIndex(
      b => b.type === 'section_divider' && (b as any).sectionId === 'stream-koshirae'
    );

    // img2.jpg should NOT appear in the main photos area (before sections)
    const mainPhotoBlocks = result.blocks
      .slice(0, koshDividerIdx)
      .filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
    expect(mainPhotoBlocks.map(b => b.src)).not.toContain('img2.jpg');
    expect(mainPhotoBlocks.map(b => b.src)).toContain('img3.jpg');

    // img2.jpg and kosh-only.jpg appear as full-width image blocks in the koshirae section
    // (non-catalog koshirae images are promoted to full-width)
    const koshImageBlocks = result.blocks
      .slice(koshDividerIdx + 1)
      .filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
    expect(koshImageBlocks.map(b => b.src)).toContain('img2.jpg');
    expect(koshImageBlocks.map(b => b.src)).toContain('kosh-only.jpg');

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

  // ==========================================================================
  // Catalog image classification
  // ==========================================================================

  describe('catalog image classification', () => {
    const CATALOG_BASE = 'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/images/';
    const oshigataUrl = `${CATALOG_BASE}juyo/42/MAS590_oshigata.jpg`;
    const setsumeiUrl = `${CATALOG_BASE}juyo/42/MAS590_setsumei.jpg`;
    const combinedUrl = `${CATALOG_BASE}jubun/5/MIT281_combined.jpg`;

    it('excludes catalog images from photo blocks', () => {
      // Catalog URLs must be in listing.images (the originals) for classification
      const listing = makeListing({
        images: ['hero.jpg', 'photo1.jpg', oshigataUrl, setsumeiUrl, 'photo2.jpg'],
        setsumei_text_en: 'Setsumei text',
      });
      const displayImages = ['hero.jpg', 'photo1.jpg', oshigataUrl, setsumeiUrl, 'photo2.jpg'];
      const result = buildContentStream(displayImages, listing, true, []);

      const imageBlocks = result.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
      const imageSrcs = imageBlocks.map(b => b.src);
      expect(imageSrcs).toContain('photo1.jpg');
      expect(imageSrcs).toContain('photo2.jpg');
      expect(imageSrcs).not.toContain(oshigataUrl);
      expect(imageSrcs).not.toContain(setsumeiUrl);
    });

    it('routes catalog oshigata + setsumei into setsumei block images[]', () => {
      const listing = makeListing({
        images: ['hero.jpg', oshigataUrl, setsumeiUrl, combinedUrl],
        setsumei_text_en: 'Setsumei text',
        setsumei_image_url: 'legacy-scan.jpg',
      });
      const displayImages = ['hero.jpg', oshigataUrl, setsumeiUrl, combinedUrl];
      const result = buildContentStream(displayImages, listing, true, []);

      const setsumeiBlock = result.blocks.find(b => b.type === 'setsumei');
      expect(setsumeiBlock).toBeDefined();
      if (setsumeiBlock?.type === 'setsumei') {
        // setsumei_image_url first, then oshigata (oshigata + combined), then setsumei
        expect(setsumeiBlock.images).toEqual([
          'legacy-scan.jpg',
          oshigataUrl,
          combinedUrl,
          setsumeiUrl,
        ]);
      }
    });

    it('includes setsumei_image_url alongside catalog images', () => {
      const listing = makeListing({
        images: ['hero.jpg', oshigataUrl],
        setsumei_text_en: 'text',
        setsumei_image_url: 'existing-scan.jpg',
      });
      const displayImages = ['hero.jpg', oshigataUrl];
      const result = buildContentStream(displayImages, listing, true, []);

      const setsumeiBlock = result.blocks.find(b => b.type === 'setsumei');
      if (setsumeiBlock?.type === 'setsumei') {
        expect(setsumeiBlock.images[0]).toBe('existing-scan.jpg');
        expect(setsumeiBlock.images[1]).toBe(oshigataUrl);
      }
    });

    it('setsumei block has empty images[] when no catalog images and no setsumei_image_url', () => {
      const listing = makeListing({ setsumei_text_en: 'text only' });
      const result = buildContentStream(['hero.jpg', 'photo.jpg'], listing, true, []);

      const setsumeiBlock = result.blocks.find(b => b.type === 'setsumei');
      if (setsumeiBlock?.type === 'setsumei') {
        expect(setsumeiBlock.images).toEqual([]);
      }
    });

    it('emits non-catalog koshirae photos as full-width image blocks after koshirae divider', () => {
      const koshPhoto1 = 'https://example.com/koshirae-photo-1.jpg';
      const koshPhoto2 = 'https://example.com/koshirae-photo-2.jpg';
      const koshCatalog = `${CATALOG_BASE}juyo/42/KOS001_oshigata.jpg`;

      const listing = makeListing({
        koshirae: {
          components: [],
          images: [koshPhoto1, koshCatalog, koshPhoto2],
        } as any,
      });
      const result = buildContentStream(['hero.jpg'], listing, true, []);

      // Find the koshirae section
      const koshDividerIdx = result.blocks.findIndex(
        b => b.type === 'section_divider' && (b as any).sectionId === 'stream-koshirae'
      );
      expect(koshDividerIdx).toBeGreaterThanOrEqual(0);

      // After divider: full-width image blocks for non-catalog photos, then koshirae block
      const afterDivider = result.blocks.slice(koshDividerIdx + 1);
      expect(afterDivider[0].type).toBe('image');
      expect((afterDivider[0] as any).src).toBe(koshPhoto1);
      expect(afterDivider[1].type).toBe('image');
      expect((afterDivider[1] as any).src).toBe(koshPhoto2);
      expect(afterDivider[2].type).toBe('koshirae');
    });

    it('keeps only catalog images in koshirae block data.images (as thumbnails)', () => {
      const koshPhoto = 'https://example.com/koshirae-photo.jpg';
      const koshCatalog = `${CATALOG_BASE}juyo/42/KOS001_oshigata.jpg`;

      const listing = makeListing({
        koshirae: {
          components: [],
          images: [koshPhoto, koshCatalog],
        } as any,
      });
      // koshCatalog does NOT need to be in displayImages — uses isYuhinkaiCatalogImage() directly
      const result = buildContentStream(['hero.jpg'], listing, true, []);

      const koshBlock = result.blocks.find(b => b.type === 'koshirae');
      expect(koshBlock).toBeDefined();
      if (koshBlock?.type === 'koshirae') {
        expect(koshBlock.data.images).toEqual([koshCatalog]);
        expect(koshBlock.data.images).not.toContain(koshPhoto);
      }
    });

    it('catalog images tracked in allImageUrls for lightbox navigation', () => {
      const listing = makeListing({
        images: ['hero.jpg', 'photo.jpg', oshigataUrl, setsumeiUrl],
        setsumei_text_en: 'text',
      });
      const displayImages = ['hero.jpg', 'photo.jpg', oshigataUrl, setsumeiUrl];
      const result = buildContentStream(displayImages, listing, true, []);

      expect(result.allImageUrls).toContain(oshigataUrl);
      expect(result.allImageUrls).toContain(setsumeiUrl);
    });

    it('does not classify catalog images when detailLoaded is false', () => {
      const listing = makeListing({
        images: ['hero.jpg', oshigataUrl, 'photo.jpg'],
      });
      const displayImages = ['hero.jpg', oshigataUrl, 'photo.jpg'];
      const result = buildContentStream(displayImages, listing, false, []);

      // Catalog images should appear as regular photos when detail not loaded
      const imageBlocks = result.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
      const imageSrcs = imageBlocks.map(b => b.src);
      expect(imageSrcs).toContain(oshigataUrl);
    });

    it('detects catalog images via stored copies (listing-images/ replacing originals)', () => {
      // Simulates getAllImages() replacing catalog originals with stored copies
      const storedOshigata = 'https://example.supabase.co/storage/v1/object/public/listing-images/shop/L90396/00.jpg';
      const storedSetsumei = 'https://example.supabase.co/storage/v1/object/public/listing-images/shop/L90396/01.jpg';

      const listing = makeListing({
        // Original images contain catalog URLs
        images: [oshigataUrl, setsumeiUrl, 'photo1.jpg', 'photo2.jpg'],
        setsumei_text_en: 'Setsumei text',
      });
      // displayImages has stored copies at positions 0 and 1
      const displayImages = [storedOshigata, storedSetsumei, 'photo1.jpg', 'photo2.jpg'];
      const result = buildContentStream(displayImages, listing, true, []);

      // Hero should be photo1.jpg (first non-catalog), NOT the stored oshigata
      const hero = result.blocks.find(b => b.type === 'hero_image');
      expect((hero as any)?.src).toBe('photo1.jpg');

      // Stored copies should NOT appear in photo blocks
      const imageBlocks = result.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
      expect(imageBlocks.map(b => b.src)).not.toContain(storedOshigata);
      expect(imageBlocks.map(b => b.src)).not.toContain(storedSetsumei);

      // Catalog originals should appear in setsumei block
      const setsumeiBlock = result.blocks.find(b => b.type === 'setsumei');
      if (setsumeiBlock?.type === 'setsumei') {
        expect(setsumeiBlock.images).toContain(oshigataUrl);
        expect(setsumeiBlock.images).toContain(setsumeiUrl);
      }
    });

    it('hero skips catalog images and picks first non-catalog photo', () => {
      const listing = makeListing({
        images: [oshigataUrl, setsumeiUrl, 'photo1.jpg', 'photo2.jpg'],
        setsumei_text_en: 'text',
      });
      const displayImages = [oshigataUrl, setsumeiUrl, 'photo1.jpg', 'photo2.jpg'];
      const result = buildContentStream(displayImages, listing, true, []);

      const hero = result.blocks.find(b => b.type === 'hero_image');
      expect((hero as any)?.src).toBe('photo1.jpg');

      // photo1.jpg should only be hero, not also in photo blocks
      const photoBlocks = result.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; src: string }>;
      expect(photoBlocks.map(b => b.src)).not.toContain('photo1.jpg');
      expect(photoBlocks.map(b => b.src)).toContain('photo2.jpg');
    });
  });
});
