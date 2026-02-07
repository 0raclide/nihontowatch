import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Check if Yuhinkai database is configured (support both naming conventions)
const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY)
);

/**
 * Artisan details response shape
 */
export interface ArtisanDetails {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  period: string | null;
  juyo_count: number;
  tokuju_count: number;
  total_items: number;
  is_school_code: boolean;
}

/**
 * GET /api/artisan/[code]
 *
 * Fetches artisan details from Yuhinkai smith_entities table.
 * Used by ArtisanTooltip component for admin QA.
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

  // Allow cache bypass with ?nocache=1 for debugging
  const nocache = request.nextUrl.searchParams.get('nocache') === '1';

  // Return 404 if Yuhinkai database is not configured
  if (!isYuhinkaiConfigured) {
    return NextResponse.json(
      { artisan: null, error: 'Yuhinkai database not configured' },
      { status: 404 }
    );
  }

  try {
    // Dynamic import to avoid build-time errors when env vars are missing
    const { getSmithEntity } = await import('@/lib/supabase/yuhinkai');
    const smithEntity = await getSmithEntity(code);

    if (!smithEntity) {
      // Return empty response with 404 if not found
      return NextResponse.json(
        { artisan: null },
        { status: 404 }
      );
    }

    const artisan: ArtisanDetails = {
      code: smithEntity.smith_id,
      name_romaji: smithEntity.name_romaji,
      name_kanji: smithEntity.name_kanji,
      school: smithEntity.school,
      province: smithEntity.province,
      era: smithEntity.era,
      period: smithEntity.period,
      juyo_count: smithEntity.juyo_count || 0,
      tokuju_count: smithEntity.tokuju_count || 0,
      total_items: smithEntity.total_items || 0,
      is_school_code: smithEntity.is_school_code || false,
    };

    const response = NextResponse.json({ artisan });

    // Cache for 1 hour at edge (artisan data rarely changes)
    if (nocache) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=3600, stale-while-revalidate=86400'
      );
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
