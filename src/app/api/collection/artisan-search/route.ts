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
  school: string | null;
  province: string | null;
  era: string | null;
  juyo_count: number;
  tokuju_count: number;
  total_items: number;
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
    const results: ArtisanSearchResult[] = [];

    const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // Search smiths
    if (type === 'all' || type === 'smith') {
      const { data: smiths } = await yuhinkaiClient
        .from('smith_entities')
        .select('smith_id, name_romaji, name_kanji, school, province, era, juyo_count, tokuju_count, total_items')
        .or(`smith_id.ilike.${pattern},name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},school.ilike.${pattern}`)
        .order('juyo_count', { ascending: false, nullsFirst: false })
        .limit(type === 'all' ? Math.ceil(limit / 2) : limit);

      for (const s of smiths || []) {
        results.push({
          code: s.smith_id,
          type: 'smith',
          name_romaji: s.name_romaji,
          name_kanji: s.name_kanji,
          school: s.school,
          province: s.province,
          era: s.era,
          juyo_count: s.juyo_count || 0,
          tokuju_count: s.tokuju_count || 0,
          total_items: s.total_items || 0,
        });
      }
    }

    // Search tosogu makers
    if (type === 'all' || type === 'tosogu') {
      const { data: makers } = await yuhinkaiClient
        .from('tosogu_makers')
        .select('maker_id, name_romaji, name_kanji, school, province, era, juyo_count, tokuju_count, total_items')
        .or(`maker_id.ilike.${pattern},name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},school.ilike.${pattern}`)
        .order('juyo_count', { ascending: false, nullsFirst: false })
        .limit(type === 'all' ? Math.ceil(limit / 2) : limit);

      for (const m of makers || []) {
        results.push({
          code: m.maker_id,
          type: 'tosogu',
          name_romaji: m.name_romaji,
          name_kanji: m.name_kanji,
          school: m.school,
          province: m.province,
          era: m.era,
          juyo_count: m.juyo_count || 0,
          tokuju_count: m.tokuju_count || 0,
          total_items: m.total_items || 0,
        });
      }
    }

    results.sort((a, b) => (b.juyo_count + b.tokuju_count) - (a.juyo_count + a.tokuju_count));

    return NextResponse.json({
      results: results.slice(0, limit),
      query,
      total: results.length,
    });
  } catch (error) {
    logger.logError('Collection artisan search error', error);
    return NextResponse.json({ results: [], error: 'Internal server error' }, { status: 500 });
  }
}
