import type { CatalogueEntry } from '@/lib/supabase/yuhinkai';

/**
 * Compact one-line stats summary for artisan search results.
 * "Kokuho 2 · TokuJu 3 · Juyo 47 · 50 items"
 * Kokuho shown first (rarest designation). Only non-zero counts included.
 */
export function formatArtisanStats(stats: {
  kokuho_count?: number;
  tokuju_count?: number;
  juyo_count?: number;
  total_items?: number;
}): string {
  const parts: string[] = [];
  if (stats.kokuho_count && stats.kokuho_count > 0) parts.push(`Kokuho ${stats.kokuho_count}`);
  if (stats.tokuju_count && stats.tokuju_count > 0) parts.push(`TokuJu ${stats.tokuju_count}`);
  if (stats.juyo_count && stats.juyo_count > 0) parts.push(`Juyo ${stats.juyo_count}`);
  if (stats.total_items && stats.total_items > 0) parts.push(`${stats.total_items} items`);
  return parts.join(' · ');
}

/**
 * Alternative artisan candidate from the matching pipeline.
 * Shared between ArtisanTooltip, ArtisanDetailsPanel, and AdminEditView.
 */
export interface ArtisanCandidate {
  artisan_id: string;
  name_kanji?: string;
  name_romaji?: string;
  school?: string;
  generation?: string;
  is_school_code?: boolean;
  retrieval_method?: string;
  retrieval_score?: number;
}

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
