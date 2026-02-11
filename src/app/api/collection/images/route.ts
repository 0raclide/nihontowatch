import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const itemId = formData.get('itemId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }

    // Verify item ownership
    const { data: item } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id, images')
      .eq('id', itemId)
      .single() as { data: { id: string; user_id: string; images: string[] | null } | null };

    if (!item || item.user_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Max 20 images per item
    const currentImages = (item.images as string[]) || [];
    if (currentImages.length >= 20) {
      return NextResponse.json({ error: 'Maximum of 20 images per item' }, { status: 400 });
    }

    // Generate storage path
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uuid = crypto.randomUUID();
    const path = `${user.id}/${itemId}/${uuid}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('collection-images')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error('Error uploading collection image', { error: uploadError });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Add path to item's images array
    const updatedImages = [...currentImages, path];
    const { error: updateError } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ images: updatedImages } as never)
      .eq('id', itemId);

    if (updateError) {
      logger.error('Error updating item images', { error: updateError });
      // Cleanup uploaded file
      await supabase.storage.from('collection-images').remove([path]);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('collection-images')
      .getPublicUrl(path);

    return NextResponse.json({
      path,
      publicUrl: urlData.publicUrl,
    }, { status: 201 });
  } catch (error) {
    logger.logError('Image upload error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, itemId } = await request.json();
    if (!imageUrl || !itemId) {
      return NextResponse.json({ error: 'imageUrl and itemId are required' }, { status: 400 });
    }

    // Extract storage path from public URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/collection-images/{user_id}/{item_id}/{uuid}.ext
    const bucketMarker = '/collection-images/';
    const bucketIdx = imageUrl.indexOf(bucketMarker);
    const storagePath = bucketIdx !== -1
      ? imageUrl.slice(bucketIdx + bucketMarker.length)
      : null;

    // Verify storage path belongs to this user (if it's a Supabase URL)
    if (storagePath && !storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify item ownership
    const { data: item } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id, images')
      .eq('id', itemId)
      .single() as { data: { id: string; user_id: string; images: string[] | null } | null };

    if (!item || item.user_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Remove from storage (only for Supabase-hosted images)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('collection-images')
        .remove([storagePath]);

      if (storageError) {
        logger.warn('Failed to remove image from storage', { error: storageError });
      }
    }

    // Remove from item's images array (match on the full URL)
    const currentImages = (item.images as string[]) || [];
    const updatedImages = currentImages.filter(img => img !== imageUrl);
    await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ images: updatedImages } as never)
      .eq('id', itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Image delete error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
