/**
 * Admin API: Bulk Import Detection & Flagging
 *
 * Detects and flags "secondary bulk imports" — when an expanded crawler
 * discovers old inventory from an established dealer, causing false
 * "New this week" badges and polluting the "Newest" sort.
 *
 * Authentication: Bearer token or x-cron-secret header with CRON_SECRET
 *
 * GET /api/admin/flag-bulk-import
 *   Detect spikes (dry run). Returns dealers with suspicious insert volume.
 *   Query params:
 *     threshold  - Minimum listings to flag as spike (default 15)
 *     lookback   - Hours to look back (default 24)
 *
 * POST /api/admin/flag-bulk-import
 *   Flag a dealer's recent listings as bulk imports.
 *   Body: { dealer_id: number, since?: string }
 *     dealer_id - The dealer to flag
 *     since     - ISO timestamp; flag listings with first_seen_at >= this
 *                 (default: 24 hours ago)
 *
 *   Or auto-detect and flag all spikes:
 *   Body: { auto: true, threshold?: number, lookback_hours?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';

interface SpikeResult {
  dealer_id: number;
  dealer_name: string;
  unflagged_count: number;
  earliest_insert: string;
  latest_insert: string;
}

/**
 * GET: Detect bulk import spikes (dry run)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const threshold = parseInt(url.searchParams.get('threshold') || '15', 10);
    const lookbackHours = parseInt(url.searchParams.get('lookback') || '24', 10);

    if (threshold < 1 || threshold > 1000) {
      return NextResponse.json({ error: 'threshold must be between 1 and 1000' }, { status: 400 });
    }
    if (lookbackHours < 1 || lookbackHours > 720) {
      return NextResponse.json({ error: 'lookback must be between 1 and 720 hours' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('detect_bulk_import_spikes', {
      p_threshold: threshold,
      p_lookback_hours: lookbackHours,
    });

    if (error) {
      logger.error('[flag-bulk-import] Spike detection failed', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const spikes: SpikeResult[] = data || [];

    logger.info('[flag-bulk-import] Spike detection complete', {
      threshold,
      lookbackHours,
      spikesFound: spikes.length,
    });

    return NextResponse.json({
      dry_run: true,
      threshold,
      lookback_hours: lookbackHours,
      spikes,
      total_unflagged: spikes.reduce((sum: number, s: SpikeResult) => sum + s.unflagged_count, 0),
    });
  } catch (error) {
    logger.error('[flag-bulk-import] Error:', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface FlagRequest {
  dealer_id?: number;
  since?: string;
  auto?: boolean;
  threshold?: number;
  lookback_hours?: number;
}

/**
 * POST: Flag bulk imports
 */
export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: FlagRequest = await request.json();
    const supabase = await createServiceClient();

    // Auto-detect mode: find and flag all spikes
    if (body.auto) {
      const threshold = body.threshold || 15;
      const lookbackHours = body.lookback_hours || 24;

      // First detect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: spikes, error: detectError } = await (supabase.rpc as any)('detect_bulk_import_spikes', {
        p_threshold: threshold,
        p_lookback_hours: lookbackHours,
      });

      if (detectError) {
        logger.error('[flag-bulk-import] Auto-detect failed', { error: detectError.message });
        return NextResponse.json({ error: detectError.message }, { status: 500 });
      }

      if (!spikes || spikes.length === 0) {
        return NextResponse.json({
          auto: true,
          flagged_dealers: [],
          total_flagged: 0,
          message: 'No spikes detected',
        });
      }

      // Flag each spiking dealer
      const results: Array<{ dealer_id: number; dealer_name: string; flagged: number }> = [];

      for (const spike of spikes as SpikeResult[]) {
        const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: flagged, error: flagError } = await (supabase.rpc as any)('flag_dealer_bulk_import', {
          p_dealer_id: spike.dealer_id,
          p_since: since,
        });

        if (flagError) {
          logger.error('[flag-bulk-import] Failed to flag dealer', {
            dealer_id: spike.dealer_id,
            error: flagError.message,
          });
          results.push({ dealer_id: spike.dealer_id, dealer_name: spike.dealer_name, flagged: 0 });
        } else {
          results.push({ dealer_id: spike.dealer_id, dealer_name: spike.dealer_name, flagged: flagged || 0 });
        }
      }

      const totalFlagged = results.reduce((sum, r) => sum + r.flagged, 0);

      logger.info('[flag-bulk-import] Auto-flag complete', {
        dealers: results.length,
        totalFlagged,
      });

      return NextResponse.json({
        auto: true,
        flagged_dealers: results,
        total_flagged: totalFlagged,
      });
    }

    // Manual mode: flag a specific dealer
    if (!body.dealer_id) {
      return NextResponse.json(
        { error: 'Must provide dealer_id or auto: true' },
        { status: 400 }
      );
    }

    const since = body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: flagged, error: flagError } = await (supabase.rpc as any)('flag_dealer_bulk_import', {
      p_dealer_id: body.dealer_id,
      p_since: since,
    });

    if (flagError) {
      // Surface the safety-check exceptions from the SQL function
      logger.error('[flag-bulk-import] Flag failed', {
        dealer_id: body.dealer_id,
        error: flagError.message,
      });
      return NextResponse.json({ error: flagError.message }, { status: 400 });
    }

    logger.info('[flag-bulk-import] Manual flag complete', {
      dealer_id: body.dealer_id,
      since,
      flagged,
    });

    return NextResponse.json({
      dealer_id: body.dealer_id,
      since,
      flagged: flagged || 0,
    });
  } catch (error) {
    logger.error('[flag-bulk-import] Error:', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
