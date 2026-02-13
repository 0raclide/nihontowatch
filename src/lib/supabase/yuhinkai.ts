import { createClient } from '@supabase/supabase-js';
import { eraToBroadPeriod, PERIOD_ORDER, BROAD_PERIODS } from '@/lib/artisan/eraPeriods';

/**
 * Supabase client for Yuhinkai database (artist profiles, smith entities, etc.)
 * This is a separate database from the main NihontoWatch database.
 */

// Support both naming conventions (YUHINKAI_* or OSHI_V2_*)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';

export const yuhinkaiConfigured = !!(yuhinkaiUrl && yuhinkaiKey);

if (!yuhinkaiConfigured) {
  console.warn('[Yuhinkai] Not configured — Yuhinkai features will be unavailable.');
}

// Use placeholder URL/key when not configured to avoid crashing at module evaluation
// time during builds (e.g., CI without Yuhinkai secrets). Queries will fail gracefully
// at runtime — all functions already handle errors with null/empty returns.
export const yuhinkaiClient = createClient(
  yuhinkaiUrl || 'https://placeholder.supabase.co',
  yuhinkaiKey || 'placeholder-key'
);

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
  provenance_factor: number | null;
  provenance_count: number | null;
  provenance_apex: number | null;
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
  provenance_factor: number | null;
  provenance_count: number | null;
  provenance_apex: number | null;
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
// ARTISAN CODE RESOLUTION (for text search → artisan_id matching)
// =============================================================================

/**
 * Resolve human-readable artisan names to Yuhinkai artisan codes.
 *
 * Given text words (e.g., ['norishige'] or ['rai', 'kunimitsu']), queries
 * smith_entities and tosogu_makers for matching name_romaji, name_kanji, or school.
 * Multiple words create AND logic — all words must match the same artisan.
 *
 * Used by browse API and saved search matcher to find artisan-matched listings
 * where the smith/tosogu_maker field may be empty or kanji-only.
 *
 * Returns deduplicated artisan codes (e.g., ['NOR312', 'NOR567']).
 * Returns empty array if Yuhinkai is not configured or no matches found.
 */
export async function resolveArtisanCodesFromText(textWords: string[]): Promise<string[]> {
  if (!yuhinkaiConfigured || textWords.length === 0) return [];

  try {
    const [smithCodes, tosoguCodes] = await Promise.all([
      // Search smith_entities
      (async () => {
        let query = yuhinkaiClient
          .from('smith_entities')
          .select('smith_id')
          .eq('is_school_code', false);

        for (const word of textWords) {
          query = query.or(`name_romaji.ilike.%${word}%,name_kanji.ilike.%${word}%,school.ilike.%${word}%`);
        }

        const { data } = await query.limit(100);
        return (data || []).map((r: { smith_id: string }) => r.smith_id);
      })(),
      // Search tosogu_makers
      (async () => {
        let query = yuhinkaiClient
          .from('tosogu_makers')
          .select('maker_id')
          .eq('is_school_code', false);

        for (const word of textWords) {
          query = query.or(`name_romaji.ilike.%${word}%,name_kanji.ilike.%${word}%,school.ilike.%${word}%`);
        }

        const { data } = await query.limit(100);
        return (data || []).map((r: { maker_id: string }) => r.maker_id);
      })(),
    ]);

    // Deduplicate codes
    return [...new Set([...smithCodes, ...tosoguCodes])];
  } catch (error) {
    console.error('[Yuhinkai] Error resolving artisan codes from text:', error);
    return [];
  }
}

// =============================================================================
// BATCH NAME LOOKUP (for badge display names)
// =============================================================================

/**
 * Fetch name_romaji and school for a batch of artisan codes.
 * Queries smith_entities and tosogu_makers in parallel.
 * Used by browse/listing APIs to enrich badges with display names.
 */
