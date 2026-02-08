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

/**
 * Verify the request is authorized via API key
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn('[sync-elite-factor] CRON_SECRET not configured');
    return false;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check x-cron-secret header
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * Fetch elite_factor from Yuhinkai for an artisan code
 */
async function getEliteFactor(artisanCode: string): Promise<number | null> {
  // Try smith_entities first
  const { data: smith } = await yuhinkaiClient
    .from('smith_entities')
    .select('elite_factor')
    .eq('smith_id', artisanCode)
    .single();

  if (smith?.elite_factor !== undefined) {
    return smith.elite_factor;
  }

  // Try tosogu_makers
  const { data: maker } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('elite_factor')
    .eq('maker_id', artisanCode)
    .single();

  if (maker?.elite_factor !== undefined) {
    return maker.elite_factor;
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

  // Fetch elite_factors for all codes concurrently
  const eliteFactors = await processChunk(
    artisanCodes,
    async (code) => {
      const factor = await getEliteFactor(code);
      return { code, factor };
    },
    CONCURRENT_WORKERS
  );

  // Update listings for each artisan
  for (const { code, factor } of eliteFactors) {
    if (factor === null) {
      notFound++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('listings') as any)
      .update({ artisan_elite_factor: factor })
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

  // Build a map of code -> elite_factor
  const eliteFactorMap = new Map<string, number>();

  // Fetch elite_factors in batches
  for (let i = 0; i < uniqueCodes.length; i += BATCH_SIZE) {
    const batch = uniqueCodes.slice(i, i + BATCH_SIZE);
    const results = await processChunk(
      batch,
      async (code) => {
        const factor = await getEliteFactor(code);
        return { code, factor };
      },
      CONCURRENT_WORKERS
    );

    for (const { code, factor } of results) {
      if (factor !== null) {
        eliteFactorMap.set(code, factor);
      } else {
        notFound++;
      }
    }
  }

  // Update listings in batches by artisan_id
  for (const [code, factor] of eliteFactorMap) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('listings') as any)
      .update({ artisan_elite_factor: factor })
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
  if (!isAuthorized(request)) {
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

// Also support GET for manual testing (admin only)
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    usage: {
      endpoint: 'POST /api/admin/sync-elite-factor',
      headers: {
        'Authorization': 'Bearer {CRON_SECRET}',
        'Content-Type': 'application/json',
      },
      body_options: [
        '{ "artisan_codes": ["MAS590", "KUN123"] }',
        '{ "all": true }',
      ],
    },
  });
}
