import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { generateArtisanSlug } from '@/lib/artisan/slugs';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Check if Yuhinkai database is configured (support both naming conventions)
const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY)
);

/**
 * Artisan details response shape (legacy — kept for ArtisanTooltip compat)
 */
export interface ArtisanDetails {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  period: string | null;
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_factor: number | null;
  elite_count: number;
  is_school_code: boolean;
}

/**
 * Rich artisan page response shape
 */
export interface ArtisanPageResponse {
  entity: {
    code: string;
    name_romaji: string | null;
    name_kanji: string | null;
    school: string | null;
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
  };
  profile: {
    profile_md: string;
    hook: string | null;
    setsumei_count: number;
    generated_at: string;
  } | null;
  stats: {
    mei_distribution: Record<string, number>;
    form_distribution: Record<string, number>;
  } | null;
  lineage: {
    teacher: { code: string; name_romaji: string | null; slug: string } | null;
    students: Array<{ code: string; name_romaji: string | null; slug: string }>;
  };
  related: Array<{
    code: string;
    name_romaji: string | null;
    name_kanji: string | null;
    slug: string;
    school: string | null;
    juyo_count: number;
    tokuju_count: number;
    elite_factor: number;
  }>;
  denrai: Array<{ owner: string; count: number }>;
}

