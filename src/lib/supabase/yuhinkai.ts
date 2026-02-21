import { createClient } from '@supabase/supabase-js';
import { eraToBroadPeriod, PERIOD_ORDER } from '@/lib/artisan/eraPeriods';

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

/**
 * Unified artisan entity from artisan_makers / artisan_schools tables.
 * Sourced from `artisan_makers` (individual artisans) or `artisan_schools` (NS-* codes).
 */
export interface ArtisanEntity {
  // Identity
  maker_id: string;
  name_kanji: string | null;
  name_romaji: string | null;
  province: string | null;
  school: string | null;        // legacy_school_text for makers, name_romaji for schools
  era: string | null;
  period: string | null;
  generation: string | null;
  teacher: string | null;       // teacher_text for makers

  // Domain + type derivation
  domain: 'sword' | 'tosogu' | 'both';
  entity_type: 'smith' | 'tosogu';  // derived: sword|both → smith, tosogu → tosogu
  is_school_code: boolean;           // derived: false for artisan_makers, true for artisan_schools

  // Smith-only (nullable for tosogu)
  hawley: number | null;
  fujishiro: string | null;
  toko_taikan: number | null;

  // Tosogu-only (nullable for smiths)
  specialties: string[] | null;

  // Certification counts
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_count: number;
  elite_factor: number;

  // Provenance
  provenance_factor: number | null;
  provenance_count: number | null;
  provenance_apex: number | null;

  // Teacher link (FK)
  teacher_id: string | null;
}

/**
 * Map artisan_makers `domain` column to entity_type.
 */
function domainToEntityType(domain: string): 'smith' | 'tosogu' {
  return domain === 'tosogu' ? 'tosogu' : 'smith';
}

/**
 * Map entity_type to domain filter values for artisan_makers queries.
 */
function getDomainFilter(entityType: 'smith' | 'tosogu'): string[] {
  return entityType === 'smith' ? ['sword', 'both'] : ['tosogu', 'both'];
}

/**
 * Fetch a single artisan by code from artisan_makers (or artisan_schools for NS-* codes).
 * Fetch a single artisan by code.
 */
export async function getArtisan(code: string): Promise<ArtisanEntity | null> {
  if (code.startsWith('NS-')) {
    // School codes live in artisan_schools
    const { data, error } = await yuhinkaiClient
      .from('artisan_schools')
      .select('school_id, name_romaji, name_kanji, domain, province, era_start, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_count, elite_factor, provenance_factor, provenance_count, provenance_apex')
      .eq('school_id', code)
      .single();

    if (error || !data) return null;

    return {
      maker_id: data.school_id,
      name_kanji: data.name_kanji,
      name_romaji: data.name_romaji,
      province: data.province,
      school: data.name_romaji,   // school name IS the name for school codes
      era: data.era_start,
      period: null,
      generation: null,
      teacher: null,
      domain: data.domain || 'sword',
      entity_type: domainToEntityType(data.domain || 'sword'),
      is_school_code: true,
      hawley: null,
      fujishiro: null,
      toko_taikan: null,
      specialties: null,
      kokuho_count: data.kokuho_count || 0,
      jubun_count: data.jubun_count || 0,
      jubi_count: data.jubi_count || 0,
      gyobutsu_count: data.gyobutsu_count || 0,
      tokuju_count: data.tokuju_count || 0,
      juyo_count: data.juyo_count || 0,
      total_items: data.total_items || 0,
      elite_count: data.elite_count || 0,
      elite_factor: data.elite_factor || 0,
      provenance_factor: data.provenance_factor ?? null,
      provenance_count: data.provenance_count ?? null,
      provenance_apex: data.provenance_apex ?? null,
      teacher_id: null,
    };
  }

  // Individual makers in artisan_makers
  const { data, error } = await yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, domain, province, era, period, generation, teacher_text, teacher_id, legacy_school_text, hawley, fujishiro, toko_taikan, specialties, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_count, elite_factor, provenance_factor, provenance_count, provenance_apex')
    .eq('maker_id', code)
    .single();

  if (error || !data) return null;

  return {
    maker_id: data.maker_id,
    name_kanji: data.name_kanji,
    name_romaji: data.name_romaji,
    province: data.province,
    school: data.legacy_school_text,
    era: data.era,
    period: data.period,
    generation: data.generation,
    teacher: data.teacher_text,
    domain: data.domain || 'sword',
    entity_type: domainToEntityType(data.domain || 'sword'),
    is_school_code: false,
    hawley: data.hawley,
    fujishiro: data.fujishiro,
    toko_taikan: data.toko_taikan,
    specialties: data.specialties,
    kokuho_count: data.kokuho_count || 0,
    jubun_count: data.jubun_count || 0,
    jubi_count: data.jubi_count || 0,
    gyobutsu_count: data.gyobutsu_count || 0,
    tokuju_count: data.tokuju_count || 0,
    juyo_count: data.juyo_count || 0,
    total_items: data.total_items || 0,
    elite_count: data.elite_count || 0,
    elite_factor: data.elite_factor || 0,
    provenance_factor: data.provenance_factor ?? null,
    provenance_count: data.provenance_count ?? null,
    provenance_apex: data.provenance_apex ?? null,
    teacher_id: data.teacher_id,
  };
}

