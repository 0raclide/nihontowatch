import type { CatalogueEntry } from '@/lib/supabase/yuhinkai';

/**
 * Rich artisan page response shape — shared between SSR page and API route.
 */
export interface ArtisanPageResponse {
  entity: {
    code: string;
    name_romaji: string | null;
    name_kanji: string | null;
    school: string | null;
    school_code: string | null;
    school_kanji: string | null;
    school_tradition: string | null;
    province: string | null;
    era: string | null;
    period: string | null;
    generation: string | null;
    teacher: string | null;
    entity_type: 'smith' | 'tosogu';
    is_school_code: boolean;
    slug: string;
    fujishiro: string | null;
    toko_taikan: number | null;
    specialties: string[] | null;
  };
  certifications: {
    kokuho_count: number;
    jubun_count: number;
    jubi_count: number;
    gyobutsu_count: number;
    tokuju_count: number;
    juyo_count: number;
    total_items: number;
    elite_count: number;
    elite_factor: number;
  };
  rankings: {
    elite_percentile: number;
    toko_taikan_percentile: number | null;
    provenance_percentile: number | null;
  };
  provenance: {
    factor: number | null;
    count: number;
    apex: number;
  };
  profile: {
    profile_md: string;
    profile_md_ja: string | null;
    hook: string | null;
    setsumei_count: number;
    generated_at: string;
  } | null;
  stats: {
    mei_distribution: Record<string, number>;
    form_distribution: Record<string, number>;
    measurements_by_form: Record<string, {
      nagasa: number[];
      sori: number[];
      motohaba: number[];
      sakihaba: number[];
    }>;
  } | null;
  lineage: {
    teacher: { code: string; name_romaji: string | null; slug: string } | null;
    students: Array<{
      code: string;
      name_romaji: string | null;
      name_kanji: string | null;
      slug: string;
      school: string | null;
      kokuho_count: number;
      jubun_count: number;
      jubi_count: number;
      gyobutsu_count: number;
      juyo_count: number;
      tokuju_count: number;
      elite_factor: number;
      available_count?: number;
    }>;
  };
  related: Array<{
    code: string;
    name_romaji: string | null;
    name_kanji: string | null;
    slug: string;
    school: string | null;
    kokuho_count: number;
    jubun_count: number;
    jubi_count: number;
    gyobutsu_count: number;
    juyo_count: number;
    tokuju_count: number;
    elite_factor: number;
    available_count?: number;
  }>;
  denrai: Array<{ owner: string; count: number }>;
  denraiGrouped: Array<{
    parent: string;
    parent_ja: string | null;
    totalCount: number;
    children: Array<{ owner: string; owner_ja: string | null; count: number }>;
    isGroup: boolean;
  }>;
  schoolAncestry?: Array<{ code: string; name_romaji: string; name_kanji: string | null }>;
  heroImage: {
    imageUrl: string;
    collection: string;
    volume: number;
    itemNumber: number;
    formType: string | null;
    imageType: string;
  } | null;
  catalogueEntries?: CatalogueEntry[];
}
