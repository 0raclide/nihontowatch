import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { buildArtistPageData } from '@/lib/artisan/getArtistPageData';

// Re-export for backward compatibility (consumers import from this route)
export type { ArtisanPageResponse } from '@/types/artisan';

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
    const { getArtisan } = await import('@/lib/supabase/yuhinkai');

    const entity = await getArtisan(code);

    if (!entity) {
      return NextResponse.json({ artisan: null }, { status: 404 });
    }

    const entityCode = entity.maker_id;

    // Legacy response for ArtisanTooltip
    if (!rich) {
      const artisan: ArtisanDetails = {
        code: entityCode,
        name_romaji: entity.name_romaji,
        name_kanji: entity.name_kanji,
        school: entity.school,
        province: entity.province,
        era: entity.era,
        period: entity.period,
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

    // Rich response for artist page — delegate to shared service
    const pageResponse = await buildArtistPageData(code);
    if (!pageResponse) {
      return NextResponse.json({ artisan: null }, { status: 404 });
    }

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
