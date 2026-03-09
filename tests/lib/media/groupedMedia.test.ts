import { describe, it, expect } from 'vitest';
import { collectGroupedMedia } from '@/lib/media/groupedMedia';
import type { Listing } from '@/types';

// Minimal listing factory
function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    dealer_id: 1,
    status: 'available',
    is_available: true,
    is_sold: false,
    page_exists: true,
    title: 'Test Katana',
    item_type: 'katana',
    price_currency: 'JPY',
    images: [],
    first_seen_at: '2026-01-01',
    last_scraped_at: '2026-01-01',
    scrape_count: 1,
    ...overrides,
  } as Listing;
}

describe('collectGroupedMedia', () => {
  it('returns only photos group for null listing', () => {
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], null, false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.groups[0].images).toEqual(['a.jpg', 'b.jpg']);
    expect(result.totalCount).toBe(2);
    expect(result.allImageUrls).toEqual(['a.jpg', 'b.jpg']);
  });

  it('returns only photos group when detailLoaded=false', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.allImageUrls).toEqual(['a.jpg']);
  });

  it('returns only photos group when no section data', () => {
    const listing = makeListing();
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
    expect(result.groups).toHaveLength(1);
    expect(result.totalCount).toBe(2);
  });

  it('includes sayagaki images as a separate group', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[1].labelKey).toBe('dealer.sayagaki');
    expect(result.groups[1].images).toEqual(['s1.jpg', 's2.jpg']);
    expect(result.totalCount).toBe(3);
    expect(result.allImageUrls).toEqual(['a.jpg', 's1.jpg', 's2.jpg']);
  });

  it('deduplicates section images that are in primary photos', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['a.jpg', 's1.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
    // 'a.jpg' is in primary, so sayagaki should only have 's1.jpg'
    expect(result.groups).toHaveLength(2);
    expect(result.groups[1].images).toEqual(['s1.jpg']);
    expect(result.totalCount).toBe(3);
  });

  it('deduplicates across sections (cross-section dedup)', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['shared.jpg'] },
      ],
      hakogaki: [
        { id: '2', author: null, content: null, images: ['shared.jpg', 'h1.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    // 'shared.jpg' appears in sayagaki first — hakogaki should only have 'h1.jpg'
    expect(result.groups).toHaveLength(3);
    expect(result.groups[1].labelKey).toBe('dealer.sayagaki');
    expect(result.groups[1].images).toEqual(['shared.jpg']);
    expect(result.groups[2].labelKey).toBe('dealer.hakogaki');
    expect(result.groups[2].images).toEqual(['h1.jpg']);
    expect(result.totalCount).toBe(3);
  });

  it('omits empty sections', () => {
    const listing = makeListing({
      sayagaki: [], // empty array
      hakogaki: [
        { id: '1', author: null, content: null, images: ['h1.jpg'] },
      ],
      koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: [], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    // sayagaki empty → omitted, koshirae.images empty → omitted
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.groups[1].labelKey).toBe('dealer.hakogaki');
  });

  it('handles all section types populated', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      hakogaki: [{ id: '2', author: null, content: null, images: ['h1.jpg'] }],
      koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      provenance: [{ id: '3', owner_name: 'Tokugawa', owner_name_ja: null, notes: null, images: ['p1.jpg'] }],
      kanto_hibisho: { volume: '2', entry_number: '1110', text: null, images: ['kh1.jpg'] },
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups).toHaveLength(6); // photos + 5 sections
    expect(result.groups.map(g => g.labelKey)).toEqual([
      'quickview.sectionPhotos',
      'dealer.sayagaki',
      'dealer.hakogaki',
      'dealer.koshirae',
      'dealer.provenance',
      'dealer.kantoHibisho',
    ]);
    expect(result.totalCount).toBe(6); // 1 photo + 5 section images
    expect(result.allImageUrls).toHaveLength(6);
  });

  it('includes videoCount in totalCount', () => {
    const listing = makeListing();
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, 3);
    expect(result.totalCount).toBe(5); // 2 images + 3 videos
    expect(result.allImageUrls).toHaveLength(2); // videos don't go in allImageUrls
  });

  it('handles multiple sayagaki entries with images', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
        { id: '2', author: 'honma_junji', author_custom: null, content: null, images: ['s3.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups[1].images).toEqual(['s1.jpg', 's2.jpg', 's3.jpg']);
  });

  it('handles empty primary photos with section images', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
    });
    const result = collectGroupedMedia([], listing, true);
    // Photos group always present (even if empty) + sayagaki
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].images).toEqual([]);
    expect(result.groups[1].images).toEqual(['s1.jpg']);
    expect(result.totalCount).toBe(1);
  });

  it('filters out falsy URLs from section images', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['', 's1.jpg', ''] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups[1].images).toEqual(['s1.jpg']);
  });

  it('handles null section fields gracefully', () => {
    const listing = makeListing({
      sayagaki: null,
      hakogaki: null,
      koshirae: null,
      provenance: null,
      kanto_hibisho: null,
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups).toHaveLength(1);
  });

  // =========================================================================
  // flatItems tests
  // =========================================================================

  describe('flatItems', () => {
    it('assigns correct globalIndex across groups', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems).toHaveLength(4);
      expect(result.flatItems.map(i => i.globalIndex)).toEqual([0, 1, 2, 3]);
      expect(result.flatItems.map(i => i.src)).toEqual(['a.jpg', 'b.jpg', 's1.jpg', 's2.jpg']);
    });

    it('marks isFirstInGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems.map(i => i.isFirstInGroup)).toEqual([true, false, true, false]);
    });

    it('marks isFirstGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      expect(result.flatItems[0].isFirstGroup).toBe(true);
      expect(result.flatItems[1].isFirstGroup).toBe(false);
    });

    it('carries correct groupLabelKey', () => {
      const listing = makeListing({
        hakogaki: [{ id: '1', author: null, content: null, images: ['h1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      expect(result.flatItems[0].groupLabelKey).toBe('quickview.sectionPhotos');
      expect(result.flatItems[1].groupLabelKey).toBe('dealer.hakogaki');
    });

    it('returns empty flatItems when no images', () => {
      const result = collectGroupedMedia([], null, false);
      expect(result.flatItems).toEqual([]);
    });

    it('flatItems length matches allImageUrls length', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems).toHaveLength(result.allImageUrls.length);
    });
  });
});
