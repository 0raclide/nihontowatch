/**
 * DELETE /api/collection/videos/[id] — Delete a video
 *
 * Ownership verified via item_videos.owner_id = auth.user.id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import { selectItemVideoSingle, deleteItemVideo } from '@/lib/supabase/itemVideos';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Fetch video + verify ownership directly via owner_id
    const { data: video } = await selectItemVideoSingle(
      serviceClient, 'id', videoId, 'id, provider_id, owner_id'
    );

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from Bunny (Critical Rule #9: must await)
    if (isVideoProviderConfigured()) {
      try {
        await videoProvider.deleteVideo(video.provider_id);
      } catch (err) {
        console.error('Failed to delete video from Bunny:', err);
        // Continue with DB deletion even if Bunny fails
      }
    }

    // Delete from DB
    const { error: deleteError } = await deleteItemVideo(serviceClient, videoId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete video record' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/collection/videos/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
