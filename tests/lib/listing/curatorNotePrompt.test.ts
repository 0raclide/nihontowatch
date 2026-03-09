import { describe, it, expect } from 'vitest';
import { buildUserPrompt, buildSystemPrompt } from '@/lib/listing/curatorNotePrompt';
import type { CuratorNoteContext, ArtistOverview } from '@/lib/listing/curatorNote';

function makeMinimalContext(overrides: Partial<CuratorNoteContext> = {}): CuratorNoteContext {
  return {
    sword: {
      item_type: 'katana',
      nagasa_cm: 70.3,
      sori_cm: 2.1,
      motohaba_cm: 3.2,
      sakihaba_cm: 2.4,
      kasane_cm: 0.7,
      mei_type: 'zaimei',
      mei_text: null,
      era: 'Kamakura',
      province: 'Sagami',
      school: 'Soshu',
      cert_type: 'Juyo',
      cert_session: '32',
      cert_organization: 'NBTHK',
    },
    artisan: {
      code: 'MAS590',
      name_romaji: 'Masamune',
      name_kanji: '正宗',
      school: 'Soshu',
      province: 'Sagami',
      era: 'Kamakura',
      teacher: 'Shintogo Kunimitsu',
      teacher_id: 'KUN539',
      designation_factor: 1.52,
      kokuho_count: 3,
      jubun_count: 2,
      jubi_count: 1,
      gyobutsu_count: 0,
      tokuju_count: 12,
      juyo_count: 35,
      total_items: 53,
      ai_biography_en: null,
    },
    setsumei: { text_en: 'A magnificent blade...', text_ja: '見事な刀...' },
    sayagaki: null,
    hakogaki: null,
    provenance: null,
    kiwame: null,
    koshirae: null,
    research_notes: null,
    artist_overview: null,
    ...overrides,
  };
}

describe('buildUserPrompt — research notes section', () => {
  it('includes research notes section when data present (EN)', () => {
    const ctx = makeMinimalContext({ research_notes: 'Published in Nihonto Taikan vol. 3' });
    const prompt = buildUserPrompt(ctx, 'en');
    expect(prompt).toContain('[RESEARCH NOTES (Collector/Dealer Provided)]');
    expect(prompt).toContain('Published in Nihonto Taikan vol. 3');
    expect(prompt).toContain('unverified information');
  });

  it('includes research notes section when data present (JA)', () => {
    const ctx = makeMinimalContext({ research_notes: '日本刀大観第3巻に掲載' });
    const prompt = buildUserPrompt(ctx, 'ja');
    expect(prompt).toContain('【調査ノート（出品者・所蔵者提供）】');
    expect(prompt).toContain('日本刀大観第3巻に掲載');
    expect(prompt).toContain('独立した検証は行われていません');
  });

  it('omits research notes section when null', () => {
    const ctx = makeMinimalContext({ research_notes: null });
    const prompt = buildUserPrompt(ctx, 'en');
    expect(prompt).not.toContain('[RESEARCH NOTES');
  });
});

describe('buildUserPrompt — artist overview section', () => {
  const overview: ArtistOverview = {
    form_distribution: { katana: 20, tanto: 18, wakizashi: 10, tachi: 5 },
    mei_distribution: { zaimei: 15, mumei: 38 },
    top_students: [
      { name: 'Sadamune', juyo_count: 47, tokuju_count: 12, elite_factor: 1.2 },
      { name: 'Hasebe Kunishige', juyo_count: 20, tokuju_count: 5, elite_factor: 0.8 },
    ],
    school_ancestry: ['Yamato', 'Soshu'],
    elite_percentile: 99.2,
    top_provenance_owners: [
      { name: 'Matsudaira', count: 5 },
      { name: 'Tokugawa', count: 3 },
    ],
  };

  it('includes artist overview section when data present (EN)', () => {
    const ctx = makeMinimalContext({ artist_overview: overview });
    const prompt = buildUserPrompt(ctx, 'en');
    expect(prompt).toContain('[ARTIST STATISTICAL OVERVIEW]');
    expect(prompt).toContain('Form distribution');
    expect(prompt).toContain('katana:');
    expect(prompt).toContain('Mei distribution');
    expect(prompt).toContain('Elite ranking');
    expect(prompt).toContain('School lineage: Yamato → Soshu');
    expect(prompt).toContain('Sadamune');
    expect(prompt).toContain('Matsudaira');
  });

  it('includes artist overview section when data present (JA)', () => {
    const ctx = makeMinimalContext({ artist_overview: overview });
    const prompt = buildUserPrompt(ctx, 'ja');
    expect(prompt).toContain('【作者統計概要】');
    expect(prompt).toContain('形状分布');
    expect(prompt).toContain('銘分布');
    expect(prompt).toContain('指定ランキング');
    expect(prompt).toContain('流派系譜');
    expect(prompt).toContain('門弟');
    expect(prompt).toContain('主要所蔵者');
  });

  it('omits artist overview section when null', () => {
    const ctx = makeMinimalContext({ artist_overview: null });
    const prompt = buildUserPrompt(ctx, 'en');
    expect(prompt).not.toContain('[ARTIST STATISTICAL OVERVIEW]');
  });

  it('renders form distribution as percentages', () => {
    const ctx = makeMinimalContext({ artist_overview: overview });
    const prompt = buildUserPrompt(ctx, 'en');
    // katana: 20/53 ≈ 38%
    expect(prompt).toMatch(/katana: \d+%/);
  });
});

describe('buildSystemPrompt — research notes rule', () => {
  it('includes rule 6 about research notes attribution (EN)', () => {
    const prompt = buildSystemPrompt('en');
    expect(prompt).toContain('Research notes from collectors/dealers are third-party claims');
    expect(prompt).toContain('according to the consignor');
  });

  it('includes rule 6 about research notes attribution (JA)', () => {
    const prompt = buildSystemPrompt('ja');
    expect(prompt).toContain('所蔵者・出品者からの調査ノートは第三者の主張');
  });

  it('includes artist statistical distributions as citeable data (EN)', () => {
    const prompt = buildSystemPrompt('en');
    expect(prompt).toContain('artist statistical distributions');
  });
});