export async function getAiDescription(code: string): Promise<string | null> {
  // School codes (NS-*) live in artisan_schools; individual makers in artisan_makers
  if (code.startsWith('NS-')) {
    const { data, error } = await yuhinkaiClient
      .from('artisan_schools')
      .select('ai_description')
      .eq('school_id', code)
      .single();
    if (error || !data?.ai_description) return null;
    return data.ai_description as string;
  }

  const { data, error } = await yuhinkaiClient
    .from('artisan_makers')
    .select('ai_description')
    .eq('maker_id', code)
    .single();

  if (error || !data?.ai_description) return null;
  return data.ai_description as string;
}


// =============================================================================
// ARTISAN CODE RESOLUTION (for text search → artisan_id matching)
// =============================================================================

/**
 * Resolve human-readable artisan names to Yuhinkai artisan codes.
 *
 * Given text words (e.g., ['norishige'] or ['rai', 'kunimitsu']), queries
 * artisan_makers for matching name_romaji, name_kanji, or school.
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
    // Single query to artisan_makers
    let query = yuhinkaiClient
      .from('artisan_makers')
      .select('maker_id');

    for (const word of textWords) {
      query = query.or(`name_romaji.ilike.%${word}%,name_kanji.ilike.%${word}%,legacy_school_text.ilike.%${word}%,name_romaji_normalized.ilike.%${word}%`);
    }

    const { data } = await query.limit(100);
    return (data || []).map((r: { maker_id: string }) => r.maker_id);
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
 * Batch-fetches artisan names from artisan_makers (and artisan_schools for NS-* codes).
 * Used by browse/listing APIs to enrich badges with display names.
 */
export interface ArtisanNameEntry {
  name_romaji: string | null;
  school: string | null;
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
}

