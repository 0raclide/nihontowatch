/**
 * Sync elite factor from Yuhinkai database
 *
 * This endpoint is called by Oshi-v2 when elite_factor values are recomputed
 * (triggered by gold value updates in Yuhinkai).
 *
 * Authentication: Bearer token or x-cron-secret header with CRON_SECRET
 *
 * POST /api/admin/sync-elite-factor
 * Body: { artisan_codes: ["MAS590", "KUN123"] } - sync specific artisans
 *   or: { all: true } - sync all artisans (full refresh)
 *
 * Response: { updated: number, notFound: number, errors: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { yuhinkaiClient } from '@/lib/supabase/yuhinkai';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const BATCH_SIZE = 100;
const CONCURRENT_WORKERS = 20;

interface SyncRequest {
  artisan_codes?: string[];
  all?: boolean;
}

interface SyncResult {
  updated: number;
  notFound: number;
  errors: number;
  duration_ms: number;
}


interface ArtisanStats {
  elite_factor: number;
  elite_count: number;
  designation_factor: number;
}

/**
 * Fetch elite_factor and elite_count from Yuhinkai for an artisan code
 */
async function getArtisanStats(artisanCode: string): Promise<ArtisanStats | null> {
  // Check artisan_makers (unified table)
  const { data: artisan } = await yuhinkaiClient
    .from('artisan_makers')
    .select('elite_factor, elite_count, designation_factor')
    .eq('maker_id', artisanCode)
    .single();

  if (artisan?.elite_factor !== undefined) {
    return { elite_factor: artisan.elite_factor, elite_count: artisan.elite_count ?? 0, designation_factor: artisan.designation_factor ?? 0 };
  }

  // Fallback: check artisan_schools for NS-* codes
  if (artisanCode.startsWith('NS-')) {
    const { data: school } = await yuhinkaiClient
      .from('artisan_schools')
      .select('elite_factor, elite_count, designation_factor')
      .eq('school_id', artisanCode)
      .single();

    if (school?.elite_factor !== undefined) {
      return { elite_factor: school.elite_factor, elite_count: school.elite_count ?? 0, designation_factor: school.designation_factor ?? 0 };
    }
  }

  return null;
}

/**
 * Process items in chunks with concurrency
 */
async function processChunk<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Sync elite_factor for specific artisan codes
 */
async function syncSpecificArtisans(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  artisanCodes: string[]
): Promise<SyncResult> {
  const startTime = Date.now();
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  // Fetch stats for all codes concurrently
  const artisanStatsList = await processChunk(
    artisanCodes,
    async (code) => {
      const stats = await getArtisanStats(code);
      return { code, stats };
    },
    CONCURRENT_WORKERS
  );

  // Update listings for each artisan
  for (const { code, stats } of artisanStatsList) {
    if (stats === null) {
      notFound++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('listings') as any)
      .update({
        artisan_elite_factor: stats.elite_factor,
        artisan_elite_count: stats.elite_count,
        artisan_designation_factor: stats.designation_factor,
      })
      .eq('artisan_id', code);

    if (error) {
      logger.error(`[sync-elite-factor] Error updating ${code}:`, error);
      errors++;
    } else {
      updated++;
    }
  }

  return {
    updated,
    notFound,
    errors,
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Sync elite_factor for all listings with artisan_id
 */
async function syncAllArtisans(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<SyncResult> {
  const startTime = Date.now();
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  // Get distinct artisan_ids from listings (paginate to avoid Supabase 1000-row default limit)
  const allArtisanIds: string[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page } = await (supabase.from('listings') as any)
      .select('artisan_id')
      .not('artisan_id', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1) as { data: { artisan_id: string }[] | null };

    if (!page || page.length === 0) break;
    allArtisanIds.push(...page.map((l: { artisan_id: string }) => l.artisan_id).filter(Boolean));
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (allArtisanIds.length === 0) {
    return { updated: 0, notFound: 0, errors: 0, duration_ms: Date.now() - startTime };
  }

  // Get unique artisan codes
  const uniqueCodes = [...new Set(allArtisanIds)];
  logger.info(`[sync-elite-factor] Syncing ${uniqueCodes.length} unique artisans`);

  // Build a map of code -> stats
  const statsMap = new Map<string, ArtisanStats>();

  // Fetch stats in batches
  for (let i = 0; i < uniqueCodes.length; i += BATCH_SIZE) {
    const batch = uniqueCodes.slice(i, i + BATCH_SIZE);
    const results = await processChunk(
      batch,
      async (code) => {
        const stats = await getArtisanStats(code);
        return { code, stats };
      },
      CONCURRENT_WORKERS
    );

    for (const { code, stats } of results) {
      if (stats !== null) {
        statsMap.set(code, stats);
      } else {
        notFound++;
      }
    }
  }

  // Update listings in batches by artisan_id
  for (const [code, stats] of statsMap) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('listings') as any)
      .update({
        artisan_elite_factor: stats.elite_factor,
        artisan_elite_count: stats.elite_count,
        artisan_designation_factor: stats.designation_factor,
      })
      .eq('artisan_id', code);

    if (error) {
      logger.error(`[sync-elite-factor] Error updating ${code}:`, error);
      errors++;
    } else {
      updated++;
    }
  }

  return {
    updated,
    notFound,
    errors,
    duration_ms: Date.now() - startTime,
  };
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: SyncRequest = await request.json();
    const supabase = await createServiceClient();

    let result: SyncResult;

    if (body.all) {
      logger.info('[sync-elite-factor] Starting full sync');
      result = await syncAllArtisans(supabase);
    } else if (body.artisan_codes && body.artisan_codes.length > 0) {
      logger.info(`[sync-elite-factor] Syncing ${body.artisan_codes.length} artisans`);
      result = await syncSpecificArtisans(supabase, body.artisan_codes);
    } else {
      return NextResponse.json(
        { error: 'Must provide artisan_codes array or all: true' },
        { status: 400 }
      );
    }

    logger.info('[sync-elite-factor] Sync complete', { ...result });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[sync-elite-factor] Error:', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET triggers a full sync (cron-compatible)
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('[sync-elite-factor] Starting full sync (GET/cron)');
    const supabase = await createServiceClient();
    const result = await syncAllArtisans(supabase);

    logger.info('[sync-elite-factor] Sync complete', { ...result });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[sync-elite-factor] Error:', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
