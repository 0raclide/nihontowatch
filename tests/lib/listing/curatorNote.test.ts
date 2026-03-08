import { describe, it, expect } from 'vitest';
import {
  assembleCuratorContext,
  computeInputHash,
  shouldSkipGeneration,
  getDataRichness,
} from '@/lib/listing/curatorNote';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';
import type { ArtisanEntity } from '@/lib/supabase/yuhinkai';

// =============================================================================
// FACTORIES
// =============================================================================

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
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
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
    ai_curator_note_en: null,
    ai_curator_note_ja: null,
    artisan_display_name: 'Masamune',
    dealer_earliest_seen_at: null,
    dealers: { id: 1, name: 'Test Dealer', domain: 'test.com' },
    yuhinkai_enrichment: null,
    videos: [],
    ...overrides,
  };
}

function makeArtisanEntity(overrides: Partial<ArtisanEntity> = {}): ArtisanEntity {
  return {
    maker_id: 'MAS590',
    name_kanji: '正宗',
    name_romaji: 'Masamune',
    province: 'Sagami',
    school: 'Soshu',
    era: 'Kamakura',
    period: 'Kamakura late',
    generation: null,
    teacher: 'Shintogo Kunimitsu',
    domain: 'sword',
    entity_type: 'smith',
    is_school_code: false,
    hawley: 6810,
    fujishiro: 'Saijo Owazamono',
    toko_taikan: 44,
    specialties: null,
    kokuho_count: 3,
    jubun_count: 2,
    jubi_count: 1,
    gyobutsu_count: 0,
    tokuju_count: 12,
    juyo_count: 35,
    total_items: 53,
    elite_count: 18,
    elite_factor: 1.52,
    school_code: 'NS-SOSHU',
    school_kanji: '相州',
    school_tradition: 'Soshu-den',
    provenance_factor: 4.5,
    provenance_count: 40,
    provenance_apex: 7.0,
    teacher_id: 'KUN539',
    ...overrides,
  };
}

// =============================================================================
// assembleCuratorContext
// =============================================================================

describe('assembleCuratorContext', () => {
  it('populates all fields for a full-data listing', () => {
    const listing = makeListing({
      setsumei_text_en: 'A magnificent blade...',
      setsumei_text_ja: '見事な刀...',
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: 'Tanobe Michihiro', content: 'A fine work', images: [] },
      ],
      hakogaki: [
        { id: '2', author: 'Honma Junji', content: 'Excellent preservation', images: [] },
      ],
      provenance: [
        { id: '3', owner_name: 'Matsudaira', owner_name_ja: '松平', notes: 'Daimyo collection', images: [] },
      ],
      kiwame: [
        { id: '4', judge_name: "Hon'ami Koson", judge_name_ja: null, kiwame_type: 'origami' as const, notes: 'Confirmed' },
      ],
      koshirae: {
        cert_type: 'Juyo', cert_in_blade_paper: false, cert_session: 59,
        description: 'Fine mountings', images: [], artisan_id: null, artisan_name: 'Goto Ichijo',
        artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null,
      },
    });

    const artisan = makeArtisanEntity();
    const aiDesc = { en: 'Masamune is widely regarded...', ja: null };
    const ctx = assembleCuratorContext(listing, artisan, aiDesc);

    // Sword
    expect(ctx.sword.item_type).toBe('katana');
    expect(ctx.sword.nagasa_cm).toBe(70.3);
    expect(ctx.sword.cert_type).toBe('Juyo');
    expect(ctx.sword.province).toBe('Sagami');

    // Artisan
    expect(ctx.artisan).not.toBeNull();
    expect(ctx.artisan!.code).toBe('MAS590');
    expect(ctx.artisan!.name_romaji).toBe('Masamune');
    expect(ctx.artisan!.designation_factor).toBe(1.52);
    expect(ctx.artisan!.tokuju_count).toBe(12);
    expect(ctx.artisan!.ai_biography_en).toBe('Masamune is widely regarded...');

    // Setsumei
    expect(ctx.setsumei).not.toBeNull();
    expect(ctx.setsumei!.text_en).toBe('A magnificent blade...');

    // Sayagaki
    expect(ctx.sayagaki).toHaveLength(1);
    expect(ctx.sayagaki![0].author).toBe('Tanobe Michihiro');

    // Hakogaki
    expect(ctx.hakogaki).toHaveLength(1);

    // Provenance
    expect(ctx.provenance).toHaveLength(1);
    expect(ctx.provenance![0].owner_name).toBe('Matsudaira');

    // Kiwame
    expect(ctx.kiwame).toHaveLength(1);

    // Koshirae
    expect(ctx.koshirae).not.toBeNull();
    expect(ctx.koshirae!.artisan_name).toBe('Goto Ichijo');
  });

  it('returns null sections for a sparse listing', () => {
    const listing = makeListing({
      artisan_id: null,
    });

    const ctx = assembleCuratorContext(listing, null, null);

    expect(ctx.artisan).toBeNull();
    expect(ctx.setsumei).toBeNull();
    expect(ctx.sayagaki).toBeNull();
    expect(ctx.hakogaki).toBeNull();
    expect(ctx.provenance).toBeNull();
    expect(ctx.kiwame).toBeNull();
    expect(ctx.koshirae).toBeNull();
    // Sword data always present
    expect(ctx.sword.item_type).toBe('katana');
  });

  it('uses tosogu_era when era is null', () => {
    const listing = makeListing({ era: null, tosogu_era: 'Edo' });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(ctx.sword.era).toBe('Edo');
  });

  it('uses tosogu_school when school is null', () => {
    const listing = makeListing({ school: null, tosogu_school: 'Goto' });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(ctx.sword.school).toBe('Goto');
  });

  it('filters out sayagaki entries without content', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Has content', images: [] },
        { id: '2', author: 'other', author_custom: null, content: null, images: [] },
      ],
    });

    const ctx = assembleCuratorContext(listing, null, null);
    expect(ctx.sayagaki).toHaveLength(1);
  });
});

