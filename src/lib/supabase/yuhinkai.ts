import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for Yuhinkai database (artist profiles, smith entities, etc.)
 * This is a separate database from the main NihontoWatch database.
 */

// Support both naming conventions (YUHINKAI_* or OSHI_V2_*)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';

if (!yuhinkaiUrl) {
  console.error('[Yuhinkai] YUHINKAI_SUPABASE_URL is not configured.');
}
if (!yuhinkaiKey) {
  console.error('[Yuhinkai] YUHINKAI_SUPABASE_KEY is not configured.');
}

export const yuhinkaiClient = createClient(yuhinkaiUrl, yuhinkaiKey);

export interface ArtistProfile {
  id: string;
  artist_code: string;
  artist_type: 'smith' | 'tosogu_maker';
  profile_md: string;
  hook: string | null;
  setsumei_count: number;
  extraction_json: Record<string, unknown>;
  stats_snapshot: Record<string, unknown>;
  profile_depth: 'full' | 'standard' | 'brief';
  human_reviewed: boolean;
  quality_flags: string[];
  generated_at: string;
  model_version: string;
  pipeline_version: string;
  created_at: string;
  updated_at: string;
}

export interface SmithEntity {
  smith_id: string;
  name_kanji: string | null;
  name_romaji: string | null;
  province: string | null;
  school: string | null;
  era: string | null;
  period: string | null;
  generation: string | null;
  teacher: string | null;
  hawley: number | null;
  fujishiro: string | null;
  toko_taikan: number | null;
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_count: number;
  elite_factor: number;
  is_school_code: boolean;
}

export interface TosoguMaker {
  maker_id: string;
  name_kanji: string | null;
  name_romaji: string | null;
  province: string | null;
  school: string | null;
  era: string | null;
  generation: string | null;
  teacher: string | null;
  specialties: string[] | null;
  alternative_names: string[] | null;
  notes: string | null;
  // Certification counts (highest prestige first)
  kokuho_count: number;   // National Treasures
  jubun_count: number;    // Important Cultural Properties (Bunkazai)
  jubi_count: number;     // Important Art Objects (Bijutsuhin)
  gyobutsu_count: number; // Imperial Collection
  tokuju_count: number;   // Tokubetsu Juyo
  juyo_count: number;     // Juyo
  total_items: number;
  elite_count: number;
  elite_factor: number;
  is_school_code: boolean;
}

export async function getArtistProfile(code: string): Promise<ArtistProfile | null> {
  const { data, error } = await yuhinkaiClient
    .from('artist_profiles')
    .select('*')
    .eq('artist_code', code)
    .single();

  if (error || !data) {
    console.error('[Yuhinkai] Error fetching artist profile:', error);
    return null;
  }

  return data as ArtistProfile;
}

