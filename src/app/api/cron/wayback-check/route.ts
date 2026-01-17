/**
 * Cron job for Wayback Machine verification
 *
 * Designed to be called by Vercel Cron (or manually)
 * Processes a small batch of listings each run
 *
 * Rate: 1 request/minute, so process ~5 listings per 5-minute cron run
 */

import { createClient } from '@/lib/supabase/server';
import { checkWaybackArchive } from '@/lib/wayback';
import { NextResponse } from 'next/server';

// Process this many listings per cron run
const BATCH_SIZE = 5;

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

export async function GET() {
  try {
    const supabase = await createClient();

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
