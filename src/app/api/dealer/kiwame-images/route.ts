import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { KiwameEntry } from '@/types';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'dealer-images';
const MAX_KIWAME_IMAGES = 5;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const itemId = formData.get('itemId') as string | null;
    const kiwameId = formData.get('kiwameId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }
    if (!kiwameId) {
      return NextResponse.json({ error: 'kiwameId is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }

    const parsedItemId = parseInt(itemId, 10);
    if (isNaN(parsedItemId)) {
      return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 });
    }

    // Verify listing belongs to this dealer
    const serviceClient = createServiceClient();
    const { data: listing } = await (serviceClient.from('listings') as any)
      .select('id, dealer_id, source, kiwame')
      .eq('id', parsedItemId)
      .single() as { data: { id: number; dealer_id: number; source: string; kiwame: KiwameEntry[] | null } | null };

    if (!listing || listing.dealer_id !== auth.dealerId || listing.source !== 'dealer') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Find the kiwame entry
    const kiwameEntries = listing.kiwame || [];
    const entryIndex = kiwameEntries.findIndex((e: KiwameEntry) => e.id === kiwameId);
    if (entryIndex === -1) {
      return NextResponse.json({ error: 'Kiwame entry not found' }, { status: 404 });
    }

    const entry = kiwameEntries[entryIndex];
    if ((entry.images || []).length >= MAX_KIWAME_IMAGES) {
      return NextResponse.json({ error: `Maximum of ${MAX_KIWAME_IMAGES} images per kiwame entry` }, { status: 400 });
    }

    // Upload to storage: {dealerId}/{listingId}/kiwame/{uuid}.{ext}
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uuid = crypto.randomUUID();
    const path = `${auth.dealerId}/${itemId}/kiwame/${uuid}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error('Error uploading kiwame image', { error: uploadError });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(path);

    // Append URL to the kiwame entry's images array
    const updatedEntries = [...kiwameEntries];
    updatedEntries[entryIndex] = {
      ...entry,
      images: [...(entry.images || []), urlData.publicUrl],
    };

    const { error: updateError } = await (serviceClient.from('listings') as any)
      .update({ kiwame: updatedEntries })
      .eq('id', parsedItemId);

    if (updateError) {
      logger.error('Error updating kiwame images', { error: updateError });
      await serviceClient.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
    }

    return NextResponse.json({
      path,
      publicUrl: urlData.publicUrl,
    }, { status: 201 });
  } catch (error) {
    logger.logError('Kiwame image upload error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, itemId, kiwameId } = await request.json();
    if (!imageUrl || !itemId || !kiwameId) {
      return NextResponse.json({ error: 'imageUrl, itemId, and kiwameId are required' }, { status: 400 });
    }

    const listingId = parseInt(itemId, 10);
    if (isNaN(listingId)) {
      return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 });
    }

    // Verify listing belongs to this dealer
    const serviceClient = createServiceClient();
    const { data: listing } = await (serviceClient.from('listings') as any)
      .select('id, dealer_id, source, kiwame')
      .eq('id', listingId)
      .single() as { data: { id: number; dealer_id: number; source: string; kiwame: KiwameEntry[] | null } | null };

    if (!listing || listing.dealer_id !== auth.dealerId || listing.source !== 'dealer') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Extract storage path from public URL
    const bucketMarker = `/${BUCKET}/`;
    const bucketIdx = imageUrl.indexOf(bucketMarker);
    const storagePath = bucketIdx !== -1
      ? imageUrl.slice(bucketIdx + bucketMarker.length)
      : null;

    // Verify storage path belongs to this dealer (reject traversal attempts)
    if (!storagePath || storagePath.includes('..') || !storagePath.startsWith(`${auth.dealerId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Remove from storage
    const { error: storageError } = await serviceClient.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (storageError) {
      logger.warn('Failed to remove kiwame image from storage', { error: storageError });
    }

    // Remove URL from the kiwame entry's images array
    const kiwameEntries = listing.kiwame || [];
    const entryIndex = kiwameEntries.findIndex((e: KiwameEntry) => e.id === kiwameId);
    if (entryIndex !== -1) {
      const updatedEntries = [...kiwameEntries];
      updatedEntries[entryIndex] = {
        ...kiwameEntries[entryIndex],
        images: (kiwameEntries[entryIndex].images || []).filter((img: string) => img !== imageUrl),
      };

      const { error: updateError } = await (serviceClient.from('listings') as any)
        .update({ kiwame: updatedEntries })
        .eq('id', listingId);

      if (updateError) {
        logger.error('Failed to update kiwame after image removal', { error: updateError, listingId });
        return NextResponse.json({ error: 'Image removed from storage but listing update failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Kiwame image delete error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
