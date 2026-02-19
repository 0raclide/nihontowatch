/**
 * Compute featured scores for all available listings
 *
 * Scoring model:
 *   quality (0-355) = artisan_stature + cert_points + completeness
 *   heat (0-160)    = favorites + dealer_clicks + quickview_opens + views + pinch_zooms
 *   freshness       = multiplier based on listing age (0.7 – 1.4)
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

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const CERT_POINTS: Record<string, number> = {
  'Tokuju': 40,
  'Tokubetsu Juyo': 40,
  'tokubetsu_juyo': 40,
  'Juyo': 28,
  'juyo': 28,
  'Juyo Tosogu': 28,
  'TokuHozon': 14,
  'Tokubetsu Hozon': 14,
  'tokubetsu_hozon': 14,
  'Tokubetsu Hozon Tosogu': 14,
  'Hozon': 7,
  'hozon': 7,
  'Hozon Tosogu': 7,
  'Juyo Bijutsuhin': 35,
  'JuBi': 35,
  'TokuKicho': 10,
  'Tokubetsu Kicho': 10,
};

const HEAT_30_DAY_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingRow {
  id: number;
  artisan_id: string | null;
  artisan_elite_factor: number | null;
  artisan_elite_count: number | null;
  cert_type: string | null;
  price_value: number | null;
  artisan_confidence: string | null;
  images: unknown;
  first_seen_at: string | null;
  is_initial_import: boolean | null;
  dealer_id: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Artisan IDs that are catch-all buckets, not real artisan matches
const IGNORE_ARTISAN_IDS = new Set(['UNKNOWN', 'unknown']);

function computeQuality(listing: ListingRow): number {
  // Treat catch-all artisan IDs as no match
  const hasRealArtisan = listing.artisan_id && !IGNORE_ARTISAN_IDS.has(listing.artisan_id);
  const eliteFactor = hasRealArtisan ? (listing.artisan_elite_factor ?? 0) : 0;
  const eliteCount = hasRealArtisan ? (listing.artisan_elite_count ?? 0) : 0;

  const artisanStature = (eliteFactor * 200) + Math.min(Math.sqrt(eliteCount) * 18, 100);
  const certPts = listing.cert_type ? (CERT_POINTS[listing.cert_type] ?? 0) : 0;
  const completeness =
    (listing.price_value ? 10 : 0) +
    (listing.artisan_confidence === 'HIGH' ? 5 : 0);

  return artisanStature + certPts + completeness;
}

function computeFreshness(listing: ListingRow): number {
  if (listing.is_initial_import) return 1.0;

  if (!listing.first_seen_at) return 1.0;

  const ageMs = Date.now() - new Date(listing.first_seen_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 3) return 1.4;
  if (ageDays < 7) return 1.2;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.85;
  return 0.7;
}

function hasImages(listing: ListingRow): boolean {
  if (!listing.images) return false;
  if (Array.isArray(listing.images)) return listing.images.length > 0;
  return false;
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
    // 1. Fetch behavioral data (30-day window) — single aggregated query per source
    // ------------------------------------------------------------------

    // Favorites per listing (30-day window)
    const favoriteMap = new Map<number, number>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('user_favorites') as any)
        .select('listing_id')
        .gte('created_at', thirtyDaysAgo) as { data: { listing_id: number }[] | null };

      if (data) {
        for (const row of data) {
          favoriteMap.set(row.listing_id, (favoriteMap.get(row.listing_id) ?? 0) + 1);
        }
      }
    }

    // Dealer clicks per listing (30-day window)
    const clickMap = new Map<number, number>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('dealer_clicks') as any)
        .select('listing_id')
        .not('listing_id', 'is', null)
        .gte('created_at', thirtyDaysAgo) as { data: { listing_id: number }[] | null };

      if (data) {
        for (const row of data) {
          clickMap.set(row.listing_id, (clickMap.get(row.listing_id) ?? 0) + 1);
        }
      }
    }

    // Unique views per listing (30-day window) — listing_views already deduplicates per session/day
    const viewMap = new Map<number, number>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('listing_views') as any)
        .select('listing_id')
        .gte('viewed_at', thirtyDaysAgo) as { data: { listing_id: number }[] | null };

      if (data) {
        for (const row of data) {
          viewMap.set(row.listing_id, (viewMap.get(row.listing_id) ?? 0) + 1);
        }
      }
    }

    // QuickView opens per listing (30-day window)
    const quickviewMap = new Map<number, number>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('activity_events') as any)
        .select('event_data')
        .eq('event_type', 'quickview_open')
        .gte('created_at', thirtyDaysAgo) as { data: { event_data: { listingId?: number } }[] | null };

      if (data) {
        for (const row of data) {
          const listingId = row.event_data?.listingId;
          if (listingId) {
            quickviewMap.set(listingId, (quickviewMap.get(listingId) ?? 0) + 1);
          }
        }
      }
    }

    // Pinch zooms per listing (30-day window)
    const pinchZoomMap = new Map<number, number>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('activity_events') as any)
        .select('event_data')
        .eq('event_type', 'image_pinch_zoom')
        .gte('created_at', thirtyDaysAgo) as { data: { event_data: { listingId?: number } }[] | null };

      if (data) {
        for (const row of data) {
          const listingId = row.event_data?.listingId;
          if (listingId) {
            pinchZoomMap.set(listingId, (pinchZoomMap.get(listingId) ?? 0) + 1);
          }
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
        .select('id, artisan_id, artisan_elite_factor, artisan_elite_count, cert_type, price_value, artisan_confidence, images, first_seen_at, is_initial_import, dealer_id')
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
