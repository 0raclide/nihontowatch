/**
 * Artisan Search API
 *
 * GET /api/artisan/search?q=<query>&type=<smith|tosogu|all>&limit=<number>
 *
 * Searches the Yuhinkai database for smiths and tosogu makers.
 * Searches across: name_kanji, name_romaji, school, code (smith_id/maker_id)
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
  type: 'smith' | 'tosogu';
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  generation: string | null;
  juyo_count: number;
  tokuju_count: number;
  total_items: number;
  is_school_code: boolean;
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
    const { yuhinkaiClient } = await import('@/lib/supabase/yuhinkai');
    const results: ArtisanSearchResult[] = [];

    // Escape special characters for ilike pattern
    const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // Search smiths
    if (type === 'all' || type === 'smith') {
      const { data: smiths, error: smithError } = await yuhinkaiClient
        .from('smith_entities')
        .select('smith_id, name_romaji, name_kanji, school, province, era, generation, juyo_count, tokuju_count, total_items, is_school_code')
        .or(`smith_id.ilike.${pattern},name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},school.ilike.${pattern}`)
        .order('juyo_count', { ascending: false, nullsFirst: false })
        .limit(type === 'all' ? Math.ceil(limit / 2) : limit);

      if (smithError) {
        logger.error('Smith search error', { error: smithError.message });
      } else if (smiths) {
        for (const s of smiths) {
          results.push({
            code: s.smith_id,
            type: 'smith',
            name_romaji: s.name_romaji,
            name_kanji: s.name_kanji,
            school: s.school,
            province: s.province,
            era: s.era,
            generation: s.generation,
            juyo_count: s.juyo_count || 0,
            tokuju_count: s.tokuju_count || 0,
            total_items: s.total_items || 0,
            is_school_code: s.is_school_code || false,
          });
        }
      }
    }

    // Search tosogu makers
    if (type === 'all' || type === 'tosogu') {
      const { data: makers, error: makerError } = await yuhinkaiClient
        .from('tosogu_makers')
        .select('maker_id, name_romaji, name_kanji, school, province, era, generation, juyo_count, tokuju_count, total_items, is_school_code')
        .or(`maker_id.ilike.${pattern},name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},school.ilike.${pattern}`)
        .order('juyo_count', { ascending: false, nullsFirst: false })
        .limit(type === 'all' ? Math.ceil(limit / 2) : limit);

      if (makerError) {
        logger.error('Tosogu maker search error', { error: makerError.message });
      } else if (makers) {
        for (const m of makers) {
          results.push({
            code: m.maker_id,
            type: 'tosogu',
            name_romaji: m.name_romaji,
            name_kanji: m.name_kanji,
            school: m.school,
            province: m.province,
            era: m.era,
            generation: m.generation,
            juyo_count: m.juyo_count || 0,
            tokuju_count: m.tokuju_count || 0,
            total_items: m.total_items || 0,
            is_school_code: m.is_school_code || false,
          });
        }
      }
    }

    // Sort combined results by juyo_count descending
    results.sort((a, b) => (b.juyo_count + b.tokuju_count) - (a.juyo_count + a.tokuju_count));

    // Limit to requested number
    const limitedResults = results.slice(0, limit);

    return NextResponse.json({
      results: limitedResults,
      query,
      total: limitedResults.length,
    });
  } catch (error) {
    logger.logError('Artisan search error', error);
    return NextResponse.json(
      { results: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}
