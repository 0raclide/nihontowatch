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
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
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
      .select('smith_id, name_romaji, name_kanji, school, kokuho_count, jubun_count, jubi_count, gyobutsu_count, juyo_count, tokuju_count, elite_factor')
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
      kokuho_count: s.kokuho_count || 0,
      jubun_count: s.jubun_count || 0,
      jubi_count: s.jubi_count || 0,
      gyobutsu_count: s.gyobutsu_count || 0,
      juyo_count: s.juyo_count || 0,
      tokuju_count: s.tokuju_count || 0,
      elite_factor: s.elite_factor || 0,
    }));
  }

  const { data } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('maker_id, name_romaji, name_kanji, school, kokuho_count, jubun_count, jubi_count, gyobutsu_count, juyo_count, tokuju_count, elite_factor')
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
    kokuho_count: m.kokuho_count || 0,
    jubun_count: m.jubun_count || 0,
    jubi_count: m.jubi_count || 0,
    gyobutsu_count: m.gyobutsu_count || 0,
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
    .gt('total_items', 0);

  const { count: total } = await yuhinkaiClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gt('total_items', 0);

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
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_factor: number;
  is_school_code: boolean;
  percentile?: number;
  member_count?: number;
  denrai_owners?: Array<{ owner: string; count: number }>;
  available_count?: number;
  first_listing_id?: number;
}

