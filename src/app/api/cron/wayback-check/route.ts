/**
 * Cron job for Wayback Machine verification
 *
 * Called by GitHub Actions on a schedule (every 5 minutes)
 * Processes a small batch of listings each run
 *
 * Rate: 1 request/minute, so process ~5 listings per 5-minute cron run
 */

import { createServiceClient } from '@/lib/supabase/server';
import { checkWaybackArchive } from '@/lib/wayback';
import { NextRequest, NextResponse } from 'next/server';

// Process this many listings per cron run
// Reduced from 5 to 3 to stay within Vercel's 5-min timeout
const BATCH_SIZE = 3;

// Minimum interval between requests (ms) - 60 seconds for 1/min rate
const REQUEST_INTERVAL_MS = 60000;

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Vercel

// Type for the listing rows we fetch
interface ListingForWayback {
  id: number;
  url: string;
  first_seen_at: string;
}

/**
 * Verify the request is authorized (from GitHub Actions or with correct secret)
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret configured, allow (for local dev)
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - allowing unauthenticated access');
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also check x-cron-secret header (alternative)
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Use service client to bypass RLS for update operations
    const supabase = createServiceClient();

    // Get listings that need Wayback checking
    // Priority: oldest first (most likely to be in archive)
    // Only check available listings
    // Note: Using .or() breaks type inference, so we cast the result
    const { data, error } = await supabase
      .from('listings')
      .select('id, url, first_seen_at')
      .is('wayback_checked_at', null)
      .or(
        'freshness_confidence.eq.unknown,freshness_confidence.eq.low,freshness_confidence.is.null'
      )
      .eq('status', 'available')
      .order('first_seen_at', { ascending: true })
      .limit(BATCH_SIZE);

    // Cast to proper type since .or() breaks inference
    const listings = data as ListingForWayback[] | null;

    if (error) {
      console.error('Failed to fetch listings for Wayback check:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({
        message: 'No listings need Wayback verification',
        processed: 0,
      });
    }

    const results: Array<{
      id: number;
      url: string;
      found: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];

      // Check Wayback
      const result = await checkWaybackArchive(listing.url);

      // Update database
      const updateData: Record<string, unknown> = {
        wayback_checked_at: result.checkedAt.toISOString(),
      };

      if (result.found && result.firstArchiveAt) {
        updateData.wayback_first_archive_at =
          result.firstArchiveAt.toISOString();
        updateData.freshness_source = 'wayback';
        updateData.freshness_confidence = 'high';
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('listings')
        .update(updateData)
        .eq('id', listing.id);

      if (updateError) {
        console.error(`Failed to update listing ${listing.id}:`, updateError);
      }

      results.push({
        id: listing.id,
        url: listing.url,
        found: result.found,
        error: result.error,
      });

      // Rate limit: wait before next request (except for last one)
      if (i < listings.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} listings`,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Wayback cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
