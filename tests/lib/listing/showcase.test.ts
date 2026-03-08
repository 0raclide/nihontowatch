import { describe, it, expect } from 'vitest';
import { isShowcaseEligible, countRichSections } from '@/lib/listing/showcase';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

// Minimal listing factory
function makeListing(overrides: Partial<EnrichedListingDetail> = {}): EnrichedListingDetail {
  return {
    id: 1,
    url: 'https://example.com/listing/1',
    title: 'Test Listing',
    title_en: null,
    title_ja: null,
    item_type: 'katana',
    item_category: 'nihonto',
    price_value: 1000000,
    price_currency: 'JPY',
    price_jpy: 1000000,
    smith: 'Masamune',
    tosogu_maker: null,
    school: 'Soshu',
    tosogu_school: null,
    cert_type: 'Juyo',
    cert_session: '32',
    cert_organization: 'NBTHK',
    era: 'Kamakura',
    tosogu_era: null,
    province: 'Sagami',
    mei_type: 'zaimei',
    mei_text: null,
    mei_guaranteed: null,
    nagasa_cm: 70.3,
    sori_cm: 2.1,
    motohaba_cm: 3.2,
    sakihaba_cm: 2.4,
    kasane_cm: 0.7,
    weight_g: null,
    tosogu_material: null,
    description: 'A fine katana',
    description_en: null,
    description_ja: null,
    setsumei_image_url: null,
    setsumei_text_en: null,
    setsumei_text_ja: null,
    setsumei_metadata: null,
    setsumei_processed_at: null,
    setsumei_pipeline_version: null,
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg'],
    stored_images: null,
    og_image_url: null,
    first_seen_at: '2026-01-01T00:00:00Z',
    last_scraped_at: '2026-01-01T00:00:00Z',
    status: 'available',
    is_available: true,
    is_sold: false,
    is_initial_import: false,
    admin_hidden: false,
    status_admin_locked: false,
    admin_locked_fields: null,
    dealer_id: 1,
    artisan_id: 'MAS590',
    artisan_confidence: 'HIGH',
    artisan_method: 'kanji',
    artisan_candidates: null,
    artisan_verified: null,
    focal_x: null,
    focal_y: null,
    sayagaki: null,
    hakogaki: null,
    koshirae: null,
    provenance: null,
    kiwame: null,
    kanto_hibisho: null,
    artisan_display_name: 'Masamune',
    dealer_earliest_seen_at: null,
    dealers: { id: 1, name: 'Test Dealer', domain: 'test.com' },
    yuhinkai_enrichment: null,
    videos: [],
    ...overrides,
  };
}

// ============================================================================
// countRichSections
// ============================================================================

describe('countRichSections', () => {
  it('returns 0 for a bare listing', () => {
    expect(countRichSections(makeListing())).toBe(0);
  });

  it('counts setsumei as 1 section', () => {
    expect(countRichSections(makeListing({ setsumei_text_en: 'Translation...' }))).toBe(1);
  });

  it('counts sayagaki as 1 section', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Text', images: [] }],
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('counts provenance as 1 section', () => {
    const listing = makeListing({
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('counts kiwame as 1 section', () => {
    const listing = makeListing({
      kiwame: [{ id: '1', judge_name: "Hon'ami", judge_name_ja: null, kiwame_type: 'origami', notes: null }],
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('counts koshirae with cert as 1 section', () => {
    const listing = makeListing({
      koshirae: {
        cert_type: 'Juyo', cert_in_blade_paper: false, cert_session: 59,
        description: null, images: [], artisan_id: null, artisan_name: null,
        artisan_kanji: null, components: [], setsumei_text_en: null,
        setsumei_text_ja: null, catalog_object_uuid: null,
      },
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('does not count empty koshirae', () => {
    const listing = makeListing({
      koshirae: {
        cert_type: null, cert_in_blade_paper: false, cert_session: null,
        description: null, images: [], artisan_id: null, artisan_name: null,
        artisan_kanji: null, components: [], setsumei_text_en: null,
        setsumei_text_ja: null, catalog_object_uuid: null,
      },
    });
    expect(countRichSections(listing)).toBe(0);
  });

  it('counts video as 1 section', () => {
    const listing = makeListing({
      videos: [{
        id: 'v1', listing_id: 1, provider: 'bunny', provider_id: 'abc',
        status: 'ready' as const, sort_order: 0, created_at: '2026-01-01T00:00:00Z',
        stream_url: 'https://cdn.bunny.net/abc/playlist.m3u8',
      }],
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('counts kanto_hibisho as 1 section', () => {
    const listing = makeListing({
      kanto_hibisho: { volume: '2', entry_number: '1110', text: 'Entry text', images: [] },
    });
    expect(countRichSections(listing)).toBe(1);
  });

  it('counts multiple sections correctly', () => {
    const listing = makeListing({
      setsumei_text_en: 'Translation...',
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Text', images: [] }],
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
      kiwame: [{ id: '1', judge_name: "Hon'ami", judge_name_ja: null, kiwame_type: 'origami', notes: null }],
    });
    expect(countRichSections(listing)).toBe(4);
  });
});

// ============================================================================
// isShowcaseEligible
// ============================================================================

describe('isShowcaseEligible', () => {
  it('returns false for a bare listing (no rich sections)', () => {
    expect(isShowcaseEligible(makeListing())).toBe(false);
  });

  it('returns false when images < 3 even with rich sections', () => {
    const listing = makeListing({
      images: ['img1.jpg', 'img2.jpg'], // Only 2 images
      setsumei_text_en: 'Translation...',
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Text', images: [] }],
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
    });
    expect(isShowcaseEligible(listing)).toBe(false);
  });

  it('returns false when rich sections < 2 even with many images', () => {
    const listing = makeListing({
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'],
      setsumei_text_en: 'Translation...', // Only 1 rich section
    });
    expect(countRichSections(listing)).toBe(1);
    expect(isShowcaseEligible(listing)).toBe(false);
  });

  it('returns true when both thresholds are met', () => {
    const listing = makeListing({
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
      setsumei_text_en: 'Translation...',
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
    });
    expect(isShowcaseEligible(listing)).toBe(true);
  });

  it('returns true when showcase_override is true regardless of content', () => {
    const listing = makeListing({
      images: [], // No images at all
    });
    (listing as any).showcase_override = true;
    expect(isShowcaseEligible(listing)).toBe(true);
  });

  it('returns false when showcase_override is false regardless of content', () => {
    const listing = makeListing({
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg'],
      setsumei_text_en: 'Translation...',
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Text', images: [] }],
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
    });
    (listing as any).showcase_override = false;
    expect(isShowcaseEligible(listing)).toBe(false);
  });

  it('uses auto logic when showcase_override is null', () => {
    const listing = makeListing({
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
      setsumei_text_en: 'Translation...',
      provenance: [{ id: '1', owner_name: 'Lord Tokugawa', owner_name_ja: null, notes: null, images: [] }],
    });
    (listing as any).showcase_override = null;
    expect(isShowcaseEligible(listing)).toBe(true);
  });
});