/**
 * GET /api/artisan/[code]
 *
 * Returns rich artisan data for the artist page.
 * With ?rich=1, returns full ArtisanPageResponse.
 * Without, returns legacy ArtisanDetails for ArtisanTooltip compat.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 2) {
    return NextResponse.json(
      { error: 'Invalid artisan code' },
      { status: 400 }
    );
  }

  const nocache = request.nextUrl.searchParams.get('nocache') === '1';
  const rich = request.nextUrl.searchParams.get('rich') === '1';

  if (!isYuhinkaiConfigured) {
    return NextResponse.json(
      { artisan: null, error: 'Yuhinkai database not configured' },
      { status: 404 }
    );
  }

  try {
    const {
      getSmithEntity,
      getTosoguMaker,
      getArtistProfile,
      getStudents,
      getRelatedArtisans,
      getElitePercentile,
      getTokoTaikanPercentile,
      resolveTeacher,
      getDenraiForArtists,
    } = await import('@/lib/supabase/yuhinkai');

    // Try smith_entities first
    const smithEntity = await getSmithEntity(code);
    const isSmith = !!smithEntity;

    // Try tosogu_makers if not a smith
    const tosoguMaker = !isSmith ? await getTosoguMaker(code) : null;
    const entity = smithEntity || tosoguMaker;

    if (!entity) {
      return NextResponse.json({ artisan: null }, { status: 404 });
    }

    const entityCode = isSmith ? (entity as typeof smithEntity)!.smith_id : (entity as typeof tosoguMaker)!.maker_id;
    const entityType = isSmith ? 'smith' as const : 'tosogu' as const;

    // Legacy response for ArtisanTooltip
    if (!rich) {
      const artisan: ArtisanDetails = {
        code: entityCode,
        name_romaji: entity.name_romaji,
        name_kanji: entity.name_kanji,
        school: entity.school,
        province: entity.province,
        era: entity.era,
        period: isSmith ? (entity as typeof smithEntity)!.period : null,
        kokuho_count: entity.kokuho_count || 0,
        jubun_count: entity.jubun_count || 0,
        jubi_count: entity.jubi_count || 0,
        gyobutsu_count: entity.gyobutsu_count || 0,
        tokuju_count: entity.tokuju_count || 0,
        juyo_count: entity.juyo_count || 0,
        total_items: entity.total_items || 0,
        elite_factor: entity.elite_factor ?? null,
        elite_count: entity.elite_count || 0,
        is_school_code: entity.is_school_code || false,
      };

      const response = NextResponse.json({ artisan });
      if (nocache) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      } else {
        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      }
      return response;
    }

    // Rich response for artist page
    const eliteFactor = entity.elite_factor ?? 0;
    const slug = generateArtisanSlug(entity.name_romaji, entityCode);

    // Fetch all enrichment data in parallel
    const [profile, students, related, elitePercentile, tokoTaikanPercentile, teacherStub, denraiMap] =
      await Promise.all([
        getArtistProfile(entityCode),
        getStudents(entityCode, entity.name_romaji),
        getRelatedArtisans(entityCode, entity.school, entityType),
        getElitePercentile(eliteFactor, entityType),
        isSmith && (entity as typeof smithEntity)!.toko_taikan
          ? getTokoTaikanPercentile((entity as typeof smithEntity)!.toko_taikan!)
          : Promise.resolve(null),
        entity.teacher ? resolveTeacher(entity.teacher) : Promise.resolve(null),
        entity.name_romaji
          ? getDenraiForArtists([entity.name_romaji])
          : Promise.resolve(new Map<string, Array<{ owner: string; count: number }>>()),
      ]);

    // Extract stats from profile snapshot if available
    let stats: ArtisanPageResponse['stats'] = null;
    if (profile?.stats_snapshot) {
      const snapshot = profile.stats_snapshot as Record<string, unknown>;
      const mei = snapshot.mei_distribution as Record<string, number> | undefined;
      const form = snapshot.form_distribution as Record<string, number> | undefined;
      if (mei || form) {
        stats = {
          mei_distribution: mei || {},
          form_distribution: form || {},
        };
      }
    }

    const pageResponse: ArtisanPageResponse = {
      entity: {
        code: entityCode,
        name_romaji: entity.name_romaji,
        name_kanji: entity.name_kanji,
        school: entity.school,
        province: entity.province,
        era: entity.era,
        period: isSmith ? (entity as typeof smithEntity)!.period : null,
        generation: entity.generation,
        teacher: entity.teacher,
        entity_type: entityType,
        is_school_code: entity.is_school_code || false,
        slug,
        fujishiro: isSmith ? (entity as typeof smithEntity)!.fujishiro : null,
        toko_taikan: isSmith ? (entity as typeof smithEntity)!.toko_taikan : null,
        specialties: !isSmith ? (entity as typeof tosoguMaker)!.specialties : null,
      },
      certifications: {
        kokuho_count: entity.kokuho_count || 0,
        jubun_count: entity.jubun_count || 0,
        jubi_count: entity.jubi_count || 0,
        gyobutsu_count: entity.gyobutsu_count || 0,
        tokuju_count: entity.tokuju_count || 0,
        juyo_count: entity.juyo_count || 0,
        total_items: entity.total_items || 0,
        elite_count: entity.elite_count || 0,
        elite_factor: eliteFactor,
      },
      rankings: {
        elite_percentile: elitePercentile,
        toko_taikan_percentile: tokoTaikanPercentile,
      },
      profile: profile
        ? {
            profile_md: profile.profile_md,
            hook: profile.hook,
            setsumei_count: profile.setsumei_count,
            generated_at: profile.generated_at,
          }
        : null,
      stats,
      lineage: {
        teacher: teacherStub
          ? {
              code: teacherStub.code,
              name_romaji: teacherStub.name_romaji,
              slug: generateArtisanSlug(teacherStub.name_romaji, teacherStub.code),
            }
          : null,
        students: students.map(s => ({
          code: s.code,
          name_romaji: s.name_romaji,
          slug: generateArtisanSlug(s.name_romaji, s.code),
        })),
      },
      related: related.map(r => ({
        code: r.code,
        name_romaji: r.name_romaji,
        name_kanji: r.name_kanji,
        slug: generateArtisanSlug(r.name_romaji, r.code),
        school: r.school,
        juyo_count: r.juyo_count,
        tokuju_count: r.tokuju_count,
        elite_factor: r.elite_factor,
      })),
      denrai: (entity.name_romaji && denraiMap.get(entity.name_romaji)) || [],
    };

    const response = NextResponse.json(pageResponse);
    if (nocache) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }
    return response;
  } catch (error) {
    logger.logError('Artisan API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
