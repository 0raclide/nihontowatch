import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY)
);

export interface ArtisanSearchResult {
  code: string;
  type: 'smith' | 'tosogu';
  name_romaji: string | null;
  name_kanji: string | null;
  display_name: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  generation: string | null;
  hawley: number | null;
  fujishiro: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isYuhinkaiConfigured) {
      return NextResponse.json({ results: [], error: 'Yuhinkai database not configured' }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type') || 'all';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const { yuhinkaiClient } = await import('@/lib/supabase/yuhinkai');

    const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // Single query to artisan_makers
    let dbQuery = yuhinkaiClient
      .from('artisan_makers')
      .select('maker_id, name_romaji, name_kanji, name_romaji_normalized, display_name, legacy_school_text, province, era, generation, domain, hawley, fujishiro')
      .or(`maker_id.ilike.${pattern},name_romaji.ilike.${pattern},name_romaji_normalized.ilike.${pattern},name_kanji.ilike.${pattern},legacy_school_text.ilike.${pattern},display_name.ilike.${pattern}`);

    // Domain filter based on type param
    if (type === 'smith') {
      dbQuery = dbQuery.in('domain', ['sword', 'both']);
    } else if (type === 'tosogu') {
      dbQuery = dbQuery.in('domain', ['tosogu', 'both']);
    }

    const { data, error: queryError } = await dbQuery
      .order('hawley', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (queryError) {
      logger.error('Collection artisan search error', { error: queryError.message });
      return NextResponse.json({ results: [], error: 'Search query failed' }, { status: 500 });
    }

    const results: ArtisanSearchResult[] = (data || []).map((row) => ({
      code: row.maker_id,
      type: row.domain === 'tosogu' ? 'tosogu' as const : 'smith' as const,
      name_romaji: row.name_romaji,
      name_kanji: row.name_kanji,
      display_name: row.display_name,
      school: row.legacy_school_text,
      province: row.province,
      era: row.era,
      generation: row.generation,
      hawley: row.hawley,
      fujishiro: row.fujishiro,
    }));

    return NextResponse.json({
      results,
      query,
      total: results.length,
    });
  } catch (error) {
    logger.logError('Collection artisan search error', error);
    return NextResponse.json({ results: [], error: 'Internal server error' }, { status: 500 });
  }
}