// =============================================================================
// computeInputHash
// =============================================================================

describe('computeInputHash', () => {
  it('produces the same hash for the same input (deterministic)', () => {
    const listing = makeListing({ setsumei_text_en: 'Text' });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);

    const hash1 = computeInputHash(ctx);
    const hash2 = computeInputHash(ctx);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different hashes when cert_type changes', () => {
    const listing1 = makeListing({ cert_type: 'Juyo' });
    const listing2 = makeListing({ cert_type: 'tokubetsu_juyo' });
    const artisan = makeArtisanEntity();

    const ctx1 = assembleCuratorContext(listing1, artisan, null);
    const ctx2 = assembleCuratorContext(listing2, artisan, null);

    expect(computeInputHash(ctx1)).not.toBe(computeInputHash(ctx2));
  });

  it('produces different hashes when artisan changes', () => {
    const listing = makeListing();
    const artisan1 = makeArtisanEntity({ maker_id: 'MAS590' });
    const artisan2 = makeArtisanEntity({ maker_id: 'SAD183' });

    const ctx1 = assembleCuratorContext(listing, artisan1, null);
    const ctx2 = assembleCuratorContext(listing, artisan2, null);

    expect(computeInputHash(ctx1)).not.toBe(computeInputHash(ctx2));
  });
});

// =============================================================================
// shouldSkipGeneration
// =============================================================================

describe('shouldSkipGeneration', () => {
  it('returns true when no artisan and no setsumei', () => {
    const listing = makeListing({ artisan_id: null });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(shouldSkipGeneration(ctx)).toBe(true);
  });

  it('returns false when artisan present but no setsumei', () => {
    const listing = makeListing();
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(shouldSkipGeneration(ctx)).toBe(false);
  });

  it('returns false when setsumei present but no artisan', () => {
    const listing = makeListing({
      artisan_id: null,
      setsumei_text_en: 'A magnificent blade...',
    });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(shouldSkipGeneration(ctx)).toBe(false);
  });

  it('returns false when both artisan and setsumei present', () => {
    const listing = makeListing({ setsumei_text_en: 'Text' });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(shouldSkipGeneration(ctx)).toBe(false);
  });
});

// =============================================================================
// getDataRichness
// =============================================================================

describe('getDataRichness', () => {
  it('returns "full" with setsumei + sayagaki + provenance + artisan', () => {
    const listing = makeListing({
      setsumei_text_en: 'Translation...',
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: 'Text', images: [] }],
      provenance: [{ id: '2', owner_name: 'Matsudaira', owner_name_ja: null, notes: null, images: [] }],
    });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(getDataRichness(ctx)).toBe('full');
  });

  it('returns "moderate" with setsumei + artisan, no sayagaki or provenance', () => {
    const listing = makeListing({ setsumei_text_en: 'Translation...' });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(getDataRichness(ctx)).toBe('moderate');
  });

  it('returns "sparse" with artisan only, no setsumei', () => {
    const listing = makeListing();
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(getDataRichness(ctx)).toBe('sparse');
  });

  it('returns "sparse" with setsumei only, no artisan', () => {
    const listing = makeListing({
      artisan_id: null,
      setsumei_text_en: 'Translation...',
    });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(getDataRichness(ctx)).toBe('sparse');
  });

  it('returns "minimal" with no artisan and no setsumei', () => {
    const listing = makeListing({ artisan_id: null });
    const ctx = assembleCuratorContext(listing, null, null);
    expect(getDataRichness(ctx)).toBe('minimal');
  });

  it('returns "full" with setsumei + hakogaki + artisan (alternative enrichment)', () => {
    const listing = makeListing({
      setsumei_text_en: 'Translation...',
      hakogaki: [{ id: '1', author: 'Expert', content: 'Hakogaki text', images: [] }],
    });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(getDataRichness(ctx)).toBe('full');
  });

  it('returns "full" with setsumei + kiwame + artisan', () => {
    const listing = makeListing({
      setsumei_text_en: 'Translation...',
      kiwame: [{ id: '1', judge_name: "Hon'ami", judge_name_ja: null, kiwame_type: 'origami' as const, notes: null }],
    });
    const artisan = makeArtisanEntity();
    const ctx = assembleCuratorContext(listing, artisan, null);
    expect(getDataRichness(ctx)).toBe('full');
  });
});
