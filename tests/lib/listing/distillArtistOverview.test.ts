import { describe, it, expect } from 'vitest';
import { distillArtistOverview } from '@/lib/listing/distillArtistOverview';
import type { ArtisanPageResponse } from '@/types/artisan';

function makePageData(overrides: Partial<ArtisanPageResponse> = {}): ArtisanPageResponse {
  return {
    entity: {
      code: 'MAS590',
      name_romaji: 'Masamune',
      name_kanji: '正宗',
      school: 'Soshu',
      school_code: 'NS-SOSHU',
      school_kanji: '相州',
      school_tradition: 'Soshu-den',
      province: 'Sagami',
      era: 'Kamakura',
      period: 'Kamakura late',
      generation: null,
      teacher: 'Shintogo Kunimitsu',
      entity_type: 'smith',
      is_school_code: false,
      slug: 'masamune-MAS590',
      fujishiro: 'Saijo Owazamono',
      toko_taikan: 44,
      specialties: null,
    },
    certifications: {
      kokuho_count: 3,
      jubun_count: 2,
      jubi_count: 1,
      gyobutsu_count: 0,
      tokuju_count: 12,
      juyo_count: 35,
      total_items: 53,
      elite_count: 18,
      elite_factor: 1.52,
    },
    rankings: {
      elite_percentile: 99.2,
      toko_taikan_percentile: 95.0,
      provenance_percentile: 98.0,
    },
    provenance: { factor: 4.5, count: 40, apex: 7.0 },
    profile: null,
    stats: {
      mei_distribution: { 'zaimei': 15, 'mumei': 38 },
      form_distribution: { 'katana': 20, 'tanto': 18, 'wakizashi': 10, 'tachi': 5 },
      measurements_by_form: {},
    },
    lineage: {
      teacher: { code: 'KUN539', name_romaji: 'Shintogo Kunimitsu', slug: 'shintogo-kunimitsu-KUN539' },
      students: [
        {
          code: 'SAD183', name_romaji: 'Sadamune', name_kanji: '貞宗', slug: 'sadamune-SAD183',
          school: 'Soshu', kokuho_count: 1, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
          juyo_count: 47, tokuju_count: 12, elite_factor: 1.2,
        },
        {
          code: 'HAS123', name_romaji: 'Hasebe Kunishige', name_kanji: '長谷部国重', slug: 'hasebe-kunishige-HAS123',
          school: 'Soshu', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
          juyo_count: 20, tokuju_count: 5, elite_factor: 0.8,
        },
        {
          code: 'HIR456', name_romaji: 'Hiromitsu', name_kanji: '広光', slug: 'hiromitsu-HIR456',
          school: 'Soshu', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
          juyo_count: 10, tokuju_count: 2, elite_factor: 0.5,
        },
      ],
    },
    related: [],
    denrai: [{ owner: 'Matsudaira', count: 5 }],
    denraiGrouped: [
      { parent: 'Matsudaira', parent_ja: '松平', totalCount: 5, children: [], isGroup: false },
      { parent: 'Tokugawa', parent_ja: '徳川', totalCount: 3, children: [], isGroup: false },
      { parent: 'Shimazu', parent_ja: '島津', totalCount: 2, children: [], isGroup: false },
    ],
    schoolAncestry: [
      { code: 'NS-YAMATO', name_romaji: 'Yamato', name_kanji: '大和' },
      { code: 'NS-SOSHU', name_romaji: 'Soshu', name_kanji: '相州' },
    ],
    heroImage: null,
    ...overrides,
  };
}

