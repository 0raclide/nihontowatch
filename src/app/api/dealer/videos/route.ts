/**
 * POST /api/dealer/videos — Create video upload slot (TUS credentials)
 * GET  /api/dealer/videos?listingId=X — Fetch videos for a listing
 *
 * Videos are stored in `item_videos` keyed by `item_uuid`.
 * The API accepts `listingId` and resolves `item_uuid` internally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import {
  insertItemVideo,
  selectItemVideos,
  updateItemVideo,
} from '@/lib/supabase/itemVideos';
import type { ItemVideoRow } from '@/types/collectionItem';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isVideoProviderConfigured()) {
      return NextResponse.json({ error: 'Video uploads not configured' }, { status: 503 });
    }

    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const body = await request.json();
    const { listingId, filename } = body;

    if (!listingId || !filename) {
      return NextResponse.json({ error: 'listingId and filename are required' }, { status: 400 });
    }

    // Verify listing belongs to this dealer and resolve item_uuid
    const serviceClient = createServiceClient();
    const { data: listing } = await serviceClient
      .from('listings')
      .select('id, dealer_id, item_uuid, owner_id')
      .eq('id', listingId)
      .single();

    if (!listing || (listing as { dealer_id: number }).dealer_id !== auth.dealerId) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const typedListing = listing as { id: number; dealer_id: number; item_uuid: string | null; owner_id: string | null };

    if (!typedListing.item_uuid) {
      return NextResponse.json({ error: 'Listing has no item_uuid — cannot attach videos' }, { status: 400 });
    }

    // Create video in Bunny and get TUS upload credentials
    const uploadResult = await videoProvider.createUpload(filename);

    // Insert item_videos row (status='processing')
    const { data: videoRow, error: insertError } = await insertItemVideo(serviceClient, {
      item_uuid: typedListing.item_uuid,
      owner_id: typedListing.owner_id || auth.user.id,
      provider: 'bunny',
      provider_id: uploadResult.videoId,
      status: 'processing',
      original_filename: filename,
    });

    if (insertError || !videoRow) {
      // Best-effort cleanup: delete the Bunny video if DB insert fails
      try { await videoProvider.deleteVideo(uploadResult.videoId); } catch {}
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 });
    }

    return NextResponse.json({
      videoId: videoRow.id,
      providerId: uploadResult.videoId,
      uploadUrl: uploadResult.uploadUrl,
      libraryId: uploadResult.libraryId,
      authSignature: uploadResult.authSignature,
      authExpire: uploadResult.authExpire,
    });
  } catch (err) {
    console.error('POST /api/dealer/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const listingId = request.nextUrl.searchParams.get('listingId');
    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    // Verify listing belongs to this dealer and resolve item_uuid
    const serviceClient = createServiceClient();
    const { data: listing } = await serviceClient
      .from('listings')
      .select('id, dealer_id, item_uuid')
      .eq('id', Number(listingId))
      .single();

    if (!listing || (listing as { dealer_id: number }).dealer_id !== auth.dealerId) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const itemUuid = (listing as { item_uuid: string | null }).item_uuid;
    if (!itemUuid) {
      return NextResponse.json({ videos: [] });
    }

    const { data: videos, error } = await selectItemVideos(
      serviceClient, 'item_uuid', itemUuid, '*',
      { column: 'sort_order', ascending: true }
    );

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    // For processing videos, check current status from Bunny and update if changed
    const enriched = await Promise.all(
      (videos || []).map(async (v: ItemVideoRow) => {
        if (v.status === 'processing' && isVideoProviderConfigured()) {
          try {
            const bunnyStatus = await videoProvider.getVideoStatus(v.provider_id);
            if (bunnyStatus.status !== 'processing') {
              const streamUrl = bunnyStatus.status === 'ready'
                ? videoProvider.getStreamUrl(v.provider_id)
                : null;

              // Update DB with new status + metadata + stream_url
              await updateItemVideo(serviceClient, v.id, {
                status: bunnyStatus.status as 'ready' | 'failed',
                duration_seconds: bunnyStatus.duration ?? null,
                width: bunnyStatus.width ?? null,
                height: bunnyStatus.height ?? null,
                thumbnail_url: bunnyStatus.thumbnailUrl ?? null,
                stream_url: streamUrl,
              });

              v.status = bunnyStatus.status as 'ready' | 'failed';
              v.duration_seconds = bunnyStatus.duration ?? null;
              v.width = bunnyStatus.width ?? null;
              v.height = bunnyStatus.height ?? null;
              v.thumbnail_url = bunnyStatus.thumbnailUrl ?? null;
              v.stream_url = streamUrl;
            }
          } catch {
            // Bunny poll failed — keep existing status
          }
        }

        return {
          ...v,
          // Ensure stream_url is always computed for ready videos (fallback if not cached in DB)
          stream_url: v.status === 'ready'
            ? (v.stream_url || videoProvider.getStreamUrl(v.provider_id))
            : undefined,
        };
      })
    );

    return NextResponse.json({ videos: enriched });
  } catch (err) {
    console.error('GET /api/dealer/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