export async function getArtisanNames(
  codes: string[]
): Promise<Map<string, ArtisanNameEntry>> {
  const result = new Map<string, ArtisanNameEntry>();
  if (codes.length === 0) return result;

  const BATCH_SIZE = 200;
  const selectFields = 'maker_id, name_romaji, legacy_school_text, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count';

  // Split codes: NS-* go to artisan_schools, others to artisan_makers
  const nsCodes = codes.filter(c => c.startsWith('NS-'));
  const makerCodes = codes.filter(c => !c.startsWith('NS-'));

  // Query artisan_makers for individual maker codes
  for (let i = 0; i < makerCodes.length; i += BATCH_SIZE) {
    const batch = makerCodes.slice(i, i + BATCH_SIZE);
    const { data } = await yuhinkaiClient
      .from('artisan_makers')
      .select(selectFields)
      .in('maker_id', batch);
    for (const row of data || []) {
      result.set(row.maker_id, {
        name_romaji: row.name_romaji,
        school: row.legacy_school_text,
        kokuho_count: row.kokuho_count || 0,
        jubun_count: row.jubun_count || 0,
        jubi_count: row.jubi_count || 0,
        gyobutsu_count: row.gyobutsu_count || 0,
        tokuju_count: row.tokuju_count || 0,
        juyo_count: row.juyo_count || 0,
      });
    }
  }

  // Query artisan_schools for NS-* codes
  for (let i = 0; i < nsCodes.length; i += BATCH_SIZE) {
    const batch = nsCodes.slice(i, i + BATCH_SIZE);
    const { data } = await yuhinkaiClient
      .from('artisan_schools')
      .select('school_id, name_romaji, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count')
      .in('school_id', batch);
    for (const row of data || []) {
      if (!result.has(row.school_id)) {
        result.set(row.school_id, {
          name_romaji: row.name_romaji,
          school: row.name_romaji,  // school name IS the name for school codes
          kokuho_count: row.kokuho_count || 0,
          jubun_count: row.jubun_count || 0,
          jubi_count: row.jubi_count || 0,
          gyobutsu_count: row.gyobutsu_count || 0,
          tokuju_count: row.tokuju_count || 0,
          juyo_count: row.juyo_count || 0,
        });
      }
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
 * Find students of a given artisan.
 * 1. Query artisan_teacher_links for teacher_id = code → get student maker_ids
 * 2. Batch-fetch student details from artisan_makers
 * 3. Fallback: artisan_makers WHERE teacher_text = nameRomaji (for sparse data)
 */
export async function getStudents(code: string, nameRomaji: string | null): Promise<RelatedArtisan[]> {
  const selectFields = 'maker_id, name_romaji, name_kanji, legacy_school_text, kokuho_count, jubun_count, jubi_count, gyobutsu_count, juyo_count, tokuju_count, elite_factor';

  // 1. Query artisan_teacher_links junction table
  const { data: links } = await yuhinkaiClient
    .from('artisan_teacher_links')
    .select('student_id')
    .eq('teacher_id', code)
    .limit(30);

  const studentIds = (links || []).map(l => l.student_id as string);
  const students: RelatedArtisan[] = [];
  const existingCodes = new Set<string>();

  // 2. Batch-fetch student details from artisan_makers
  if (studentIds.length > 0) {
    const { data: byLinks } = await yuhinkaiClient
      .from('artisan_makers')
      .select(selectFields)
      .in('maker_id', studentIds);

    for (const s of byLinks || []) {
      students.push({
        code: s.maker_id,
        name_romaji: s.name_romaji,
        name_kanji: s.name_kanji,
        school: s.legacy_school_text,
        kokuho_count: s.kokuho_count || 0,
        jubun_count: s.jubun_count || 0,
        jubi_count: s.jubi_count || 0,
        gyobutsu_count: s.gyobutsu_count || 0,
        juyo_count: s.juyo_count || 0,
        tokuju_count: s.tokuju_count || 0,
        elite_factor: s.elite_factor || 0,
      });
      existingCodes.add(s.maker_id);
    }
  }

  // 3. Fallback: search by teacher_text for artisans not in junction table
  if (students.length < 5) {
    // Try code match first
    const { data: byTeacherCode } = await yuhinkaiClient
      .from('artisan_makers')
      .select(selectFields)
      .eq('teacher_text', code)
      .limit(20);

    for (const s of byTeacherCode || []) {
      if (!existingCodes.has(s.maker_id)) {
        students.push({
          code: s.maker_id,
          name_romaji: s.name_romaji,
          name_kanji: s.name_kanji,
          school: s.legacy_school_text,
          kokuho_count: s.kokuho_count || 0,
          jubun_count: s.jubun_count || 0,
          jubi_count: s.jubi_count || 0,
          gyobutsu_count: s.gyobutsu_count || 0,
          juyo_count: s.juyo_count || 0,
          tokuju_count: s.tokuju_count || 0,
          elite_factor: s.elite_factor || 0,
        });
        existingCodes.add(s.maker_id);
      }
    }

    // Also search by name if available and still sparse
    if (nameRomaji && students.length < 5) {
      const { data: byName } = await yuhinkaiClient
        .from('artisan_makers')
        .select(selectFields)
        .eq('teacher_text', nameRomaji)
        .limit(20);

      for (const s of byName || []) {
        if (!existingCodes.has(s.maker_id)) {
          students.push({
            code: s.maker_id,
            name_romaji: s.name_romaji,
            name_kanji: s.name_kanji,
            school: s.legacy_school_text,
            kokuho_count: s.kokuho_count || 0,
            jubun_count: s.jubun_count || 0,
            jubi_count: s.jubi_count || 0,
            gyobutsu_count: s.gyobutsu_count || 0,
            juyo_count: s.juyo_count || 0,
            tokuju_count: s.tokuju_count || 0,
            elite_factor: s.elite_factor || 0,
          });
          existingCodes.add(s.maker_id);
        }
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
 * Excludes the artisan itself. Uses artisan_makers with domain filter.
 */
export async function getRelatedArtisans(
  code: string,
  school: string | null,
  entityType: 'smith' | 'tosogu'
): Promise<RelatedArtisan[]> {
  if (!school) return [];

  const domainFilter = getDomainFilter(entityType);

  const { data } = await yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, legacy_school_text, kokuho_count, jubun_count, jubi_count, gyobutsu_count, juyo_count, tokuju_count, elite_factor')
    .eq('legacy_school_text', school)
    .neq('maker_id', code)
    .in('domain', domainFilter)
    .gt('total_items', 0)
    .order('elite_factor', { ascending: false })
    .limit(12);

  return (data || []).map(r => ({
    code: r.maker_id,
    name_romaji: r.name_romaji,
    name_kanji: r.name_kanji,
    school: r.legacy_school_text,
    kokuho_count: r.kokuho_count || 0,
    jubun_count: r.jubun_count || 0,
    jubi_count: r.jubi_count || 0,
    gyobutsu_count: r.gyobutsu_count || 0,
    juyo_count: r.juyo_count || 0,
    tokuju_count: r.tokuju_count || 0,
    elite_factor: r.elite_factor || 0,
  }));
}

// =============================================================================
// PERCENTILE QUERIES
// =============================================================================

/**
 * Calculate elite factor percentile among artisan_makers with total_items > 0.
 * Uses domain filter to compare within the same entity type pool.
 * Returns a value from 0 to 100 (higher = more elite than peers).
 */
export async function getElitePercentile(
  eliteFactor: number,
  entityType: 'smith' | 'tosogu'
): Promise<number> {
  const domainFilter = getDomainFilter(entityType);

  // Count how many have a lower elite_factor
  const { count: below } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .lt('elite_factor', eliteFactor)
    .in('domain', domainFilter)
    .gt('total_items', 0);

  const { count: total } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .in('domain', domainFilter)
    .gt('total_items', 0);

  if (!total || total === 0) return 0;
  return Math.round(((below || 0) / total) * 100);
}

/**
 * Calculate provenance factor percentile among artisan_makers with provenance data.
 * Uses domain filter to compare within the same entity type pool.
 * Returns a value from 0 to 100 (higher = rarer provenance).
 */
export async function getProvenancePercentile(
  provenanceFactor: number,
  entityType: 'smith' | 'tosogu'
): Promise<number> {
  const domainFilter = getDomainFilter(entityType);

  // Count how many have a lower provenance_factor
  const { count: below } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .lt('provenance_factor', provenanceFactor)
    .in('domain', domainFilter)
    .not('provenance_factor', 'is', null);

  const { count: total } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .in('domain', domainFilter)
    .not('provenance_factor', 'is', null);

  if (!total || total === 0) return 0;
  return Math.min(Math.round(((below || 0) / total) * 100), 100);
}

/**
 * Get elite factor distribution as histogram buckets.
 * Returns 100 buckets at 1% resolution (0–1%, 1–2%, …, 99–100%).
 * Only includes artisan_makers with total_items > 0.
 */
export async function getEliteDistribution(
  entityType: 'smith' | 'tosogu'
): Promise<{ buckets: number[]; total: number }> {
  const domainFilter = getDomainFilter(entityType);

  const { data, error } = await yuhinkaiClient
    .from('artisan_makers')
    .select('elite_factor')
    .in('domain', domainFilter)
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
 * Only includes artisan_makers with a non-null provenance_factor.
 */
export async function getProvenanceDistribution(
  entityType: 'smith' | 'tosogu'
): Promise<{ buckets: number[]; total: number }> {
  const domainFilter = getDomainFilter(entityType);

  const { data, error } = await yuhinkaiClient
    .from('artisan_makers')
    .select('provenance_factor')
    .in('domain', domainFilter)
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
 * Filters artisan_makers to sword/both domain (smith pool).
 * Returns a value from 0 to 100 (higher = higher rated than peers).
 */
export async function getTokoTaikanPercentile(
  tokoTaikan: number
): Promise<number> {
  const { count: below } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .lt('toko_taikan', tokoTaikan)
    .in('domain', ['sword', 'both'])
    .not('toko_taikan', 'is', null);

  const { count: total } = await yuhinkaiClient
    .from('artisan_makers')
    .select('*', { count: 'exact', head: true })
    .in('domain', ['sword', 'both'])
    .not('toko_taikan', 'is', null);

  if (!total || total === 0) return 0;
  return Math.round(((below || 0) / total) * 100);
}

/**
 * Resolve a teacher code/name to a stub with code, name, and slug info.
 * Tries artisan_makers first by code, then by name_romaji.
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
 * Call the `get_directory_enrichment` RPC on the Yuhinkai database.
 * Returns artists (with percentile + member_count baked in), total count,
 * and optionally facets — all in a single DB round-trip.
 *
 * Replaces: getArtistsForDirectory + getBulkElitePercentiles/getBulkProvenancePercentiles
 *           + getArtistDirectoryFacets + getSchoolMemberCounts
 */
export async function callDirectoryEnrichment(
  filters: DirectoryFilters & { skipMeta?: boolean }
): Promise<{
  artists: ArtistDirectoryEntry[];
  total: number;
  facets: DirectoryFacets | null;
}> {
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
    skipMeta = false,
  } = filters;

  const { data, error } = await yuhinkaiClient.rpc('get_directory_enrichment', {
    p_type: type,
    p_school: school || null,
    p_province: province || null,
    p_era: era || null,
    p_q: q || null,
    p_sort: sort === 'for_sale' ? 'elite_factor' : sort,
    p_page: Math.max(page, 1),
    p_limit: Math.min(Math.max(limit, 1), 100),
    p_notable: notable,
    p_skip_meta: skipMeta,
  });

  if (error) {
    console.error('[Yuhinkai] get_directory_enrichment RPC error:', error);
    return { artists: [], total: 0, facets: null };
  }

  // RPC returns JSONB with { artists, total, facets }
  const result = data as {
    artists: Array<Record<string, unknown>>;
    total: number;
    facets: {
      schools: Array<{ value: string; count: number }>;
      provinces: Array<{ value: string; count: number }>;
      eras: Array<{ value: string; count: number }>;
      totals: { smiths: number; tosogu: number };
    } | null;
  };

  const entityType = type === 'tosogu' ? 'tosogu' : 'smith';

  const artists: ArtistDirectoryEntry[] = (result.artists || []).map(row => ({
    code: row.code as string,
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
    percentile: (row.percentile as number) ?? 0,
    member_count: row.member_count != null ? (row.member_count as number) : undefined,
  }));

  // Re-sort client-side: the RPC's jsonb_agg() doesn't preserve the ORDER BY
  // from the paginated CTE, so the correct rows are returned but in arbitrary order.
  if (sort === 'name') {
    artists.sort((a, b) => (a.name_romaji || '').localeCompare(b.name_romaji || ''));
  } else if (sort === 'provenance_factor') {
    artists.sort((a, b) => (b.provenance_factor ?? -1) - (a.provenance_factor ?? -1));
  } else if (sort === 'total_items') {
    artists.sort((a, b) => b.total_items - a.total_items);
  } else {
    artists.sort((a, b) => b.elite_factor - a.elite_factor);
  }

  return {
    artists,
    total: result.total || 0,
    facets: skipMeta ? null : (result.facets || null),
  };
}

/**
 * Fetch hero image URLs from the pre-computed `artisan_hero_images` table.
 * Used by BOTH the directory (/artists) and detail page (/artists/[slug])
 * to guarantee thumbnails always match hero images.
 * Returns Map<code, imageUrl>.
 */
export async function getHeroImagesFromTable(
  codes: string[],
  entityType: 'smith' | 'tosogu'
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (codes.length === 0) return result;

  const BATCH_SIZE = 200;
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const { data, error } = await yuhinkaiClient
      .from('artisan_hero_images')
      .select('code, image_url')
      .in('code', batch)
      .eq('entity_type', entityType)
      .not('image_url', 'is', null);

    if (error) {
      console.error('[Yuhinkai] artisan_hero_images query error:', error);
      continue;
    }

    for (const row of data || []) {
      result.set(row.code as string, row.image_url as string);
    }
  }

  return result;
}

/**
 * Fetch the hero image for a detail page from the pre-computed table.
 * Reads all metadata columns directly (collection, volume, item_number,
 * form_type, image_type) — no URL parsing or extra queries needed.
 * Verifies the image exists via HEAD request; falls back to runtime
 * selection if the pre-computed URL is stale/broken.
 */
export async function getHeroImageForDetailPage(
  code: string,
  entityType: 'smith' | 'tosogu'
): Promise<ArtisanHeroImage | null> {
  const { data, error } = await yuhinkaiClient
    .from('artisan_hero_images')
    .select('image_url, collection, volume, item_number, form_type, image_type')
    .eq('code', code)
    .eq('entity_type', entityType)
    .not('image_url', 'is', null)
    .limit(1);

  if (!error && data && data.length > 0) {
    const row = data[0];
    const imageUrl = row.image_url as string;

    // Verify the pre-computed URL still resolves to a real file
    try {
      const head = await fetch(imageUrl, { method: 'HEAD' });
      if (head.ok) {
        return {
          imageUrl,
          collection: row.collection as string,
          volume: (row.volume as number) || 0,
          itemNumber: row.item_number as number,
          formType: row.form_type as string | null,
          imageType: row.image_type as string || 'oshigata',
        };
      }
    } catch {
      // HEAD failed — fall through to runtime selection
    }
  }

  // Fallback: runtime selection with per-candidate HEAD verification
  return getArtisanHeroImage(code, entityType);
}

/**
 * Resolve a school name (e.g. "Osafune") to all matching artisan codes using
 * the junction table (artisan_school_members) + unlinked fallback.
 * Uses the `resolve_school_to_makers()` SQL function.
 * Returns a Set of matching codes (maker_ids + school_ids).
 * Falls back to empty set on error.
 */
export async function resolveSchoolToMakerIds(
  schoolName: string,
  entityType: 'smith' | 'tosogu'
): Promise<Set<string>> {
  const domains = getDomainFilter(entityType);

  try {
    const { data, error } = await yuhinkaiClient.rpc('resolve_school_to_makers', {
      p_school_name: schoolName,
      p_domains: domains,
    });

    if (error) {
      console.error('[Yuhinkai] resolve_school_to_makers RPC error:', error);
      return new Set();
    }

    return new Set((data || []).map((row: { code: string }) => row.code));
  } catch (err) {
    console.error('[Yuhinkai] resolve_school_to_makers error:', err);
    return new Set();
  }
}

/**
 * Resolve a broad period name (e.g. "Muromachi") to the list of specific era
 * strings in the database that map to it. Still needed by getArtistsForDirectory
 * and getFilteredArtistsByCodes (used in the `for_sale` sort path).
 */
async function getErasForBroadPeriod(
  broadPeriod: string,
  entityType: 'smith' | 'tosogu'
): Promise<string[]> {
  const domainFilter = getDomainFilter(entityType);
  const { data } = await yuhinkaiClient
    .from('artisan_makers')
    .select('era')
    .in('domain', domainFilter)
    .gt('total_items', 0)
    .not('era', 'is', null);

  if (!data) return [];

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
 * Queries artisan_makers with domain filter based on the type filter.
 *
 * NOTE: Still used by the `for_sale` sort path (via getFilteredArtistsByCodes)
 * and internally. The standard path now uses callDirectoryEnrichment() instead.
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

  const entityType = type === 'tosogu' ? 'tosogu' : 'smith';
  const domainFilter = getDomainFilter(entityType);

  // Pre-resolve school filter to matching codes via junction table
  let resolvedSchoolIds: Set<string> | null = null;
  if (school) {
    resolvedSchoolIds = await resolveSchoolToMakerIds(school, entityType);
    if (resolvedSchoolIds.size === 0) {
      return { artists: [], total: 0 };
    }
  }

  let query = yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, legacy_school_text, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, provenance_factor', { count: 'exact' })
    .in('domain', domainFilter);

  if (notable) query = query.gt('total_items', 0);
  if (resolvedSchoolIds) query = query.in('maker_id', [...resolvedSchoolIds]);
  if (province) query = query.eq('province', province);

  // Era filter: resolve broad period name to matching specific era strings
  if (era) {
    const matchingEras = await getErasForBroadPeriod(era, entityType);
    if (matchingEras.length > 0) {
      query = query.in('era', matchingEras);
    } else {
      // No eras match this broad period — return empty
      return { artists: [], total: 0 };
    }
  }

  if (q) {
    query = query.or(`name_romaji.ilike.%${q}%,name_kanji.ilike.%${q}%,maker_id.ilike.%${q}%,legacy_school_text.ilike.%${q}%,province.ilike.%${q}%,name_romaji_normalized.ilike.%${q}%`);
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
    code: row.maker_id as string,
    name_romaji: row.name_romaji as string | null,
    name_kanji: row.name_kanji as string | null,
    school: row.legacy_school_text as string | null,
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
    is_school_code: false,
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

  const entityType = type === 'tosogu' ? 'tosogu' : 'smith';
  const domainFilter = getDomainFilter(entityType);

  const BATCH_SIZE = 200;
  const results: ArtistDirectoryEntry[] = [];

  // Split codes: NS-* → artisan_schools, others → artisan_makers
  let schoolCodes = codes.filter(c => c.startsWith('NS-'));
  let makerCodes = codes.filter(c => !c.startsWith('NS-'));

  // Pre-resolve school filter via junction table (once, before batch loop)
  if (filters.school) {
    const resolvedIds = await resolveSchoolToMakerIds(filters.school, entityType);
    if (resolvedIds.size === 0) return [];
    // Filter code arrays against the resolved set
    makerCodes = makerCodes.filter(c => resolvedIds.has(c));
    schoolCodes = schoolCodes.filter(c => resolvedIds.has(c));
    if (makerCodes.length === 0 && schoolCodes.length === 0) return [];
  }

  // Pre-resolve broad period → specific eras once (reused across batches)
  let resolvedEras: string[] | null = null;

  // Query artisan_makers for individual maker codes
  for (let i = 0; i < makerCodes.length; i += BATCH_SIZE) {
    const batch = makerCodes.slice(i, i + BATCH_SIZE);
    let query = yuhinkaiClient
      .from('artisan_makers')
      .select('maker_id, name_romaji, name_kanji, legacy_school_text, province, era, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, provenance_factor')
      .in('maker_id', batch)
      .in('domain', domainFilter);

    if (filters.notable !== false) query = query.gt('total_items', 0);
    // School filter already applied by pre-filtering codes above
    if (filters.province) query = query.eq('province', filters.province);

    // Era filter: resolve broad period name to matching specific era strings
    if (filters.era) {
      if (!resolvedEras) {
        resolvedEras = await getErasForBroadPeriod(filters.era, entityType);
      }
      if (resolvedEras.length > 0) {
        query = query.in('era', resolvedEras);
      } else {
        continue; // No matching eras for this period — skip batch
      }
    }

    if (filters.q) {
      query = query.or(`name_romaji.ilike.%${filters.q}%,name_kanji.ilike.%${filters.q}%,maker_id.ilike.%${filters.q}%,legacy_school_text.ilike.%${filters.q}%,province.ilike.%${filters.q}%,name_romaji_normalized.ilike.%${filters.q}%`);
    }

    const { data } = await query;

    for (const row of data || []) {
      results.push({
        code: row.maker_id as string,
        name_romaji: row.name_romaji as string | null,
        name_kanji: row.name_kanji as string | null,
        school: row.legacy_school_text as string | null,
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
        is_school_code: false,
      });
    }
  }

  // Query artisan_schools for school codes (NS-*)
  for (let i = 0; i < schoolCodes.length; i += BATCH_SIZE) {
    const batch = schoolCodes.slice(i, i + BATCH_SIZE);
    let query = yuhinkaiClient
      .from('artisan_schools')
      .select('school_id, name_romaji, name_kanji, province, era_start, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_factor, provenance_factor')
      .in('school_id', batch)
      .in('domain', domainFilter);

    if (filters.notable !== false) query = query.gt('total_items', 0);
    // School filter already applied by pre-filtering codes above
    if (filters.province) query = query.eq('province', filters.province);

    if (filters.era) {
      if (!resolvedEras) {
        resolvedEras = await getErasForBroadPeriod(filters.era, entityType);
      }
      if (resolvedEras.length > 0) {
        query = query.in('era_start', resolvedEras);
      } else {
        continue;
      }
    }

    if (filters.q) {
      query = query.or(`name_romaji.ilike.%${filters.q}%,name_kanji.ilike.%${filters.q}%,school_id.ilike.%${filters.q}%,province.ilike.%${filters.q}%`);
    }

    const { data } = await query;

    for (const row of data || []) {
      results.push({
        code: row.school_id as string,
        name_romaji: row.name_romaji as string | null,
        name_kanji: row.name_kanji as string | null,
        school: row.name_romaji as string | null,
        province: row.province as string | null,
        era: row.era_start as string | null,
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
        is_school_code: true,
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
  const domainFilter = getDomainFilter(type);

  // Fetch facets for the selected type + totals for both types in parallel
  const [
    { data: schools },
    { data: provinces },
    { data: eras },
    { count: smithCount },
    { count: tosoguCount },
  ] = await Promise.all([
    yuhinkaiClient.from('artisan_makers').select('legacy_school_text').in('domain', domainFilter).gt('total_items', 0).not('legacy_school_text', 'is', null),
    yuhinkaiClient.from('artisan_makers').select('province').in('domain', domainFilter).gt('total_items', 0).not('province', 'is', null),
    yuhinkaiClient.from('artisan_makers').select('era').in('domain', domainFilter).gt('total_items', 0).not('era', 'is', null),
    yuhinkaiClient.from('artisan_makers').select('*', { count: 'exact', head: true }).in('domain', ['sword', 'both']).gt('total_items', 0),
    yuhinkaiClient.from('artisan_makers').select('*', { count: 'exact', head: true }).in('domain', ['tosogu', 'both']).gt('total_items', 0),
  ]);

  const schoolMap = new Map<string, number>();
  for (const row of schools || []) {
    const s = row.legacy_school_text as string;
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
 * For NS school code entries, count how many individual makers are members of the school.
 * Uses artisan_school_members junction table.
 * Returns Map<code, memberCount>.
 */
export async function getSchoolMemberCounts(
  artists: Array<{ code: string; school: string | null; entity_type: 'smith' | 'tosogu'; is_school_code: boolean }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const nsCodes = artists.filter(a => a.is_school_code && a.code.startsWith('NS-'));
  if (nsCodes.length === 0) return result;

  await Promise.all(
    nsCodes.map(async ({ code }) => {
      const { count } = await yuhinkaiClient
        .from('artisan_school_members')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', code);

      result.set(code, count || 0);
    })
  );

  return result;
}

/**
 * For school codes, get all individual member codes from artisan_school_members.
 * Returns Map<schoolCode, memberCodes[]>.
 */
export async function getSchoolMemberCodes(
  schools: Array<{ code: string; school: string; entity_type: 'smith' | 'tosogu' }>
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (schools.length === 0) return result;

  await Promise.all(
    schools.map(async ({ code }) => {
      const { data } = await yuhinkaiClient
        .from('artisan_school_members')
        .select('maker_id')
        .eq('school_id', code);

      const memberCodes = (data || []).map((row: { maker_id: string }) => row.maker_id);
      result.set(code, memberCodes);
    })
  );

  return result;
}

/**
 * Reverse-map: given a set of individual maker codes, find which school codes
 * contain those makers as members. Returns Map<schoolCode, memberCodes[]>
 * where memberCodes are the subset of `makerCodes` belonging to that school.
 * Used by the for_sale sort path to aggregate individual listing counts into schools.
 */
export async function getSchoolCodesForMembers(
  makerCodes: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (makerCodes.length === 0) return result;

  const BATCH_SIZE = 500;
  for (let i = 0; i < makerCodes.length; i += BATCH_SIZE) {
    const batch = makerCodes.slice(i, i + BATCH_SIZE);
    const { data } = await yuhinkaiClient
      .from('artisan_school_members')
      .select('school_id, maker_id')
      .in('maker_id', batch);

    for (const row of data || []) {
      const schoolId = row.school_id as string;
      const makerId = row.maker_id as string;
      const existing = result.get(schoolId);
      if (existing) {
        existing.push(makerId);
      } else {
        result.set(schoolId, [makerId]);
      }
    }
  }

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

  // Process each type independently using artisan_makers with domain filter
  const typePromises = Array.from(byType.entries()).map(async ([entityType, group]) => {
    const domainFilter = getDomainFilter(entityType);

    // Get total count for this type
    const { count: total } = await yuhinkaiClient
      .from('artisan_makers')
      .select('*', { count: 'exact', head: true })
      .in('domain', domainFilter)
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
          .from('artisan_makers')
          .select('*', { count: 'exact', head: true })
          .lt('elite_factor', factor)
          .in('domain', domainFilter)
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
    const domainFilter = getDomainFilter(entityType);

    const { count: total } = await yuhinkaiClient
      .from('artisan_makers')
      .select('*', { count: 'exact', head: true })
      .in('domain', domainFilter)
      .not('provenance_factor', 'is', null);

    if (!total || total === 0) {
      for (const a of group) result.set(a.code, 0);
      return;
    }

    const uniqueFactors = [...new Set(group.map(a => a.provenance_factor!))];

    const belowCounts = await Promise.all(
      uniqueFactors.map(async (factor) => {
        const { count: below } = await yuhinkaiClient
          .from('artisan_makers')
          .select('*', { count: 'exact', head: true })
          .lt('provenance_factor', factor)
          .in('domain', domainFilter)
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

/** Volumes with poor scan quality — skip during hero image selection */
const EXCLUDED_VOLUMES: Array<{ collection: string; volume: number }> = [
  { collection: 'Tokuju', volume: 11 },
];

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

      // Skip volumes with poor scan quality
      if (EXCLUDED_VOLUMES.some(ev => ev.collection === record.collection && ev.volume === record.volume)) continue;

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


// =============================================================================
// TEACHER RESOLUTION
// =============================================================================

export async function resolveTeacher(teacherRef: string): Promise<ArtisanStub | null> {
  // Try as a maker_id code first
  const { data: byCode } = await yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji')
    .eq('maker_id', teacherRef)
    .single();

  if (byCode) {
    return {
      code: byCode.maker_id,
      name_romaji: byCode.name_romaji,
      name_kanji: byCode.name_kanji,
    };
  }

  // Try by name_romaji
  const { data: byName } = await yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji')
    .eq('name_romaji', teacherRef)
    .limit(1)
    .single();

  if (byName) {
    return {
      code: byName.maker_id,
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