export async function getArtisanNames(
  codes: string[]
): Promise<Map<string, { name_romaji: string | null; school: string | null }>> {
  const result = new Map<string, { name_romaji: string | null; school: string | null }>();
  if (codes.length === 0) return result;

  const BATCH_SIZE = 200;

  // Query both tables in parallel
  const [smithResults, tosoguResults] = await Promise.all([
    // Smith entities
    (async () => {
      const rows: Array<{ smith_id: string; name_romaji: string | null; school: string | null }> = [];
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('smith_entities')
          .select('smith_id, name_romaji, school')
          .in('smith_id', batch);
        if (data) rows.push(...(data as typeof rows));
      }
      return rows;
    })(),
    // Tosogu makers
    (async () => {
      const rows: Array<{ maker_id: string; name_romaji: string | null; school: string | null }> = [];
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('tosogu_makers')
          .select('maker_id, name_romaji, school')
          .in('maker_id', batch);
        if (data) rows.push(...(data as typeof rows));
      }
      return rows;
    })(),
  ]);

  for (const row of smithResults) {
    result.set(row.smith_id, { name_romaji: row.name_romaji, school: row.school });
  }
  for (const row of tosoguResults) {
    if (!result.has(row.maker_id)) {
      result.set(row.maker_id, { name_romaji: row.name_romaji, school: row.school });
    }
  }

  return result;
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
export async function getStudents(code: string, nameRomaji: string | null): Promise<RelatedArtisan[]> {
  const selectFields = 'smith_id, name_romaji, name_kanji, school, kokuho_count, jubun_count, jubi_count, gyobutsu_count, juyo_count, tokuju_count, elite_factor';

  // Search by code match first
  const { data: byCode } = await yuhinkaiClient
    .from('smith_entities')
    .select(selectFields)
    .eq('teacher', code)
    .limit(20);

  const students: RelatedArtisan[] = (byCode || []).map(s => ({
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

  // Also search by name if available and got few results
  if (nameRomaji && students.length < 5) {
    const { data: byName } = await yuhinkaiClient
      .from('smith_entities')
      .select(selectFields)
      .eq('teacher', nameRomaji)
      .limit(20);

    const existingCodes = new Set(students.map(s => s.code));
    for (const s of byName || []) {
      if (!existingCodes.has(s.smith_id)) {
        students.push({
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
        });
      }
    }
  }

  // Sort by elite_factor descending
  students.sort((a, b) => b.elite_factor - a.elite_factor);

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
 * Calculate provenance factor percentile among artisans with provenance data.
 * Same pattern as getElitePercentile: count(below) / count(total with provenance).
 * Returns a value from 0 to 100 (higher = rarer provenance).
 */
export async function getProvenancePercentile(
  provenanceFactor: number,
  entityType: 'smith' | 'tosogu'
): Promise<number> {
  const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

  // Count how many have a lower provenance_factor
  const { count: below } = await yuhinkaiClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .lt('provenance_factor', provenanceFactor)
    .not('provenance_factor', 'is', null);

  const { count: total } = await yuhinkaiClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .not('provenance_factor', 'is', null);

  if (!total || total === 0) return 0;
  return Math.min(Math.round(((below || 0) / total) * 100), 100);
}

/**
 * Get elite factor distribution as histogram buckets.
 * Returns 100 buckets at 1% resolution (0–1%, 1–2%, …, 99–100%).
 * Only includes artisans with total_items > 0.
 */
export async function getEliteDistribution(
  entityType: 'smith' | 'tosogu'
): Promise<{ buckets: number[]; total: number }> {
  const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

  const { data, error } = await yuhinkaiClient
    .from(table)
    .select('elite_factor')
    .gt('total_items', 0);

  if (error || !data) {
    console.error('[Yuhinkai] Error fetching elite distribution:', error);
    return { buckets: Array(100).fill(0), total: 0 };
  }

  const buckets = Array(100).fill(0);
  for (const row of data) {
    const ef = row.elite_factor ?? 0;
    const idx = Math.min(Math.floor(ef * 100), 99);
    buckets[idx]++;
  }

  return { buckets, total: data.length };
}

/**
 * Get provenance factor distribution as histogram buckets.
 * Returns 100 buckets at 0.1 resolution (0–0.1, 0.1–0.2, …, 9.9–10.0).
 * Only includes artisans with a non-null provenance_factor.
 */
export async function getProvenanceDistribution(
  entityType: 'smith' | 'tosogu'
): Promise<{ buckets: number[]; total: number }> {
  const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

  const { data, error } = await yuhinkaiClient
    .from(table)
    .select('provenance_factor')
    .not('provenance_factor', 'is', null);

  if (error || !data) {
    console.error('[Yuhinkai] Error fetching provenance distribution:', error);
    return { buckets: Array(100).fill(0), total: 0 };
  }

  const buckets = Array(100).fill(0);
  for (const row of data) {
    const pf = row.provenance_factor ?? 0;
    const idx = Math.min(Math.floor(pf * 10), 99);
    buckets[idx]++;
  }

  return { buckets, total: data.length };
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
  provenance_factor: number | null;
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
  sort?: 'elite_factor' | 'provenance_factor' | 'name' | 'total_items' | 'for_sale';
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
 * Resolve a broad period name (e.g. "Muromachi") to the list of specific era
 * strings in the database that map to it. Fetches all distinct eras from the
 * given entity table and filters through eraToBroadPeriod().
 */
async function getErasForBroadPeriod(
  broadPeriod: string,
  table: 'smith_entities' | 'tosogu_makers'
): Promise<string[]> {
  const { data } = await yuhinkaiClient
    .from(table)
    .select('era')
    .gt('total_items', 0)
    .not('era', 'is', null);

  if (!data) return [];

  // Collect unique era strings that map to this broad period
  const matching = new Set<string>();
  for (const row of data) {
    const era = row.era as string;
    if (eraToBroadPeriod(era) === broadPeriod) {
      matching.add(era);
    }
  }

  return [...matching];
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
    .select(`${idCol}, name_romaji, name_kanji, school, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, provenance_factor, is_school_code`, { count: 'exact' });

  if (notable) query = query.gt('total_items', 0);
  if (school) query = query.eq('school', school);
  if (province) query = query.eq('province', province);

  // Era filter: resolve broad period name to matching specific era strings
  if (era) {
    const matchingEras = await getErasForBroadPeriod(era, table);
    if (matchingEras.length > 0) {
      query = query.in('era', matchingEras);
    } else {
      // No eras match this broad period — return empty
      return { artists: [], total: 0 };
    }
  }

  if (q) {
    query = query.or(`name_romaji.ilike.%${q}%,name_kanji.ilike.%${q}%,${idCol}.ilike.%${q}%,school.ilike.%${q}%,province.ilike.%${q}%,name_search_text.ilike.%${q}%`);
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
    provenance_factor: (row.provenance_factor as number) ?? null,
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

  // Pre-resolve broad period → specific eras once (reused across batches)
  let resolvedEras: string[] | null = null;

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    let query = yuhinkaiClient
      .from(table)
      .select(`${idCol}, name_romaji, name_kanji, school, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, provenance_factor, is_school_code`)
      .in(idCol, batch);

    if (filters.notable !== false) query = query.gt('total_items', 0);
    if (filters.school) query = query.eq('school', filters.school);
    if (filters.province) query = query.eq('province', filters.province);

    // Era filter: resolve broad period name to matching specific era strings
    if (filters.era) {
      if (!resolvedEras) {
        resolvedEras = await getErasForBroadPeriod(filters.era, table);
      }
      if (resolvedEras.length > 0) {
        query = query.in('era', resolvedEras);
      } else {
        continue; // No matching eras for this period — skip batch
      }
    }

    if (filters.q) {
      query = query.or(`name_romaji.ilike.%${filters.q}%,name_kanji.ilike.%${filters.q}%,${idCol}.ilike.%${filters.q}%,school.ilike.%${filters.q}%,province.ilike.%${filters.q}%,name_search_text.ilike.%${filters.q}%`);
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
        provenance_factor: (row.provenance_factor as number) ?? null,
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

  // Group specific eras into broad historical periods
  const eraMap = new Map<string, number>();
  for (const row of eras || []) {
    const e = row.era as string;
    const broad = eraToBroadPeriod(e);
    if (broad) {
      eraMap.set(broad, (eraMap.get(broad) || 0) + 1);
    }
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  // Sort eras chronologically instead of by count
  const eraSorted = Array.from(eraMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (PERIOD_ORDER[a.value] ?? 99) - (PERIOD_ORDER[b.value] ?? 99));

  return {
    schools: toSorted(schoolMap),
    provinces: toSorted(provinceMap),
    eras: eraSorted,
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

/**
 * For school codes, get all individual member codes from the relevant entity table.
 * Returns Map<schoolCode, memberCodes[]>.
 */
export async function getSchoolMemberCodes(
  schools: Array<{ code: string; school: string; entity_type: 'smith' | 'tosogu' }>
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (schools.length === 0) return result;

  // Deduplicate by school+type
  const uniqueSchools = new Map<string, { school: string; type: 'smith' | 'tosogu'; codes: string[] }>();
  for (const s of schools) {
    const key = `${s.entity_type}:${s.school}`;
    const entry = uniqueSchools.get(key);
    if (entry) {
      entry.codes.push(s.code);
    } else {
      uniqueSchools.set(key, { school: s.school, type: s.entity_type, codes: [s.code] });
    }
  }

  await Promise.all(
    Array.from(uniqueSchools.values()).map(async ({ school, type, codes }) => {
      const table = type === 'smith' ? 'smith_entities' : 'tosogu_makers';
      const idCol = type === 'smith' ? 'smith_id' : 'maker_id';

      const { data } = await yuhinkaiClient
        .from(table)
        .select(idCol)
        .eq('school', school)
        .eq('is_school_code', false);

      const memberCodes = (data || []).map((row: Record<string, unknown>) => row[idCol] as string);
      for (const code of codes) {
        result.set(code, memberCodes);
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

/**
 * Bulk-calculate provenance factor percentiles for a list of artists.
 * Same pattern as getBulkElitePercentiles but using provenance_factor.
 */
export async function getBulkProvenancePercentiles(
  artists: Array<{ code: string; provenance_factor: number | null; entity_type: 'smith' | 'tosogu' }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (artists.length === 0) return result;

  // Only process artists that have provenance data
  const withProvenance = artists.filter(a => a.provenance_factor != null);
  if (withProvenance.length === 0) return result;

  // Group by entity_type
  const byType = new Map<'smith' | 'tosogu', typeof withProvenance>();
  for (const a of withProvenance) {
    if (!byType.has(a.entity_type)) byType.set(a.entity_type, []);
    byType.get(a.entity_type)!.push(a);
  }

  const typePromises = Array.from(byType.entries()).map(async ([entityType, group]) => {
    const table = entityType === 'smith' ? 'smith_entities' : 'tosogu_makers';

    const { count: total } = await yuhinkaiClient
      .from(table)
      .select('*', { count: 'exact', head: true })
      .not('provenance_factor', 'is', null);

    if (!total || total === 0) {
      for (const a of group) result.set(a.code, 0);
      return;
    }

    const uniqueFactors = [...new Set(group.map(a => a.provenance_factor!))];

    const belowCounts = await Promise.all(
      uniqueFactors.map(async (factor) => {
        const { count: below } = await yuhinkaiClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .lt('provenance_factor', factor)
          .not('provenance_factor', 'is', null);
        return { factor, below: below || 0 };
      })
    );

    const factorToPercentile = new Map<number, number>();
    for (const { factor, below } of belowCounts) {
      factorToPercentile.set(factor, Math.min(Math.round((below / total) * 100), 100));
    }

    for (const a of group) {
      result.set(a.code, factorToPercentile.get(a.provenance_factor!) ?? 0);
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
export interface MeasurementsByForm {
  [formKey: string]: {
    nagasa: number[];
    sori: number[];
    motohaba: number[];
    sakihaba: number[];
  };
}

/** Row shape returned by the gold_values query in getArtisanDistributions */
export interface GoldValuesRow {
  gold_form_type: string | null;
  gold_mei_status: string | null;
  gold_collections: string[] | null;
  gold_nagasa: number | null;
  gold_sori: number | null;
  gold_motohaba: number | null;
  gold_sakihaba: number | null;
}

/**
 * Pure function: process gold_values rows into form/mei distributions + measurements.
 * Exported separately for testability — the JE_Koto exclusion logic lives here.
 */
export function processGoldValuesRows(
  rows: GoldValuesRow[],
  entityType: 'smith' | 'tosogu'
): {
  form_distribution: Record<string, number>;
  mei_distribution: Record<string, number>;
  measurements_by_form: MeasurementsByForm;
} | null {
  const form: Record<string, number> = {};
  const mei: Record<string, number> = {};
  const measurements: MeasurementsByForm = {};

  for (const row of rows) {
    // Skip orphaned JE_Koto records (JE_Koto is the ONLY collection) — unreliable data
    // without corroborating siblings. Records that also appear in Juyo/Tokuju/etc.
    // are fine: gold_form_type/gold_mei_status are synthesized from the best source.
    const collections = row.gold_collections;
    if (collections?.length === 1 && collections[0] === 'JE_Koto') continue;

    // Form distribution
    const rawForm = row.gold_form_type?.toLowerCase().trim() ?? null;
    let formKey: string | null = null;
    if (rawForm) {
      const SWORD_FORMS = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken', 'kodachi'];
      const TOSOGU_FORMS = ['tsuba', 'kozuka', 'kogai', 'menuki', 'fuchi', 'kashira', 'fuchi-kashira', 'mitokoromono', 'futatokoromono', 'soroimono'];
      const knownForms = entityType === 'smith' ? SWORD_FORMS : TOSOGU_FORMS;
      formKey = knownForms.includes(rawForm) ? rawForm : 'other';
      form[formKey] = (form[formKey] || 0) + 1;
    }

    // Collect measurements by form (smiths only — measurements are sword-specific)
    if (formKey && entityType === 'smith') {
      if (!measurements[formKey]) {
        measurements[formKey] = { nagasa: [], sori: [], motohaba: [], sakihaba: [] };
      }
      const m = measurements[formKey];
      if (row.gold_nagasa != null && row.gold_nagasa > 0) m.nagasa.push(row.gold_nagasa);
      if (row.gold_sori != null && row.gold_sori > 0) m.sori.push(row.gold_sori);
      if (row.gold_motohaba != null && row.gold_motohaba > 0) m.motohaba.push(row.gold_motohaba);
      if (row.gold_sakihaba != null && row.gold_sakihaba > 0) m.sakihaba.push(row.gold_sakihaba);
    }

    // Mei distribution — normalize to canonical keys
    const rawMei = row.gold_mei_status?.toLowerCase().trim() ?? null;
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

  return { form_distribution: form, mei_distribution: mei, measurements_by_form: measurements };
}

export async function getArtisanDistributions(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<{
  form_distribution: Record<string, number>;
  mei_distribution: Record<string, number>;
  measurements_by_form: MeasurementsByForm;
} | null> {
  // Query both columns — artisan code may be in either due to historical misrouting
  // (migration 290 fix). DO NOT revert to single-column .eq() query.
  const { data, error } = await yuhinkaiClient
    .from('gold_values')
    .select('gold_form_type, gold_mei_status, gold_collections, gold_nagasa, gold_sori, gold_motohaba, gold_sakihaba')
    .or(`gold_smith_id.eq.${code},gold_maker_id.eq.${code}`);

  if (error || !data || data.length === 0) return null;

  return processGoldValuesRows(data as GoldValuesRow[], entityType);
}

// =============================================================================
// HERO IMAGE (highest-designation catalog image for artist profiles)
// =============================================================================

/** Priority order: Tokuju has the nicest images, Jubi the worst */
const COLLECTION_PRIORITY: string[] = ['Tokuju', 'Juyo', 'Kokuho', 'JuBun', 'Jubi'];

/** Flat collections have no volume subdirectory */
const FLAT_COLLECTIONS = new Set(['Kokuho', 'JuBun']);

/** JuBun uses _combined.jpg instead of _oshigata.jpg */
const COMBINED_COLLECTIONS = new Set(['JuBun']);

/** Image storage is on a separate Supabase project from the database */
const IMAGE_STORAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_STORAGE_URL
  || 'https://itbhfhyptogxcjbjfzwx.supabase.co';

export interface ArtisanHeroImage {
  imageUrl: string;
  collection: string;       // e.g. 'Tokuju'
  volume: number;
  itemNumber: number;
  formType: string | null;  // e.g. 'Katana'
  imageType: string;        // e.g. 'oshigata' | 'combined'
}

/**
 * Build candidate Supabase Storage paths for a catalog image.
 * Returns multiple paths in priority order since not all image types
 * exist for every item (e.g. Jubi has oshigata for some volumes,
 * setsumei for others).
 *
 * Conventions (from oshi-v2 upload scripts):
 *   Kokuho (flat):   Kokuho/{item}_oshigata.jpg
 *   JuBun  (flat):   JuBun/{item}_combined.jpg
 *   Volume-based:    {Collection}/{volume}_{item}_{type}.jpg
 */
function buildStoragePaths(collection: string, volume: number, itemNumber: number): Array<{ path: string; imageType: string }> {
  if (FLAT_COLLECTIONS.has(collection)) {
    const suffix = COMBINED_COLLECTIONS.has(collection) ? 'combined' : 'oshigata';
    return [{ path: `${collection}/${itemNumber}_${suffix}.jpg`, imageType: suffix }];
  }
  // Volume-based: try oshigata first, then setsumei as fallback
  const base = `${collection}/${volume}_${itemNumber}`;
  return [
    { path: `${base}_oshigata.jpg`, imageType: 'oshigata' },
    { path: `${base}_setsumei.jpg`, imageType: 'setsumei' },
  ];
}

/**
 * Fetch the best catalog image for an artisan's profile hero.
 *
 * Selection heuristic:
 * 1. Walk collections in priority order (Tokuju → Juyo → Kokuho → JuBun → Jubi)
 * 2. Within each collection, pick the item with the MOST total records
 *    (catalog_records + linked_records — user-added photos, sayagaki, etc.)
 * 3. Construct public URL from the separate image storage Supabase project
 */
export async function getArtisanHeroImage(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<ArtisanHeroImage | null> {
  // 1. Get all objects for this artisan with their collections + form type
  // Query both columns — artisan code may be in either due to historical misrouting
  // (migration 290 fix). DO NOT revert to single-column .eq() query.
  const { data: goldRows, error } = await yuhinkaiClient
    .from('gold_values')
    .select('object_uuid, gold_collections, gold_form_type')
    .or(`gold_smith_id.eq.${code},gold_maker_id.eq.${code}`);

  if (error || !goldRows || goldRows.length === 0) return null;

  // 2. Walk collections in priority order
  for (const targetCollection of COLLECTION_PRIORITY) {
    const matchingUuids: string[] = [];
    const formTypeMap = new Map<string, string | null>();

    for (const row of goldRows) {
      const collections = row.gold_collections as string[] | null;
      if (collections?.includes(targetCollection)) {
        const uuid = row.object_uuid as string;
        matchingUuids.push(uuid);
        formTypeMap.set(uuid, row.gold_form_type as string | null);
      }
    }

    if (matchingUuids.length === 0) continue;

    // 3. Count ALL associated records per object (catalog_records + linked_records)
    //    to find the most data-rich item (user-added photos, sayagaki, etc.)
    const [{ data: allCatalog }, { data: allLinked }] = await Promise.all([
      yuhinkaiClient
        .from('catalog_records')
        .select('object_uuid')
        .in('object_uuid', matchingUuids),
      yuhinkaiClient
        .from('linked_records')
        .select('object_uuid')
        .in('object_uuid', matchingUuids),
    ]);

    // Count total records per object (catalog + user-added)
    const siblingCounts = new Map<string, number>();
    for (const row of allCatalog || []) {
      const uuid = row.object_uuid as string;
      siblingCounts.set(uuid, (siblingCounts.get(uuid) || 0) + 1);
    }
    for (const row of allLinked || []) {
      const uuid = row.object_uuid as string;
      siblingCounts.set(uuid, (siblingCounts.get(uuid) || 0) + 1);
    }

    // Sort matching objects by sibling count descending
    const ranked = matchingUuids
      .map(uuid => ({ uuid, siblings: siblingCounts.get(uuid) || 0 }))
      .sort((a, b) => b.siblings - a.siblings);

    // 4. For the richest object, get the catalog record in the target collection
    for (const { uuid } of ranked) {
      const { data: catalogRecords } = await yuhinkaiClient
        .from('catalog_records')
        .select('object_uuid, collection, volume, item_number')
        .eq('object_uuid', uuid)
        .eq('collection', targetCollection)
        .limit(1);

      if (!catalogRecords || catalogRecords.length === 0) continue;

      const record = catalogRecords[0];
      const candidates = buildStoragePaths(
        record.collection,
        record.volume,
        record.item_number
      );

      // 5. Try each candidate path — verify image exists in storage
      for (const { path, imageType } of candidates) {
        const imageUrl = `${IMAGE_STORAGE_BASE}/storage/v1/object/public/images/${path}`;
        try {
          const head = await fetch(imageUrl, { method: 'HEAD' });
          if (!head.ok) continue;
        } catch {
          continue;
        }

        return {
          imageUrl,
          collection: targetCollection,
          volume: record.volume,
          itemNumber: record.item_number,
          formType: formTypeMap.get(record.object_uuid) || null,
          imageType,
        };
      }
    }
  }

  return null;
}

/**
 * In-memory hero image cache with TTL.
 * Hero images are derived from the Yuhinkai catalog which rarely changes,
 * so a 1-hour TTL eliminates ~750-1000 DB queries + ~75 HTTP HEAD requests
 * per uncached directory page load.
 */
const heroImageCache = new Map<string, { url: string | null; expiresAt: number }>();
const HERO_IMAGE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedHeroImage(code: string): { url: string | null; hit: boolean } {
  const entry = heroImageCache.get(code);
  if (entry && Date.now() < entry.expiresAt) {
    return { url: entry.url, hit: true };
  }
  return { url: null, hit: false };
}

function setCachedHeroImage(code: string, url: string | null): void {
  heroImageCache.set(code, { url, expiresAt: Date.now() + HERO_IMAGE_TTL_MS });
}

/**
 * Batch-fetch hero image URLs for multiple artisans.
 *
 * Delegates to getArtisanHeroImage() for each artisan in parallel to guarantee
 * identical image selection between directory thumbnails and profile hero images.
 * Results are cached in-memory for 1 hour to avoid repeated DB+HEAD requests.
 *
 * Previous batch-optimized implementation used .limit(5000) on bulk queries
 * which truncated data across artisans, causing different images to be selected
 * for the directory vs profile page.  Delegating to the single-artist function
 * is "correct by construction" — both paths execute the exact same code.
 */
export async function getBulkArtisanHeroImages(
  artists: Array<{ code: string; entityType: 'smith' | 'tosogu' }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (artists.length === 0) return result;

  // Separate cached hits from misses
  const misses: Array<{ code: string; entityType: 'smith' | 'tosogu' }> = [];
  for (const artist of artists) {
    const cached = getCachedHeroImage(artist.code);
    if (cached.hit) {
      if (cached.url) result.set(artist.code, cached.url);
    } else {
      misses.push(artist);
    }
  }

  // Fetch only cache misses
  if (misses.length > 0) {
    const images = await Promise.all(
      misses.map(async ({ code, entityType }) => {
        const heroImage = await getArtisanHeroImage(code, entityType);
        const url = heroImage?.imageUrl ?? null;
        setCachedHeroImage(code, url);
        return { code, url };
      })
    );

    for (const { code, url } of images) {
      if (url) result.set(code, url);
    }
  }

  return result;
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
// CATALOGUE PUBLICATIONS (user-published objects → NihontoWatch artist pages)
// =============================================================================

export interface CatalogueImage {
  url: string;
  type: 'oshigata' | 'sugata' | 'art' | 'detail' | 'other' | 'photo';
  category: 'catalog' | 'photo' | 'cover' | 'sayagaki' | 'provenance';
  width?: number;
  height?: number;
}

export interface CatalogueEntry {
  objectUuid: string;
  collection: string;        // "Juyo", "Tokuju", etc.
  volume: number;
  itemNumber: number;
  formType: string | null;

  images: CatalogueImage[];  // Whitelisted only (no setsumei)
  coverImage: CatalogueImage | null;  // From cover_image linked_record

  sayagakiEn: string | null;
  provenanceEn: string | null;
  curatorNote: string | null;

  contributor: {
    displayName: string;
    avatarUrl: string | null;
  };

  publishedAt: string;
}

/** Collection prestige order for sorting */
const CATALOGUE_COLLECTION_PRESTIGE: Record<string, number> = {
  'Tokuju': 0,
  'Juyo': 1,
  'Kokuho': 2,
  'JuBun': 3,
  'Jubi': 4,
};

/** Yuhinkai Supabase URL for avatar/image construction */
const YUHINKAI_STORAGE_BASE = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';

/**
 * Fetch published catalogue entries for an artisan, for display on the
 * NihontoWatch artist profile page.
 *
 * Query chain:
 * 1. gold_values → get object UUIDs for this artisan
 * 2. catalogue_publications → filter to published objects
 * 3. For each: catalog_records, stored_images (no setsumei), linked_records (whitelisted types), user_profiles
 *
 * Whitelist enforced in code (service role key bypasses RLS):
 * - Images: image_type != 'setsumei'
 * - Text: only content_en (never content_jp)
 * - Record types: only 'photo', 'sayagaki', 'provenance'
 */
export async function getPublishedCatalogueEntries(
  artisanCode: string,
  entityType: 'smith' | 'tosogu'
): Promise<CatalogueEntry[]> {
  // Query BOTH gold_smith_id and gold_maker_id — an artisan's objects may span
  // both columns (e.g. a tosogu maker with swords, or a smith with tsuba).
  // The synthesize pipeline assigns the code to one column based on item form,
  // so we need to check both to capture all attributed objects.
  const { data: goldRows, error: goldErr } = await yuhinkaiClient
    .from('gold_values')
    .select('object_uuid, gold_form_type')
    .or(`gold_smith_id.eq.${artisanCode},gold_maker_id.eq.${artisanCode}`);

  if (goldErr || !goldRows || goldRows.length === 0) return [];

  const uuids = goldRows.map(r => r.object_uuid as string);
  const formTypeByUuid = new Map<string, string | null>();
  for (const r of goldRows) {
    formTypeByUuid.set(r.object_uuid as string, r.gold_form_type as string | null);
  }

  // 2. Filter to published objects
  const BATCH_SIZE = 200;
  const publications: Array<{ object_uuid: string; published_by: string; published_at: string; note: string | null }> = [];

  for (let i = 0; i < uuids.length; i += BATCH_SIZE) {
    const batch = uuids.slice(i, i + BATCH_SIZE);
    const { data } = await yuhinkaiClient
      .from('catalogue_publications')
      .select('object_uuid, published_by, published_at, note')
      .in('object_uuid', batch);
    if (data) publications.push(...(data as typeof publications));
  }

  if (publications.length === 0) return [];

  const publishedUuids = publications.map(p => p.object_uuid);
  const pubByUuid = new Map(publications.map(p => [p.object_uuid, p]));

  // 3. Fetch associated data in parallel for all published objects
  const [catalogRecords, storedImages, linkedRecords, userProfiles] = await Promise.all([
    // Catalog records (to find collection/volume/item)
    (async () => {
      const rows: Array<{ object_uuid: string; collection: string; volume: number; item_number: number }> = [];
      for (let i = 0; i < publishedUuids.length; i += BATCH_SIZE) {
        const batch = publishedUuids.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('catalog_records')
          .select('object_uuid, collection, volume, item_number')
          .in('object_uuid', batch);
        if (data) rows.push(...(data as typeof rows));
      }
      return rows;
    })(),

    // Stored images (catalog-level: oshigata, sugata, art, detail, other — NOT setsumei)
    (async () => {
      const rows: Array<{ object_uuid: string; storage_path: string; image_type: string; width: number | null; height: number | null }> = [];
      for (let i = 0; i < publishedUuids.length; i += BATCH_SIZE) {
        const batch = publishedUuids.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('stored_images')
          .select('object_uuid, storage_path, image_type, width, height')
          .in('object_uuid', batch)
          .neq('image_type', 'setsumei')
          .eq('is_current', true);
        if (data) rows.push(...(data as typeof rows));
      }
      return rows;
    })(),

    // Linked records (whitelisted types only: photo, sayagaki, provenance)
    (async () => {
      const rows: Array<{ object_uuid: string; type: string; content_en: string | null; image_ids: string[] | null }> = [];
      for (let i = 0; i < publishedUuids.length; i += BATCH_SIZE) {
        const batch = publishedUuids.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('linked_records')
          .select('object_uuid, type, content_en, image_ids')
          .in('object_uuid', batch)
          .in('type', ['photo', 'cover_image', 'sayagaki', 'provenance']);
        if (data) rows.push(...(data as typeof rows));
      }
      return rows;
    })(),

    // User profiles for contributors
    (async () => {
      const userIds = [...new Set(publications.map(p => p.published_by))];
      const profiles = new Map<string, { pseudonym: string | null; display_name: string | null; avatar_url: string | null }>();
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const { data } = await yuhinkaiClient
          .from('user_profiles')
          .select('id, pseudonym, display_name, avatar_url')
          .in('id', batch);
        if (data) {
          for (const row of data) {
            profiles.set(row.id as string, {
              pseudonym: row.pseudonym as string | null,
              display_name: row.display_name as string | null,
              avatar_url: row.avatar_url as string | null,
            });
          }
        }
      }
      return profiles;
    })(),
  ]);

  // 4. Fetch stored_images for ALL linked_records with image_ids (photo, cover_image, sayagaki, provenance)
  const allLinkedImageIds: Array<{ id: string; category: CatalogueImage['category'] }> = [];
  for (const lr of linkedRecords) {
    if (lr.image_ids && lr.image_ids.length > 0) {
      const cat: CatalogueImage['category'] = lr.type === 'photo' ? 'photo'
        : lr.type === 'cover_image' ? 'cover'
        : lr.type === 'sayagaki' ? 'sayagaki'
        : 'provenance';
      for (const id of lr.image_ids) {
        allLinkedImageIds.push({ id, category: cat });
      }
    }
  }

  const linkedImagesById = new Map<string, { storage_path: string; image_type: string; width: number | null; height: number | null; category: CatalogueImage['category'] }>();
  if (allLinkedImageIds.length > 0) {
    const uniqueIds = [...new Set(allLinkedImageIds.map(i => i.id))];
    const categoryById = new Map(allLinkedImageIds.map(i => [i.id, i.category]));
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const batch = uniqueIds.slice(i, i + BATCH_SIZE);
      const { data } = await yuhinkaiClient
        .from('stored_images')
        .select('id, storage_path, image_type, width, height')
        .in('id', batch)
        .eq('is_current', true);
      if (data) {
        for (const row of data) {
          linkedImagesById.set(row.id as string, {
            storage_path: row.storage_path as string,
            image_type: row.image_type as string,
            width: row.width as number | null,
            height: row.height as number | null,
            category: categoryById.get(row.id as string) || 'photo',
          });
        }
      }
    }
  }

  // 5. Group data by object UUID and pick highest-prestige catalog record
  const catalogByUuid = new Map<string, Array<{ collection: string; volume: number; item_number: number }>>();
  for (const cr of catalogRecords) {
    if (!catalogByUuid.has(cr.object_uuid)) catalogByUuid.set(cr.object_uuid, []);
    catalogByUuid.get(cr.object_uuid)!.push({ collection: cr.collection, volume: cr.volume, item_number: cr.item_number });
  }

  // Helper: user-uploaded images (records/ prefix) live on Yuhinkai storage,
  // traditional catalog images (Tokuju/6_18_*.jpg) live on the separate image storage project
  const resolveImageUrl = (storagePath: string) => {
    const base = storagePath.startsWith('records/') ? YUHINKAI_STORAGE_BASE : IMAGE_STORAGE_BASE;
    return `${base}/storage/v1/object/public/images/${storagePath}`;
  };

  const imagesByUuid = new Map<string, CatalogueImage[]>();
  for (const si of storedImages) {
    if (!imagesByUuid.has(si.object_uuid)) imagesByUuid.set(si.object_uuid, []);
    imagesByUuid.get(si.object_uuid)!.push({
      url: resolveImageUrl(si.storage_path),
      type: si.image_type as CatalogueImage['type'],
      category: 'catalog',
      width: si.width ?? undefined,
      height: si.height ?? undefined,
    });
  }

  // Add images from linked_records (photo, cover, sayagaki, provenance)
  for (const lr of linkedRecords) {
    if (lr.image_ids) {
      for (const imgId of lr.image_ids) {
        const img = linkedImagesById.get(imgId);
        if (img) {
          if (!imagesByUuid.has(lr.object_uuid)) imagesByUuid.set(lr.object_uuid, []);
          imagesByUuid.get(lr.object_uuid)!.push({
            url: resolveImageUrl(img.storage_path),
            type: img.image_type as CatalogueImage['type'],
            category: img.category,
            width: img.width ?? undefined,
            height: img.height ?? undefined,
          });
        }
      }
    }
  }

  // Collect text fields by object UUID
  const sayagakiByUuid = new Map<string, string>();
  const provenanceByUuid = new Map<string, string>();
  for (const lr of linkedRecords) {
    if (!lr.content_en) continue;
    if (lr.type === 'sayagaki' && !sayagakiByUuid.has(lr.object_uuid)) {
      sayagakiByUuid.set(lr.object_uuid, lr.content_en);
    }
    if (lr.type === 'provenance' && !provenanceByUuid.has(lr.object_uuid)) {
      provenanceByUuid.set(lr.object_uuid, lr.content_en);
    }
  }

  // 6. Assemble CatalogueEntry[] sorted by collection prestige
  const entries: CatalogueEntry[] = [];

  for (const uuid of publishedUuids) {
    const pub = pubByUuid.get(uuid)!;
    const catalogs = catalogByUuid.get(uuid) || [];

    // Pick highest-prestige catalog record
    catalogs.sort((a, b) =>
      (CATALOGUE_COLLECTION_PRESTIGE[a.collection] ?? 99) - (CATALOGUE_COLLECTION_PRESTIGE[b.collection] ?? 99)
    );
    const bestCatalog = catalogs[0];
    if (!bestCatalog) continue; // No catalog record — skip

    const profile = userProfiles.get(pub.published_by);
    const displayName = profile?.pseudonym || profile?.display_name || 'Member';
    const avatarUrl = profile?.avatar_url
      ? `${YUHINKAI_STORAGE_BASE}/storage/v1/render/image/public/images/${profile.avatar_url}?width=64&height=64&resize=cover&quality=80`
      : null;

    const allImages = imagesByUuid.get(uuid) || [];
    const coverImage = allImages.find(img => img.category === 'cover') || null;

    entries.push({
      objectUuid: uuid,
      collection: bestCatalog.collection,
      volume: bestCatalog.volume,
      itemNumber: bestCatalog.item_number,
      formType: formTypeByUuid.get(uuid) || null,
      images: allImages,
      coverImage,
      sayagakiEn: sayagakiByUuid.get(uuid) || null,
      provenanceEn: provenanceByUuid.get(uuid) || null,
      curatorNote: pub.note || null,
      contributor: { displayName, avatarUrl },
      publishedAt: pub.published_at,
    });
  }

  // Sort by collection prestige
  entries.sort((a, b) =>
    (CATALOGUE_COLLECTION_PRESTIGE[a.collection] ?? 99) - (CATALOGUE_COLLECTION_PRESTIGE[b.collection] ?? 99)
  );

  return entries;
}

// =============================================================================
// DENRAI (PROVENANCE) QUERIES
// =============================================================================

export interface DenraiResult {
  owners: Array<{ owner: string; count: number }>;
  itemCount: number;  // unique items with provenance data
  canonicalMap: Map<string, { parent: string | null; category: string | null }>;
}

/**
 * Deduplicate owners within a single item using category-based rules.
 *
 * Groups owners by parentMap groupKey, then:
 * 1. If a group has any child (owner != groupKey), remove the generic parent entry
 * 2. Among children, if both 'person' and 'family' categories exist, remove 'family' entries
 * 3. Different people in the same family are kept (legitimate provenance)
 * 4. Everything else (institution, shrine, uncategorized) preserved
 */
export function dedupWithinItem(
  owners: string[],
  canonicalMap: Map<string, { parent: string | null; category: string | null }>
): string[] {
  // Group owners by groupKey = parent || self
  const groups = new Map<string, Array<{ owner: string; category: string | null }>>();

  for (const owner of owners) {
    const info = canonicalMap.get(owner);
    const groupKey = info?.parent || owner;
    const category = info?.category || null;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push({ owner, category });
  }

  const result: string[] = [];

  for (const [groupKey, members] of groups) {
    // Check if any member is a child (owner !== groupKey)
    const hasChild = members.some(m => m.owner !== groupKey);

    let filtered = members;

    // Rule 1: Remove generic parent if any child exists
    if (hasChild) {
      filtered = filtered.filter(m => m.owner !== groupKey);
    }

    // Rule 2: Person trumps family within the same group
    const hasPerson = filtered.some(m => m.category === 'person');
    const hasFamily = filtered.some(m => m.category === 'family');
    if (hasPerson && hasFamily) {
      filtered = filtered.filter(m => m.category !== 'family');
    }

    // Rules 3 & 4: Keep all remaining
    for (const m of filtered) {
      result.push(m.owner);
    }
  }

  return result;
}

/**
 * Fetch denrai (provenance) owner data for an artisan by entity code.
 * Queries gold_values by gold_smith_id or gold_maker_id for reliable matching,
 * unnests gold_denrai_owners in JS, deduplicates within each item using
 * category-based rules, and aggregates counts per owner.
 *
 * Returns DenraiResult with deduped owner counts, item count, and canonical map
 * (reusable by getDenraiGrouped to avoid duplicate queries).
 */
export async function getDenraiForArtisan(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<DenraiResult> {
  // Query both columns — artisan code may be in either due to historical misrouting
  // (migration 290 fix). DO NOT revert to single-column .eq() query.
  const { data, error } = await yuhinkaiClient
    .from('gold_values')
    .select('gold_denrai_owners, gold_collections')
    .or(`gold_smith_id.eq.${code},gold_maker_id.eq.${code}`)
    .not('gold_denrai_owners', 'is', null);

  if (error) {
    console.error('[Yuhinkai] Denrai query error:', error);
    return { owners: [], itemCount: 0, canonicalMap: new Map() };
  }

  if (!data || data.length === 0) {
    return { owners: [], itemCount: 0, canonicalMap: new Map() };
  }

  // Phase 1: Collect all unique owner names across all rows
  const allOwnerNames = new Set<string>();
  for (const row of data) {
    const owners = row.gold_denrai_owners as string[];
    if (!owners || !Array.isArray(owners)) continue;
    for (const owner of owners) {
      const trimmed = owner.trim();
      if (trimmed) allOwnerNames.add(trimmed);
    }
  }

  if (allOwnerNames.size === 0) {
    return { owners: [], itemCount: data.length, canonicalMap: new Map() };
  }

  // Phase 2: Fetch canonical_name, parent_canonical, category from denrai_canonical_names
  const canonicalMap = new Map<string, { parent: string | null; category: string | null }>();
  const ownerNameArray = [...allOwnerNames];
  const BATCH_SIZE = 200;

  for (let i = 0; i < ownerNameArray.length; i += BATCH_SIZE) {
    const batch = ownerNameArray.slice(i, i + BATCH_SIZE);
    const { data: mappings } = await yuhinkaiClient
      .from('denrai_canonical_names')
      .select('canonical_name, parent_canonical, category')
      .in('canonical_name', batch);

    if (mappings) {
      for (const row of mappings) {
        if (row.canonical_name) {
          canonicalMap.set(row.canonical_name, {
            parent: row.parent_canonical || null,
            category: row.category || null,
          });
        }
      }
    }
  }

  // Phase 3: For each row, deduplicate within-item, then count into ownerMap
  const ownerMap = new Map<string, number>();

  for (const row of data) {
    // JE_Koto records ARE included for provenance — denrai data is reliable even from JE_Koto

    const owners = row.gold_denrai_owners as string[];
    if (!owners || !Array.isArray(owners)) continue;

    // Deduplicate names within this row first
    const seen = new Set<string>();
    const uniqueOwners: string[] = [];
    for (const owner of owners) {
      const trimmed = owner.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        uniqueOwners.push(trimmed);
      }
    }

    // Apply within-item dedup rules (person trumps family, etc.)
    const deduped = dedupWithinItem(uniqueOwners, canonicalMap);

    // Count each deduped owner once per item (skip non-provenance noise)
    for (const owner of deduped) {
      const info = canonicalMap.get(owner);
      if (info?.category === 'non_provenance') continue;
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    }
  }

  // Convert to sorted array, all owners
  const sortedOwners = Array.from(ownerMap.entries())
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count);

  return { owners: sortedOwners, itemCount: data.length, canonicalMap };
}

// =============================================================================
// DENRAI GROUPED (FAMILY HIERARCHY)
// =============================================================================

export type DenraiGroup = {
  parent: string;
  totalCount: number;
  children: Array<{ owner: string; count: number }>;
  isGroup: boolean;
};

/**
 * Fetch denrai data grouped by family hierarchy using parent_canonical
 * from denrai_canonical_names. Families with 2+ members collapse into
 * a single group; singletons render flat.
 *
 * If precomputed DenraiResult is provided, uses its owners + canonicalMap
 * directly (zero extra queries). Otherwise calls getDenraiForArtisan internally.
 */
export async function getDenraiGrouped(
  code: string,
  entityType: 'smith' | 'tosogu',
  precomputed?: DenraiResult
): Promise<DenraiGroup[]> {
  const denraiResult = precomputed || await getDenraiForArtisan(code, entityType);
  const { owners: flat, canonicalMap } = denraiResult;
  if (flat.length === 0) return [];

  // Build parent map from canonicalMap
  const parentMap = new Map<string, string>();
  for (const [name, info] of canonicalMap) {
    if (info.parent) {
      parentMap.set(name, info.parent);
    }
  }

  // Group by parent_canonical (or self if no parent)
  const groupMap = new Map<string, Array<{ owner: string; count: number }>>();
  for (const d of flat) {
    const parent = parentMap.get(d.owner) || d.owner;
    if (!groupMap.has(parent)) groupMap.set(parent, []);
    groupMap.get(parent)!.push(d);
  }

  // Build DenraiGroup array
  const groups: DenraiGroup[] = [];
  for (const [parent, children] of groupMap) {
    const totalCount = children.reduce((sum, c) => sum + c.count, 0);
    // Sort children by count desc within group
    children.sort((a, b) => b.count - a.count);
    groups.push({
      parent,
      totalCount,
      children,
      isGroup: children.length > 1,
    });
  }

  // Sort groups by totalCount desc
  groups.sort((a, b) => b.totalCount - a.totalCount);
  return groups;
}
