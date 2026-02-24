/**
 * Compute featured scores for all available listings
 *
 * Scoring model:
 *   quality (0-395) = artisan_stature + cert_points + completeness
 *   heat (0-160)    = favorites + dealer_clicks + quickview_opens + views + pinch_zooms
 *   freshness       = multiplier based on listing age (0.3 – 1.4)
 *   featured_score  = (quality + heat) × freshness
 *
 * Listings without images get featured_score = 0 (disqualified).
 *
 * Schedule: every 4 hours (vercel.json)
 * Auth: CRON_SECRET (Bearer or x-cron-secret header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import { logger } from '@/lib/logger';
import {
  computeQuality,
  computeFreshness,
  imageCount,
  type ListingScoreInput,
} from '@/lib/featured/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const HEAT_30_DAY_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Types (extends ListingScoreInput with cron-only fields)
// ---------------------------------------------------------------------------

interface ListingRow extends ListingScoreInput {
  dealer_id: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasImages(listing: ListingRow): boolean {
  return imageCount(listing) > 0;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - HEAT_30_DAY_MS).toISOString();

    // ------------------------------------------------------------------
    // 1. Fetch behavioral data (30-day window) — single RPC call
    // ------------------------------------------------------------------

    const favoriteMap = new Map<number, number>();
    const clickMap = new Map<number, number>();
    const viewMap = new Map<number, number>();
    const quickviewMap = new Map<number, number>();
    const pinchZoomMap = new Map<number, number>();

    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: engagement, error: engErr } = await (supabase.rpc as any)(
        'get_listing_engagement_counts',
        { p_since: thirtyDaysAgo }
      );

      if (engErr) {
        logger.error('[featured-scores] Engagement RPC error', { error: engErr });
      } else if (engagement) {
        for (const row of engagement as { listing_id: number; favorites: number; dealer_clicks: number; views: number; quickview_opens: number; pinch_zooms: number }[]) {
          if (!row.listing_id) continue;
          if (row.favorites > 0) favoriteMap.set(row.listing_id, row.favorites);
          if (row.dealer_clicks > 0) clickMap.set(row.listing_id, row.dealer_clicks);
          if (row.views > 0) viewMap.set(row.listing_id, row.views);
          if (row.quickview_opens > 0) quickviewMap.set(row.listing_id, row.quickview_opens);
          if (row.pinch_zooms > 0) pinchZoomMap.set(row.listing_id, row.pinch_zooms);
        }
      }
    }

    logger.info('[featured-scores] Behavioral data loaded', {
      favorites: favoriteMap.size,
      clicks: clickMap.size,
      views: viewMap.size,
      quickviews: quickviewMap.size,
      pinchZooms: pinchZoomMap.size,
    });

    // ------------------------------------------------------------------
    // 2. Process available listings in pages
    // ------------------------------------------------------------------

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalZeroed = 0;
    let offset = 0;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listings, error } = await (supabase.from('listings') as any)
        .select('id, artisan_id, artisan_elite_factor, artisan_elite_count, cert_type, price_value, price_currency, artisan_confidence, images, first_seen_at, is_initial_import, dealer_id, smith, tosogu_maker, school, tosogu_school, era, province, description, nagasa_cm, sori_cm, motohaba_cm, tosogu_height_cm, tosogu_width_cm')
        .eq('is_available', true)
        .range(offset, offset + PAGE_SIZE - 1) as { data: ListingRow[] | null; error: unknown };

      if (error) {
        logger.error('[featured-scores] Query error at offset', { offset, error });
        break;
      }

      if (!listings || listings.length === 0) break;

      // Compute scores
      const updates: { id: number; score: number }[] = [];

      for (const listing of listings) {
        if (!hasImages(listing)) {
          updates.push({ id: listing.id, score: 0 });
          totalZeroed++;
          continue;
        }

        const quality = computeQuality(listing);

        // Heat (0-160)
        const favorites = favoriteMap.get(listing.id) ?? 0;
        const clicks = clickMap.get(listing.id) ?? 0;
        const quickviews = quickviewMap.get(listing.id) ?? 0;
        const views = viewMap.get(listing.id) ?? 0;
        const pinchZooms = pinchZoomMap.get(listing.id) ?? 0;

        const heat =
          Math.min(favorites * 15, 60) +
          Math.min(clicks * 10, 40) +
          Math.min(quickviews * 3, 24) +
          Math.min(views * 1, 20) +
          Math.min(pinchZooms * 8, 16);

        const freshness = computeFreshness(listing);
        const score = Math.round((quality + heat) * freshness * 100) / 100;

        updates.push({ id: listing.id, score });
      }

      // Batch update in chunks
      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const chunk = updates.slice(i, i + UPDATE_BATCH_SIZE);
        await Promise.all(
          chunk.map(({ id, score }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from('listings') as any)
              .update({ featured_score: score })
              .eq('id', id)
          )
        );
        totalUpdated += chunk.length;
      }

      totalProcessed += listings.length;

      if (listings.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ------------------------------------------------------------------
    // 3. Zero out scores for non-available listings (sold/withdrawn)
    //    Only update those that currently have a non-zero/non-null score
    // ------------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: zeroError } = await (supabase.from('listings') as any)
      .update({ featured_score: 0 })
      .eq('is_available', false)
      .gt('featured_score', 0);

    if (zeroError) {
      logger.error('[featured-scores] Error zeroing non-available listings', { error: zeroError });
    }

    const durationMs = Date.now() - startTime;
    logger.info('[featured-scores] Complete', {
      totalProcessed,
      totalUpdated,
      totalZeroed,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalUpdated,
      totalZeroed,
      durationMs,
    });
  } catch (error) {
    logger.logError('[featured-scores] Fatal error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
