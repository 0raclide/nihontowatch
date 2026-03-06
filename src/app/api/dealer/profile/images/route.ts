import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const BUCKET = 'dealer-images';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const IMAGE_TYPE_CONFIG = {
  logo: { maxSize: 2 * 1024 * 1024, dbColumn: 'logo_url' },
  banner: { maxSize: 5 * 1024 * 1024, dbColumn: 'banner_url' },
  shop: { maxSize: 5 * 1024 * 1024, dbColumn: 'shop_photo_url' },
} as const;

type ProfileImageType = keyof typeof IMAGE_TYPE_CONFIG;

function isValidImageType(type: string): type is ProfileImageType {
  return type in IMAGE_TYPE_CONFIG;
}

/**
 * POST /api/dealer/profile/images
 * Upload a profile image (logo, banner, or shop photo).
 * Replaces existing image of the same type.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!type || !isValidImageType(type)) {
      return NextResponse.json({ error: 'type must be "logo", "banner", or "shop"' }, { status: 400 });
    }

    const config = IMAGE_TYPE_CONFIG[type];

    if (file.size > config.maxSize) {
      const maxMb = config.maxSize / (1024 * 1024);
      return NextResponse.json({ error: `File too large (max ${maxMb}MB)` }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Check for existing image to replace
    const { data: dealer } = await (serviceClient.from('dealers') as any)
      .select(config.dbColumn)
      .eq('id', auth.dealerId)
      .single() as { data: Record<string, string | null> | null };

    const existingUrl = dealer?.[config.dbColumn] ?? null;

    // Delete old file from storage if exists
    if (existingUrl) {
      const bucketMarker = `/${BUCKET}/`;
      const bucketIdx = existingUrl.indexOf(bucketMarker);
      if (bucketIdx !== -1) {
        const oldPath = existingUrl.slice(bucketIdx + bucketMarker.length);
        if (oldPath.startsWith(`${auth.dealerId}/`) && !oldPath.includes('..')) {
          await serviceClient.storage.from(BUCKET).remove([oldPath]);
        }
      }
    }

    // Upload new file
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uuid = crypto.randomUUID();
    const path = `${auth.dealerId}/profile/${type}/${uuid}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      logger.error('Profile image upload failed', { error: uploadError });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL and update DB
    const { data: urlData } = serviceClient.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await (serviceClient.from('dealers') as any)
      .update({ [config.dbColumn]: publicUrl })
      .eq('id', auth.dealerId);

    if (updateError) {
      logger.error('Profile image DB update failed', { error: updateError });
      await serviceClient.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ publicUrl }, { status: 201 });
  } catch (error) {
    logger.logError('Profile image upload error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/dealer/profile/images
 * Remove a profile image (logo, banner, or shop photo).
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await request.json();
    if (!type || !isValidImageType(type)) {
      return NextResponse.json({ error: 'type must be "logo", "banner", or "shop"' }, { status: 400 });
    }

    const config = IMAGE_TYPE_CONFIG[type];
    const serviceClient = createServiceClient();

    // Get current URL
    const { data: dealer } = await (serviceClient.from('dealers') as any)
      .select(config.dbColumn)
      .eq('id', auth.dealerId)
      .single() as { data: Record<string, string | null> | null };

    const currentUrl = dealer?.[config.dbColumn] ?? null;

    if (currentUrl) {
      // Extract and validate storage path
      const bucketMarker = `/${BUCKET}/`;
      const bucketIdx = currentUrl.indexOf(bucketMarker);
      if (bucketIdx !== -1) {
        const storagePath = currentUrl.slice(bucketIdx + bucketMarker.length);
        if (storagePath.startsWith(`${auth.dealerId}/profile/`) && !storagePath.includes('..')) {
          const { error: storageError } = await serviceClient.storage.from(BUCKET).remove([storagePath]);
          if (storageError) {
            logger.warn('Failed to remove profile image from storage', { error: storageError });
          }
        }
      }
    }

    // Null the DB column
    const { error: updateError } = await (serviceClient.from('dealers') as any)
      .update({ [config.dbColumn]: null })
      .eq('id', auth.dealerId);

    if (updateError) {
      logger.error('Failed to null profile image column', { error: updateError });
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Profile image delete error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
