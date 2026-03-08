/**
 * DELETE /api/dealer/videos/[id] — Delete a video
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import { selectListingVideoSingle, deleteListingVideo } from '@/lib/supabase/listingVideos';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const serviceClient = createServiceClient();

    // Fetch video + verify it belongs to dealer's listing
    const { data: video } = await selectListingVideoSingle(
      serviceClient, 'id', videoId, 'id, provider_id, listing_id'
    );

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const { data: listing } = await serviceClient
      .from('listings')
      .select('dealer_id')
      .eq('id', video.listing_id)
      .single();

    if (!listing || (listing as { dealer_id: number }).dealer_id !== auth.dealerId) {
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
    const { error: deleteError } = await deleteListingVideo(serviceClient, videoId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete video record' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/dealer/videos/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