describe('distillArtistOverview', () => {
  it('distills full page data into compact overview', () => {
    const result = distillArtistOverview(makePageData());
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ katana: 20, tanto: 18, wakizashi: 10, tachi: 5 });
    expect(result!.mei_distribution).toEqual({ zaimei: 15, mumei: 38 });
    expect(result!.elite_percentile).toBe(99.2);
    expect(result!.school_ancestry).toEqual(['Yamato', 'Soshu']);
    expect(result!.top_students).toHaveLength(3);
    expect(result!.top_students[0].name).toBe('Sadamune');
    expect(result!.top_provenance_owners).toHaveLength(3);
    expect(result!.top_provenance_owners[0]).toEqual({ name: 'Matsudaira', count: 5 });
  });

  it('returns null when no meaningful supplementary data', () => {
    const result = distillArtistOverview(makePageData({
      stats: null,
      lineage: { teacher: null, students: [] },
      denraiGrouped: [],
      schoolAncestry: [],
    }));
    expect(result).toBeNull();
  });

  it('limits students to top 5 by elite_factor', () => {
    const students = Array.from({ length: 8 }, (_, i) => ({
      code: `STU${i}`, name_romaji: `Student ${i}`, name_kanji: null, slug: `stu-${i}`,
      school: 'Test', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
      juyo_count: 10, tokuju_count: i, elite_factor: i * 0.1,
    }));
    const result = distillArtistOverview(makePageData({
      lineage: { teacher: null, students },
    }));
    expect(result).not.toBeNull();
    expect(result!.top_students).toHaveLength(5);
    // Highest elite_factor first
    expect(result!.top_students[0].elite_factor).toBeCloseTo(0.7);
  });

  it('limits provenance owners to top 5 by count', () => {
    const denraiGrouped = Array.from({ length: 8 }, (_, i) => ({
      parent: `Owner ${i}`,
      parent_ja: null,
      totalCount: 10 - i,
      children: [],
      isGroup: false,
    }));
    const result = distillArtistOverview(makePageData({ denraiGrouped }));
    expect(result).not.toBeNull();
    expect(result!.top_provenance_owners).toHaveLength(5);
    expect(result!.top_provenance_owners[0].count).toBe(10);
  });

  it('filters out students with zero elite_factor and zero certs', () => {
    const students = [
      {
        code: 'STU1', name_romaji: 'Active', name_kanji: null, slug: 's-1',
        school: 'Test', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
        juyo_count: 5, tokuju_count: 0, elite_factor: 0,
      },
      {
        code: 'STU2', name_romaji: 'Empty', name_kanji: null, slug: 's-2',
        school: 'Test', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
        juyo_count: 0, tokuju_count: 0, elite_factor: 0,
      },
    ];
    const result = distillArtistOverview(makePageData({
      lineage: { teacher: null, students },
      stats: null,
      denraiGrouped: [],
      schoolAncestry: [],
    }));
    expect(result).not.toBeNull();
    expect(result!.top_students).toHaveLength(1);
    expect(result!.top_students[0].name).toBe('Active');
  });

  it('works with empty stats but has students', () => {
    const result = distillArtistOverview(makePageData({
      stats: { form_distribution: {}, mei_distribution: {}, measurements_by_form: {} },
      denraiGrouped: [],
      schoolAncestry: [],
    }));
    expect(result).not.toBeNull();
    expect(result!.top_students.length).toBeGreaterThan(0);
  });

  it('uses code as fallback when name_romaji is null', () => {
    const students = [{
      code: 'UNK001', name_romaji: null, name_kanji: null, slug: 'unk',
      school: 'Test', kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0,
      juyo_count: 5, tokuju_count: 1, elite_factor: 0.3,
    }];
    const result = distillArtistOverview(makePageData({
      lineage: { teacher: null, students },
      stats: null,
      denraiGrouped: [],
      schoolAncestry: [],
    }));
    expect(result).not.toBeNull();
    expect(result!.top_students[0].name).toBe('UNK001');
  });

  it('handles missing schoolAncestry gracefully', () => {
    const result = distillArtistOverview(makePageData({
      schoolAncestry: undefined,
    }));
    expect(result).not.toBeNull();
    expect(result!.school_ancestry).toEqual([]);
  });
});
