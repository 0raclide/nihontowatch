/**
 * POST /api/collection/videos — Create video upload slot (TUS credentials)
 * GET  /api/collection/videos?itemId=X — Fetch videos for a collection item
 *
 * Videos are stored in `item_videos` keyed by `item_uuid`.
 * Collection items always have item_uuid (NOT nullable like listings).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import {
  insertItemVideo,
  selectItemVideos,
  updateItemVideo,
} from '@/lib/supabase/itemVideos';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';
import { checkCollectionAccess } from '@/lib/collection/access';
import type { ItemVideoRow } from '@/types/collectionItem';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isVideoProviderConfigured()) {
      return NextResponse.json({ error: 'Video uploads not configured' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const body = await request.json();
    const { itemId, filename } = body;

    if (!itemId || !filename) {
      return NextResponse.json({ error: 'itemId and filename are required' }, { status: 400 });
    }

    // Verify item ownership and get item_uuid
    const serviceClient = createServiceClient();
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', itemId, 'id, owner_id, item_uuid'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Create video in Bunny and get TUS upload credentials
    const uploadResult = await videoProvider.createUpload(filename);

    // Insert item_videos row (status='processing')
    const { data: videoRow, error: insertError } = await insertItemVideo(serviceClient, {
      item_uuid: item.item_uuid,
      owner_id: user.id,
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
    console.error('POST /api/collection/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const itemId = request.nextUrl.searchParams.get('itemId');
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    // Verify item ownership and get item_uuid
    const serviceClient = createServiceClient();
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', itemId, 'id, owner_id, item_uuid'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: videos, error } = await selectItemVideos(
      serviceClient, 'item_uuid', item.item_uuid, '*',
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
          stream_url: v.status === 'ready'
            ? (v.stream_url || videoProvider.getStreamUrl(v.provider_id))
            : undefined,
        };
      })
    );

    return NextResponse.json({ videos: enriched });
  } catch (err) {
    console.error('GET /api/collection/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
