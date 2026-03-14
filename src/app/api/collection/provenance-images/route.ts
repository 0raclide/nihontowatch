import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { selectCollectionItemSingle, updateCollectionItem } from '@/lib/supabase/collectionItems';
import { checkCollectionAccess } from '@/lib/collection/access';
import type { ProvenanceData } from '@/types';
import { normalizeProvenance } from '@/lib/provenance/normalize';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'user-images';
const MAX_DOCUMENTS = 10;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const itemId = formData.get('itemId') as string | null;
    const provenanceId = formData.get('provenanceId') as string | null;
    const role = (formData.get('role') as string | null) || 'portrait';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    if (role === 'portrait' && !provenanceId) return NextResponse.json({ error: 'provenanceId is required for portrait uploads' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', itemId, 'id, owner_id, item_uuid, provenance'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Normalize legacy data
    const provenance: ProvenanceData = normalizeProvenance(item.provenance) || { entries: [], documents: [] };

    if (role === 'portrait') {
      const entryIndex = provenance.entries.findIndex(e => e.id === provenanceId);
      if (entryIndex === -1) {
        return NextResponse.json({ error: 'Provenance entry not found' }, { status: 404 });
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const uuid = crypto.randomUUID();
      const path = `${user.id}/${item.item_uuid}/provenance/${uuid}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await serviceClient.storage
        .from(BUCKET)
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        logger.error('Error uploading provenance portrait', { error: uploadError });
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }

      const { data: urlData } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

      provenance.entries[entryIndex] = {
        ...provenance.entries[entryIndex],
        portrait_image: urlData.publicUrl,
      };

      const { error: updateError } = await updateCollectionItem(serviceClient, itemId, { provenance });
      if (updateError) {
        logger.error('Error updating provenance portrait', { error: updateError });
        await serviceClient.storage.from(BUCKET).remove([path]);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
      }

      return NextResponse.json({ path, publicUrl: urlData.publicUrl }, { status: 201 });
    }

    // role === 'document'
    if (provenance.documents.length >= MAX_DOCUMENTS) {
      return NextResponse.json({ error: `Maximum of ${MAX_DOCUMENTS} supporting documents` }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uuid = crypto.randomUUID();
    const path = `${user.id}/${item.item_uuid}/provenance/${uuid}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      logger.error('Error uploading provenance document', { error: uploadError });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: urlData } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

    provenance.documents.push(urlData.publicUrl);

    const { error: updateError } = await updateCollectionItem(serviceClient, itemId, { provenance });
    if (updateError) {
      logger.error('Error updating provenance documents', { error: updateError });
      await serviceClient.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ path, publicUrl: urlData.publicUrl }, { status: 201 });
  } catch (error) {
    logger.logError('Provenance image upload error', error);
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

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const { imageUrl, itemId, provenanceId, role = 'portrait' } = await request.json();
    if (!imageUrl || !itemId) {
      return NextResponse.json({ error: 'imageUrl and itemId are required' }, { status: 400 });
    }
    if (role === 'portrait' && !provenanceId) {
      return NextResponse.json({ error: 'provenanceId is required for portrait deletion' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', itemId, 'id, owner_id, provenance'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const bucketMarker = `/${BUCKET}/`;
    const bucketIdx = imageUrl.indexOf(bucketMarker);
    const storagePath = bucketIdx !== -1 ? imageUrl.slice(bucketIdx + bucketMarker.length) : null;

    if (!storagePath || storagePath.includes('..') || !storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: storageError } = await serviceClient.storage.from(BUCKET).remove([storagePath]);
    if (storageError) {
      logger.warn('Failed to remove provenance image from storage', { error: storageError });
    }

    // Normalize legacy data
    const provenance: ProvenanceData = normalizeProvenance(item.provenance) || { entries: [], documents: [] };

    if (role === 'portrait') {
      const entryIndex = provenance.entries.findIndex(e => e.id === provenanceId);
      if (entryIndex !== -1) {
        provenance.entries[entryIndex] = {
          ...provenance.entries[entryIndex],
          portrait_image: null,
        };
      }
    } else {
      provenance.documents = provenance.documents.filter(url => url !== imageUrl);
    }

    const { error: updateError } = await updateCollectionItem(serviceClient, itemId, { provenance });
    if (updateError) {
      logger.error('Failed to update provenance after image removal', { error: updateError, itemId });
      return NextResponse.json({ error: 'Image removed from storage but item update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Provenance image delete error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
