/**
 * Artisan Search API
 *
 * GET /api/artisan/search?q=<query>&type=<smith|tosogu|all>&limit=<number>
 *
 * Searches both Yuhinkai artisan_makers (individual smiths/tosogu makers)
 * and artisan_schools (school-level entities like NS-Sue-Sa, NS-Osafune).
 * Searches across: maker_id/school_id, name_romaji, name_kanji,
 * legacy_school_text, display_name, tradition, characteristics
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

// Check if Yuhinkai database is configured
const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY)
);

export interface ArtisanSearchResult {
  code: string;
  type: 'smith' | 'tosogu' | 'school';
  name_romaji: string | null;
  name_kanji: string | null;
  display_name: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  generation: string | null;
  hawley: number | null;
  fujishiro: string | null;
  elite_factor: number;
  juyo_count: number;
  tokuju_count: number;
  total_items: number;
  teacher_text: string | null;
  period: string | null;
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const supabase = await createClient();
  const authResult = await verifyAdmin(supabase);

  if (!authResult.isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: authResult.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim() || '';
  const type = searchParams.get('type') || 'all'; // 'smith', 'tosogu', or 'all'
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10), 1), 50);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { results: [], error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  if (!isYuhinkaiConfigured) {
    return NextResponse.json(
      { results: [], error: 'Yuhinkai database not configured' },
      { status: 503 }
    );
  }

  try {
    const { yuhinkaiClient, resolveSchoolName } = await import('@/lib/supabase/yuhinkai');

    // Escape special characters for ilike pattern
    const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // Query artisan_makers (individual smiths/tosogu makers)
    let makersQuery = yuhinkaiClient
      .from('artisan_makers')
      .select('maker_id, name_romaji, name_kanji, name_romaji_normalized, display_name, legacy_school_text, artisan_schools(name_romaji), province, era, generation, domain, hawley, fujishiro, elite_factor, juyo_count, tokuju_count, total_items, teacher_text, period')
      .or(`maker_id.ilike.${pattern},name_romaji.ilike.${pattern},name_romaji_normalized.ilike.${pattern},name_kanji.ilike.${pattern},legacy_school_text.ilike.${pattern},display_name.ilike.${pattern}`);

    // Domain filter based on type param
    if (type === 'smith') {
      makersQuery = makersQuery.in('domain', ['sword', 'both']);
    } else if (type === 'tosogu') {
      makersQuery = makersQuery.in('domain', ['tosogu', 'both']);
    }

    // Query artisan_schools (school-level entities like NS-Sue-Sa)
    let schoolsQuery = yuhinkaiClient
      .from('artisan_schools')
      .select('school_id, name_romaji, name_kanji, domain, tradition, province, era_start, era_end, characteristics, elite_factor, juyo_count, tokuju_count, total_items')
      .or(`school_id.ilike.${pattern},name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},tradition.ilike.${pattern}`);

    if (type === 'smith') {
      schoolsQuery = schoolsQuery.in('domain', ['sword', 'both']);
    } else if (type === 'tosogu') {
      schoolsQuery = schoolsQuery.in('domain', ['tosogu', 'both']);
    }

    // Run both queries in parallel
    const [makersResult, schoolsResult] = await Promise.all([
      makersQuery
        .order('elite_factor', { ascending: false, nullsFirst: false })
        .limit(limit),
      schoolsQuery
        .order('name_romaji')
        .limit(limit),
    ]);

    if (makersResult.error) {
      logger.error('Artisan makers search error', { error: makersResult.error.message });
    }
    if (schoolsResult.error) {
      logger.error('Artisan schools search error', { error: schoolsResult.error.message });
    }

    // If both failed, return error
    if (makersResult.error && schoolsResult.error) {
      return NextResponse.json(
        { results: [], error: 'Search query failed' },
        { status: 500 }
      );
    }

    // Map makers results
    const makerResults: ArtisanSearchResult[] = (makersResult.data || []).map((row) => {
      return {
        code: row.maker_id,
        type: row.domain === 'tosogu' ? 'tosogu' as const : 'smith' as const,
        name_romaji: row.name_romaji,
        name_kanji: row.name_kanji,
        display_name: row.display_name,
        school: resolveSchoolName(row),
        province: row.province,
        era: row.era,
        generation: row.generation,
        hawley: row.hawley,
        fujishiro: row.fujishiro,
        elite_factor: row.elite_factor || 0,
        juyo_count: row.juyo_count || 0,
        tokuju_count: row.tokuju_count || 0,
        total_items: row.total_items || 0,
        teacher_text: row.teacher_text ?? null,
        period: row.period ?? null,
      };
    });

    // Map schools results
    const schoolResults: ArtisanSearchResult[] = (schoolsResult.data || []).map((row) => ({
      code: row.school_id,
      type: 'school' as const,
      name_romaji: row.name_romaji,
      name_kanji: row.name_kanji,
      display_name: row.name_romaji,
      school: row.tradition,
      province: row.province,
      era: [row.era_start, row.era_end].filter(Boolean).join(' – ') || null,
      generation: null,
      hawley: null,
      fujishiro: null,
      elite_factor: row.elite_factor || 0,
      juyo_count: row.juyo_count || 0,
      tokuju_count: row.tokuju_count || 0,
      total_items: row.total_items || 0,
      teacher_text: null,
      period: null,
    }));

    // Schools first (exact code matches are most relevant), then makers
    const results = [...schoolResults, ...makerResults].slice(0, limit);

    return NextResponse.json({
      results,
      query,
      total: results.length,
    });
  } catch (error) {
    logger.logError('Artisan search error', error);
    return NextResponse.json(
      { results: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}