export async function getSmithEntity(code: string): Promise<SmithEntity | null> {
  const { data, error } = await yuhinkaiClient
    .from('smith_entities')
    .select('*')
    .eq('smith_id', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SmithEntity;
}

export async function getTosoguMaker(code: string): Promise<TosoguMaker | null> {
  const { data, error } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('*')
    .eq('maker_id', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TosoguMaker;
}

// =============================================================================
// LINEAGE QUERIES
// =============================================================================

export interface ArtisanStub {
  code: string;
  name_romaji: string | null;
  name_kanji?: string | null;
  slug?: string;
}

/**
 * Find students of a given smith (smiths whose teacher field matches this code or name).
 * The teacher field in smith_entities stores the teacher's code or name.
 */
export async function getStudents(code: string, nameRomaji: string | null): Promise<ArtisanStub[]> {
  // Search by code match first
  const { data: byCode } = await yuhinkaiClient
    .from('smith_entities')
    .select('smith_id, name_romaji, name_kanji')
    .eq('teacher', code)
    .limit(20);

  const students: ArtisanStub[] = (byCode || []).map(s => ({
    code: s.smith_id,
    name_romaji: s.name_romaji,
    name_kanji: s.name_kanji,
  }));

  // Also search by name if available and got few results
  if (nameRomaji && students.length < 5) {
    const { data: byName } = await yuhinkaiClient
      .from('smith_entities')
      .select('smith_id, name_romaji, name_kanji')
      .eq('teacher', nameRomaji)
      .limit(20);

    const existingCodes = new Set(students.map(s => s.code));
    for (const s of byName || []) {
      if (!existingCodes.has(s.smith_id)) {
        students.push({
          code: s.smith_id,
          name_romaji: s.name_romaji,
          name_kanji: s.name_kanji,
        });
      }
    }
  }

  return students;
}

// =============================================================================
// RELATED ARTISANS (same school)
// =============================================================================

export interface RelatedArtisan {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  juyo_count: number;
  tokuju_count: number;
  elite_factor: number;
}

/**
 * Find related artisans in the same school, ordered by elite_factor descending.
 * Excludes the artisan itself.
 */
export async function getRelatedArtisans(
  code: string,
  school: string | null,
  entityType: 'smith' | 'tosogu'
): Promise<RelatedArtisan[]> {
  if (!school) return [];

  if (entityType === 'smith') {
    const { data } = await yuhinkaiClient
      .from('smith_entities')
      .select('smith_id, name_romaji, name_kanji, school, juyo_count, tokuju_count, elite_factor')
      .eq('school', school)
      .neq('smith_id', code)
      .eq('is_school_code', false)
      .order('elite_factor', { ascending: false })
      .limit(12);

    return (data || []).map(s => ({
      code: s.smith_id,
      name_romaji: s.name_romaji,
      name_kanji: s.name_kanji,
      school: s.school,
      juyo_count: s.juyo_count || 0,
      tokuju_count: s.tokuju_count || 0,
      elite_factor: s.elite_factor || 0,
    }));
  }

  const { data } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('maker_id, name_romaji, name_kanji, school, juyo_count, tokuju_count, elite_factor')
    .eq('school', school)
    .neq('maker_id', code)
    .eq('is_school_code', false)
    .order('elite_factor', { ascending: false })
    .limit(12);

  return (data || []).map(m => ({
    code: m.maker_id,
    name_romaji: m.name_romaji,
    name_kanji: m.name_kanji,
    school: m.school,
    juyo_count: m.juyo_count || 0,
    tokuju_count: m.tokuju_count || 0,
    elite_factor: m.elite_factor || 0,
  }));
}

// =============================================================================
// PERCENTILE QUERIES
// =============================================================================

/**
 * Calculate elite factor percentile among all non-school smiths/makers with total_items > 0.
 * Returns a value from 0 to 100 (higher = more elite than peers).
 */
export async function getElitePercentile(
  eliteFactor: number,
  entityType: 'smith' | 'tosogu'
): Promise<number> {
  const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

  // Count how many have a lower elite_factor
  const { count: below } = await yuhinkaiClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .lt('elite_factor', eliteFactor)
    .gt('total_items', 0)
    .eq('is_school_code', false);

  const { count: total } = await yuhinkaiClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gt('total_items', 0)
    .eq('is_school_code', false);

  if (!total || total === 0) return 0;
  return Math.round(((below || 0) / total) * 100);
}

/**
 * Calculate Toko Taikan score percentile (smith only).
 * Returns a value from 0 to 100 (higher = higher rated than peers).
 */
export async function getTokoTaikanPercentile(
  tokoTaikan: number
): Promise<number> {
  const { count: below } = await yuhinkaiClient
    .from('smith_entities')
    .select('*', { count: 'exact', head: true })
    .lt('toko_taikan', tokoTaikan)
    .not('toko_taikan', 'is', null);

  const { count: total } = await yuhinkaiClient
    .from('smith_entities')
    .select('*', { count: 'exact', head: true })
    .not('toko_taikan', 'is', null);

  if (!total || total === 0) return 0;
  return Math.round(((below || 0) / total) * 100);
}

/**
 * Resolve a teacher code/name to a stub with code, name, and slug info.
 * Tries smith_entities first by code, then by name_romaji.
 */
// =============================================================================
// DIRECTORY QUERIES
// =============================================================================

export interface ArtistDirectoryEntry {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  entity_type: 'smith' | 'tosogu';
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_factor: number;
}

export interface DirectoryFilters {
  type?: 'smith' | 'tosogu' | 'all';
  school?: string;
  province?: string;
  era?: string;
  q?: string;
  sort?: 'elite_factor' | 'juyo_count' | 'name' | 'total_items';
  page?: number;
  limit?: number;
  notable?: boolean;
}

export interface DirectoryFacets {
  schools: Array<{ value: string; count: number }>;
  provinces: Array<{ value: string; count: number }>;
  eras: Array<{ value: string; count: number }>;
  totals: { smiths: number; tosogu: number };
}

/**
 * Fetch paginated artisan list for the directory page.
 * Queries both smith_entities and tosogu_makers, merges results.
 */
export async function getArtistsForDirectory(
  filters: DirectoryFilters = {}
): Promise<{ artists: ArtistDirectoryEntry[]; total: number }> {
  const {
    type = 'all',
    school,
    province,
    era,
    q,
    sort = 'elite_factor',
    page = 1,
    limit = 50,
    notable = true,
  } = filters;

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const offset = (Math.max(page, 1) - 1) * safeLimit;

  const smithResults: ArtistDirectoryEntry[] = [];
  const tosoguResults: ArtistDirectoryEntry[] = [];
  let smithTotal = 0;
  let tosoguTotal = 0;

  // Determine sort column mapping for each table
  const smithSortCol = sort === 'name' ? 'name_romaji' : sort;
  const tosoguSortCol = sort === 'name' ? 'name_romaji' : sort;

  // Query smiths
  if (type === 'all' || type === 'smith') {
    let query = yuhinkaiClient
      .from('smith_entities')
      .select('smith_id, name_romaji, name_kanji, school, province, era, tokuju_count, juyo_count, total_items, elite_factor', { count: 'exact' })
      .eq('is_school_code', false);

    if (notable) query = query.gt('total_items', 0);
    if (school) query = query.eq('school', school);
    if (province) query = query.eq('province', province);
    if (era) query = query.eq('era', era);
    if (q) {
      query = query.or(`name_romaji.ilike.%${q}%,name_kanji.ilike.%${q}%,smith_id.ilike.%${q}%`);
    }

    // When querying both types, fetch all matching and merge; when single type, paginate directly
    if (type === 'smith') {
      query = query
        .order(smithSortCol, { ascending: sort === 'name', nullsFirst: false })
        .range(offset, offset + safeLimit - 1);
    } else {
      // For merged queries, we need all IDs for sorting — but that's too expensive.
      // Instead, fetch top N for each type and merge client-side.
      query = query
        .order(smithSortCol, { ascending: sort === 'name', nullsFirst: false })
        .range(0, offset + safeLimit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('[Yuhinkai] Directory smith query error:', error);
    } else {
      smithTotal = count || 0;
      for (const s of data || []) {
        smithResults.push({
          code: s.smith_id,
          name_romaji: s.name_romaji,
          name_kanji: s.name_kanji,
          school: s.school,
          province: s.province,
          era: s.era,
          entity_type: 'smith',
          tokuju_count: s.tokuju_count || 0,
          juyo_count: s.juyo_count || 0,
          total_items: s.total_items || 0,
          elite_factor: s.elite_factor || 0,
        });
      }
    }
  }

  // Query tosogu makers
  if (type === 'all' || type === 'tosogu') {
    let query = yuhinkaiClient
      .from('tosogu_makers')
      .select('maker_id, name_romaji, name_kanji, school, province, era, tokuju_count, juyo_count, total_items, elite_factor', { count: 'exact' })
      .eq('is_school_code', false);

    if (notable) query = query.gt('total_items', 0);
    if (school) query = query.eq('school', school);
    if (province) query = query.eq('province', province);
    if (era) query = query.eq('era', era);
    if (q) {
      query = query.or(`name_romaji.ilike.%${q}%,name_kanji.ilike.%${q}%,maker_id.ilike.%${q}%`);
    }

    if (type === 'tosogu') {
      query = query
        .order(tosoguSortCol, { ascending: sort === 'name', nullsFirst: false })
        .range(offset, offset + safeLimit - 1);
    } else {
      query = query
        .order(tosoguSortCol, { ascending: sort === 'name', nullsFirst: false })
        .range(0, offset + safeLimit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('[Yuhinkai] Directory tosogu query error:', error);
    } else {
      tosoguTotal = count || 0;
      for (const m of data || []) {
        tosoguResults.push({
          code: m.maker_id,
          name_romaji: m.name_romaji,
          name_kanji: m.name_kanji,
          school: m.school,
          province: m.province,
          era: m.era,
          entity_type: 'tosogu',
          tokuju_count: m.tokuju_count || 0,
          juyo_count: m.juyo_count || 0,
          total_items: m.total_items || 0,
          elite_factor: m.elite_factor || 0,
        });
      }
    }
  }

  // Single-type pagination is already handled by the DB
  if (type === 'smith') {
    return { artists: smithResults, total: smithTotal };
  }
  if (type === 'tosogu') {
    return { artists: tosoguResults, total: tosoguTotal };
  }

  // Merged type: combine, sort, paginate client-side
  const total = smithTotal + tosoguTotal;
  const merged = [...smithResults, ...tosoguResults];

  merged.sort((a, b) => {
    switch (sort) {
      case 'name':
        return (a.name_romaji || '').localeCompare(b.name_romaji || '');
      case 'juyo_count':
        return b.juyo_count - a.juyo_count;
      case 'total_items':
        return b.total_items - a.total_items;
      case 'elite_factor':
      default:
        return b.elite_factor - a.elite_factor;
    }
  });

  const artists = merged.slice(offset, offset + safeLimit);
  return { artists, total };
}

/**
 * Fetch aggregate facets for filter dropdowns on the directory page.
 */
export async function getArtistDirectoryFacets(): Promise<DirectoryFacets> {
  // Fetch counts for both tables in parallel
  const [
    { data: smithSchools },
    { data: tosoguSchools },
    { data: smithProvinces },
    { data: tosoguProvinces },
    { data: smithEras },
    { data: tosoguEras },
    { count: smithCount },
    { count: tosoguCount },
  ] = await Promise.all([
    yuhinkaiClient.from('smith_entities').select('school').eq('is_school_code', false).gt('total_items', 0).not('school', 'is', null),
    yuhinkaiClient.from('tosogu_makers').select('school').eq('is_school_code', false).gt('total_items', 0).not('school', 'is', null),
    yuhinkaiClient.from('smith_entities').select('province').eq('is_school_code', false).gt('total_items', 0).not('province', 'is', null),
    yuhinkaiClient.from('tosogu_makers').select('province').eq('is_school_code', false).gt('total_items', 0).not('province', 'is', null),
    yuhinkaiClient.from('smith_entities').select('era').eq('is_school_code', false).gt('total_items', 0).not('era', 'is', null),
    yuhinkaiClient.from('tosogu_makers').select('era').eq('is_school_code', false).gt('total_items', 0).not('era', 'is', null),
    yuhinkaiClient.from('smith_entities').select('*', { count: 'exact', head: true }).eq('is_school_code', false).gt('total_items', 0),
    yuhinkaiClient.from('tosogu_makers').select('*', { count: 'exact', head: true }).eq('is_school_code', false).gt('total_items', 0),
  ]);

  // Aggregate school counts
  const schoolMap = new Map<string, number>();
  for (const row of [...(smithSchools || []), ...(tosoguSchools || [])]) {
    const s = row.school as string;
    schoolMap.set(s, (schoolMap.get(s) || 0) + 1);
  }

  // Aggregate province counts
  const provinceMap = new Map<string, number>();
  for (const row of [...(smithProvinces || []), ...(tosoguProvinces || [])]) {
    const p = row.province as string;
    provinceMap.set(p, (provinceMap.get(p) || 0) + 1);
  }

  // Aggregate era counts
  const eraMap = new Map<string, number>();
  for (const row of [...(smithEras || []), ...(tosoguEras || [])]) {
    const e = row.era as string;
    eraMap.set(e, (eraMap.get(e) || 0) + 1);
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    schools: toSorted(schoolMap),
    provinces: toSorted(provinceMap),
    eras: toSorted(eraMap),
    totals: {
      smiths: smithCount || 0,
      tosogu: tosoguCount || 0,
    },
  };
}

// =============================================================================
// TEACHER RESOLUTION
// =============================================================================

export async function resolveTeacher(teacherRef: string): Promise<ArtisanStub | null> {
  // Try as a smith_id code first
  const { data: byCode } = await yuhinkaiClient
    .from('smith_entities')
    .select('smith_id, name_romaji, name_kanji')
    .eq('smith_id', teacherRef)
    .single();

  if (byCode) {
    return {
      code: byCode.smith_id,
      name_romaji: byCode.name_romaji,
      name_kanji: byCode.name_kanji,
    };
  }

  // Try by name_romaji
  const { data: byName } = await yuhinkaiClient
    .from('smith_entities')
    .select('smith_id, name_romaji, name_kanji')
    .eq('name_romaji', teacherRef)
    .limit(1)
    .single();

  if (byName) {
    return {
      code: byName.smith_id,
      name_romaji: byName.name_romaji,
      name_kanji: byName.name_kanji,
    };
  }

  return null;
}