export interface DirectoryFilters {
  type?: 'smith' | 'tosogu';
  school?: string;
  province?: string;
  era?: string;
  q?: string;
  sort?: 'elite_factor' | 'name' | 'total_items' | 'for_sale';
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
 * Queries either smith_entities or tosogu_makers based on the type filter.
 */
export async function getArtistsForDirectory(
  filters: DirectoryFilters = {}
): Promise<{ artists: ArtistDirectoryEntry[]; total: number }> {
  const {
    type = 'smith',
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
  const sortCol = sort === 'name' ? 'name_romaji' : (sort === 'for_sale' ? 'elite_factor' : sort);

  const table = type === 'tosogu' ? 'tosogu_makers' : 'smith_entities';
  const idCol = type === 'tosogu' ? 'maker_id' : 'smith_id';
  const entityType = type === 'tosogu' ? 'tosogu' : 'smith';

  let query = yuhinkaiClient
    .from(table)
    .select(`${idCol}, name_romaji, name_kanji, school, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, is_school_code`, { count: 'exact' });

  if (notable) query = query.gt('total_items', 0);
  if (school) query = query.eq('school', school);
  if (province) query = query.eq('province', province);
  if (era) query = query.eq('era', era);
  if (q) {
    query = query.or(`name_romaji.ilike.%${q}%,name_kanji.ilike.%${q}%,${idCol}.ilike.%${q}%,school.ilike.%${q}%,province.ilike.%${q}%`);
  }

  query = query
    .order(sortCol, { ascending: sort === 'name', nullsFirst: false })
    .range(offset, offset + safeLimit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error(`[Yuhinkai] Directory ${entityType} query error:`, error);
    return { artists: [], total: 0 };
  }

  const artists: ArtistDirectoryEntry[] = (data || []).map((row: Record<string, unknown>) => ({
    code: row[idCol] as string,
    name_romaji: row.name_romaji as string | null,
    name_kanji: row.name_kanji as string | null,
    school: row.school as string | null,
    province: row.province as string | null,
    era: row.era as string | null,
    entity_type: entityType,
    kokuho_count: (row.kokuho_count as number) || 0,
    jubun_count: (row.jubun_count as number) || 0,
    jubi_count: (row.jubi_count as number) || 0,
    gyobutsu_count: (row.gyobutsu_count as number) || 0,
    tokuju_count: (row.tokuju_count as number) || 0,
    juyo_count: (row.juyo_count as number) || 0,
    total_items: (row.total_items as number) || 0,
    elite_factor: (row.elite_factor as number) || 0,
    is_school_code: (row.is_school_code as boolean) || false,
  }));

  return { artists, total: count || 0 };
}

/**
 * Fetch artists matching a set of codes with optional directory filters applied.
 * Used by the "for sale" sort which needs to query by known artisan codes
 * (from listings) then apply Yuhinkai filters (school, province, era, etc.).
 * Processes in batches to avoid URL length limits on .in() queries.
 */
export async function getFilteredArtistsByCodes(
  codes: string[],
  type: 'smith' | 'tosogu',
  filters: { school?: string; province?: string; era?: string; q?: string; notable?: boolean }
): Promise<ArtistDirectoryEntry[]> {
  if (codes.length === 0) return [];

  const table = type === 'tosogu' ? 'tosogu_makers' : 'smith_entities';
  const idCol = type === 'tosogu' ? 'maker_id' : 'smith_id';
  const entityType = type === 'tosogu' ? 'tosogu' : 'smith';

  const BATCH_SIZE = 200;
  const results: ArtistDirectoryEntry[] = [];

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    let query = yuhinkaiClient
      .from(table)
      .select(`${idCol}, name_romaji, name_kanji, school, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, is_school_code`)
      .in(idCol, batch);

    if (filters.notable !== false) query = query.gt('total_items', 0);
    if (filters.school) query = query.eq('school', filters.school);
    if (filters.province) query = query.eq('province', filters.province);
    if (filters.era) query = query.eq('era', filters.era);
    if (filters.q) {
      query = query.or(`name_romaji.ilike.%${filters.q}%,name_kanji.ilike.%${filters.q}%,${idCol}.ilike.%${filters.q}%,school.ilike.%${filters.q}%,province.ilike.%${filters.q}%`);
    }

    const { data } = await query;

    for (const row of data || []) {
      results.push({
        code: (row as Record<string, unknown>)[idCol] as string,
        name_romaji: row.name_romaji as string | null,
        name_kanji: row.name_kanji as string | null,
        school: row.school as string | null,
        province: row.province as string | null,
        era: row.era as string | null,
        entity_type: entityType,
        kokuho_count: (row.kokuho_count as number) || 0,
        jubun_count: (row.jubun_count as number) || 0,
        jubi_count: (row.jubi_count as number) || 0,
        gyobutsu_count: (row.gyobutsu_count as number) || 0,
        tokuju_count: (row.tokuju_count as number) || 0,
        juyo_count: (row.juyo_count as number) || 0,
        total_items: (row.total_items as number) || 0,
        elite_factor: (row.elite_factor as number) || 0,
        is_school_code: (row.is_school_code as boolean) || false,
      });
    }
  }

  return results;
}

/**
 * Fetch aggregate facets for filter dropdowns on the directory page.
 * Only returns schools/provinces/eras for the selected type, keeping
 * totals for both types (used for tab counts).
 */
export async function getArtistDirectoryFacets(type: 'smith' | 'tosogu'): Promise<DirectoryFacets> {
  const table = type === 'smith' ? 'smith_entities' : 'tosogu_makers';
  const idCol = type === 'smith' ? 'smith_id' : 'maker_id';

  // Fetch facets for the selected type + totals for both types in parallel
  const [
    { data: schools },
    { data: provinces },
    { data: eras },
    { count: smithCount },
    { count: tosoguCount },
  ] = await Promise.all([
    yuhinkaiClient.from(table).select('school').gt('total_items', 0).not('school', 'is', null),
    yuhinkaiClient.from(table).select('province').gt('total_items', 0).not('province', 'is', null),
    yuhinkaiClient.from(table).select('era').gt('total_items', 0).not('era', 'is', null),
    yuhinkaiClient.from('smith_entities').select('*', { count: 'exact', head: true }).gt('total_items', 0),
    yuhinkaiClient.from('tosogu_makers').select('*', { count: 'exact', head: true }).gt('total_items', 0),
  ]);

  const schoolMap = new Map<string, number>();
  for (const row of schools || []) {
    const s = row.school as string;
    schoolMap.set(s, (schoolMap.get(s) || 0) + 1);
  }

  const provinceMap = new Map<string, number>();
  for (const row of provinces || []) {
    const p = row.province as string;
    provinceMap.set(p, (provinceMap.get(p) || 0) + 1);
  }

  const eraMap = new Map<string, number>();
  for (const row of eras || []) {
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
// SCHOOL MEMBER COUNTS (for NS code cards)
// =============================================================================

/**
 * For NS school code entries, count how many individual smiths/makers share the same school.
 * Returns Map<code, memberCount>.
 */
export async function getSchoolMemberCounts(
  artists: Array<{ code: string; school: string | null; entity_type: 'smith' | 'tosogu'; is_school_code: boolean }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const nsCodes = artists.filter(a => a.is_school_code && a.school);
  if (nsCodes.length === 0) return result;

  // Deduplicate by school+type
  const uniqueSchools = new Map<string, { school: string; type: 'smith' | 'tosogu'; codes: string[] }>();
  for (const a of nsCodes) {
    const key = `${a.entity_type}:${a.school}`;
    const entry = uniqueSchools.get(key);
    if (entry) {
      entry.codes.push(a.code);
    } else {
      uniqueSchools.set(key, { school: a.school!, type: a.entity_type, codes: [a.code] });
    }
  }

  await Promise.all(
    Array.from(uniqueSchools.values()).map(async ({ school, type, codes }) => {
      const table = type === 'smith' ? 'smith_entities' : 'tosogu_makers';
      const { count } = await yuhinkaiClient
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('school', school)
        .eq('is_school_code', false)
        .gt('total_items', 0);

      for (const code of codes) {
        result.set(code, count || 0);
      }
    })
  );

  return result;
}

// =============================================================================
// BULK PERCENTILE QUERIES (for directory cards)
// =============================================================================

/**
 * Compute elite_factor percentiles for a batch of artists.
 * Separates smiths and tosogu into independent comparison pools.
 * Deduplicates elite_factor values to minimise query count.
 * Returns Map<code, percentile 0-100>.
 */
export async function getBulkElitePercentiles(
  artists: Array<{ code: string; elite_factor: number; entity_type: 'smith' | 'tosogu' }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (artists.length === 0) return result;

  // Group by entity_type
  const byType = new Map<'smith' | 'tosogu', typeof artists>();
  for (const a of artists) {
    if (!byType.has(a.entity_type)) byType.set(a.entity_type, []);
    byType.get(a.entity_type)!.push(a);
  }

  // Process each type independently
  const typePromises = Array.from(byType.entries()).map(async ([entityType, group]) => {
    const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

    // Get total count for this type
    const { count: total } = await yuhinkaiClient
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gt('total_items', 0);

    if (!total || total === 0) {
      for (const a of group) result.set(a.code, 0);
      return;
    }

    // Deduplicate elite_factor values
    const uniqueFactors = [...new Set(group.map(a => a.elite_factor))];

    // Count how many artisans rank below each unique factor (parallel)
    const belowCounts = await Promise.all(
      uniqueFactors.map(async (factor) => {
        const { count: below } = await yuhinkaiClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .lt('elite_factor', factor)
          .gt('total_items', 0);
        return { factor, below: below || 0 };
      })
    );

    // Build factor → percentile map
    const factorToPercentile = new Map<number, number>();
    for (const { factor, below } of belowCounts) {
      factorToPercentile.set(factor, Math.round((below / total) * 100));
    }

    // Assign to each artist
    for (const a of group) {
      result.set(a.code, factorToPercentile.get(a.elite_factor) ?? 0);
    }
  });

  await Promise.all(typePromises);
  return result;
}

// =============================================================================
// FORM & MEI DISTRIBUTIONS (from gold_values)
// =============================================================================

/**
 * Compute form and mei distributions directly from gold_values for any artisan.
 * No dependency on artist_profiles — works for all 13,566 artisans.
 */
export async function getArtisanDistributions(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<{ form_distribution: Record<string, number>; mei_distribution: Record<string, number> } | null> {
  const idCol = entityType === 'smith' ? 'gold_smith_id' : 'gold_maker_id';

  const { data, error } = await yuhinkaiClient
    .from('gold_values')
    .select('gold_form_type, gold_mei_status, gold_collections')
    .eq(idCol, code);

  if (error || !data || data.length === 0) return null;

  const form: Record<string, number> = {};
  const mei: Record<string, number> = {};

  for (const row of data) {
    // Skip orphaned JE_Koto records — unreliable data without corroborating siblings
    const collections = row.gold_collections as string[] | null;
    if (collections?.length === 1 && collections[0] === 'JE_Koto') continue;

    // Form distribution
    const rawForm = (row.gold_form_type as string | null)?.toLowerCase().trim();
    if (rawForm) {
      const formKey = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken', 'kodachi'].includes(rawForm)
        ? rawForm
        : 'other';
      form[formKey] = (form[formKey] || 0) + 1;
    }

    // Mei distribution — normalize to canonical keys
    const rawMei = (row.gold_mei_status as string | null)?.toLowerCase().trim();
    if (rawMei) {
      let meiKey: string;
      if (rawMei === 'mumei' || rawMei === 'unsigned') meiKey = 'mumei';
      else if (rawMei === 'signed' || rawMei === 'mei') meiKey = 'signed';
      else if (rawMei === 'kinzogan' || rawMei === 'kinzogan-mei' || rawMei === 'kinzogan_mei') meiKey = 'kinzogan_mei';
      else if (rawMei === 'den' || rawMei === 'tradition') meiKey = 'den';
      else if (rawMei === 'attributed') meiKey = 'attributed';
      else if (rawMei === 'gimei') meiKey = 'gimei';
      else if (rawMei === 'orikaeshi' || rawMei === 'orikaeshi-mei' || rawMei === 'orikaeshi_mei') meiKey = 'orikaeshi_mei';
      else if (rawMei === 'gaku' || rawMei === 'gaku-mei' || rawMei === 'gaku_mei') meiKey = 'gaku_mei';
      else if (rawMei === 'suriage') meiKey = 'suriage';
      else if (rawMei === 'shu' || rawMei === 'shu-mei' || rawMei === 'shu_mei') meiKey = 'shu_mei';
      else if (rawMei === 'ginzogan-mei' || rawMei === 'ginzogan_mei') meiKey = 'ginzogan_mei';
      else if (rawMei === 'kinpun-mei' || rawMei === 'kinpun_mei') meiKey = 'kinpun_mei';
      else if (rawMei === 'kiritsuke-mei' || rawMei === 'kiritsuke_mei') meiKey = 'kiritsuke_mei';
      else if (rawMei === 'shusho-mei' || rawMei === 'shusho_mei') meiKey = 'shusho_mei';
      else meiKey = rawMei;
      mei[meiKey] = (mei[meiKey] || 0) + 1;
    }
  }

  const hasForm = Object.values(form).some(v => v > 0);
  const hasMei = Object.values(mei).some(v => v > 0);
  if (!hasForm && !hasMei) return null;

  return { form_distribution: form, mei_distribution: mei };
}

// =============================================================================
// HERO IMAGE (highest-designation catalog image for artist profiles)
// =============================================================================

/** Priority order: Tokuju has the nicest images, Jubi the worst */
const COLLECTION_PRIORITY: string[] = ['Tokuju', 'Juyo', 'Kokuho', 'JuBun', 'Jubi'];

export interface ArtisanHeroImage {
  imageUrl: string;
  collection: string;       // e.g. 'Tokuju'
  volume: number;
  itemNumber: number;
  formType: string | null;  // e.g. 'Katana'
  imageType: string;        // e.g. 'oshigata'
}

/**
 * Fetch the best catalog image for an artisan's profile hero.
 * Walks collections in priority order (Tokuju → Juyo → Kokuho → JuBun → Jubi)
 * and returns the first oshigata (or fallback) image found.
 */
export async function getArtisanHeroImage(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<ArtisanHeroImage | null> {
  const codeColumn = entityType === 'smith' ? 'gold_smith_id' : 'gold_maker_id';

  // 1. Get all objects for this artisan with their collections + form type
  const { data: goldRows, error } = await yuhinkaiClient
    .from('gold_values')
    .select('object_uuid, gold_collections, gold_form_type')
    .eq(codeColumn, code);

  if (error || !goldRows || goldRows.length === 0) return null;

  // 2. Bucket objects by best collection, walking priority order
  for (const targetCollection of COLLECTION_PRIORITY) {
    const matchingObjects: Array<{ uuid: string; formType: string | null }> = [];

    for (const row of goldRows) {
      const collections = row.gold_collections as string[] | null;
      if (collections?.includes(targetCollection)) {
        matchingObjects.push({
          uuid: row.object_uuid as string,
          formType: (row.gold_form_type as string | null),
        });
      }
    }

    if (matchingObjects.length === 0) continue;

    // 3. Get catalog records for these objects in this collection
    const objectUuids = matchingObjects.map(o => o.uuid);
    const { data: catalogRecords } = await yuhinkaiClient
      .from('catalog_records')
      .select('uuid, object_uuid, collection, volume, item_number')
      .in('object_uuid', objectUuids)
      .eq('collection', targetCollection)
      .limit(10);

    if (!catalogRecords || catalogRecords.length === 0) continue;

    // 4. Get stored images for these catalog records (prefer oshigata)
    const catalogUuids = catalogRecords.map(r => r.uuid);
    const { data: images } = await yuhinkaiClient
      .from('stored_images')
      .select('catalog_record_uuid, storage_bucket, storage_path, image_type')
      .in('catalog_record_uuid', catalogUuids)
      .eq('is_current', true);

    if (!images || images.length === 0) continue;

    // 5. Pick the best image: prefer oshigata > sugata > detail > any
    const typeOrder = ['oshigata', 'sugata', 'detail'];
    let bestImage = images[0];
    let bestRank = typeOrder.indexOf(bestImage.image_type) >= 0
      ? typeOrder.indexOf(bestImage.image_type)
      : typeOrder.length;

    for (const img of images) {
      const rank = typeOrder.indexOf(img.image_type) >= 0
        ? typeOrder.indexOf(img.image_type)
        : typeOrder.length;
      if (rank < bestRank) {
        bestImage = img;
        bestRank = rank;
      }
    }

    // 6. Build public URL
    const { data: urlData } = yuhinkaiClient.storage
      .from(bestImage.storage_bucket)
      .getPublicUrl(bestImage.storage_path);

    if (!urlData?.publicUrl) continue;

    // Find the matching catalog record + gold_values form type
    const catalogRecord = catalogRecords.find(r => r.uuid === bestImage.catalog_record_uuid)!;
    const goldRow = matchingObjects.find(o => o.uuid === catalogRecord.object_uuid);

    return {
      imageUrl: urlData.publicUrl,
      collection: targetCollection,
      volume: catalogRecord.volume,
      itemNumber: catalogRecord.item_number,
      formType: goldRow?.formType || null,
      imageType: bestImage.image_type,
    };
  }

  return null;
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

// =============================================================================
// DENRAI (PROVENANCE) QUERIES
// =============================================================================

/**
 * Fetch denrai (provenance) owner data for an artisan by entity code.
 * Queries gold_values by gold_smith_id or gold_maker_id for reliable matching,
 * unnests gold_denrai_owners in JS, and aggregates counts per owner.
 * Returns all owners sorted by count descending.
 */
export async function getDenraiForArtisan(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<Array<{ owner: string; count: number }>> {
  const codeColumn = entityType === 'smith' ? 'gold_smith_id' : 'gold_maker_id';

  const { data, error } = await yuhinkaiClient
    .from('gold_values')
    .select('gold_denrai_owners, gold_collections')
    .eq(codeColumn, code)
    .not('gold_denrai_owners', 'is', null);

  if (error) {
    console.error('[Yuhinkai] Denrai query error:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Aggregate: for each row, unnest owners and count per owner
  const ownerMap = new Map<string, number>();

  for (const row of data) {
    // Skip orphaned JE_Koto records — unreliable data without corroborating siblings
    const collections = row.gold_collections as string[] | null;
    if (collections?.length === 1 && collections[0] === 'JE_Koto') continue;

    const owners = row.gold_denrai_owners as string[];
    if (!owners || !Array.isArray(owners)) continue;

    // Count each unique owner per row (unnest semantics — one count per item/row)
    const seen = new Set<string>();
    for (const owner of owners) {
      const trimmed = owner.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        ownerMap.set(trimmed, (ownerMap.get(trimmed) || 0) + 1);
      }
    }
  }

  // Convert to sorted array, all owners
  return Array.from(ownerMap.entries())
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count);
}
