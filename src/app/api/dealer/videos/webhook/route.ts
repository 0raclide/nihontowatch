/**
 * POST /api/dealer/videos/webhook — Bunny transcoding callback
 *
 * Called by Bunny Stream when video encoding status changes.
 * No user auth — webhook from Bunny. Uses service role key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { videoProvider } from '@/lib/video/videoProvider';
import { selectListingVideoSingle, updateListingVideo } from '@/lib/supabase/listingVideos';
import type { ListingVideosRow } from '@/types/media';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Bunny webhook sends: { VideoId, Status, ... }
    const { VideoId: providerId, Status: bunnyStatus } = body;

    if (!providerId) {
      return NextResponse.json({ error: 'Missing VideoId' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Find the listing_videos row by provider_id
    const { data: video } = await selectListingVideoSingle(
      serviceClient, 'provider_id', providerId, 'id, provider_id'
    );

    if (!video) {
      // Video not in our DB — ignore (may be from oshi-v2 or another app sharing the Bunny library)
      return NextResponse.json({ ok: true });
    }

    // Map Bunny status codes → our status
    // Bunny: 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error, 6=upload_failed
    let status: 'processing' | 'ready' | 'failed' = 'processing';
    if (bunnyStatus === 4) {
      status = 'ready';
    } else if (bunnyStatus === 5 || bunnyStatus === 6) {
      status = 'failed';
    }

    // Fetch full metadata from Bunny API when ready
    const updateData: Partial<ListingVideosRow> = { status };

    if (status === 'ready') {
      try {
        const videoStatus = await videoProvider.getVideoStatus(providerId);
        updateData.duration_seconds = videoStatus.duration ?? null;
        updateData.width = videoStatus.width ?? null;
        updateData.height = videoStatus.height ?? null;
        updateData.thumbnail_url = videoStatus.thumbnailUrl ?? null;
      } catch {
        // Metadata fetch failed — status update still proceeds
      }
    }

    await updateListingVideo(serviceClient, video.id, updateData);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Bunny webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
