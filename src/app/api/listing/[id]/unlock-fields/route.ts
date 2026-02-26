/**
 * Unlock Fields API
 *
 * POST /api/listing/[id]/unlock-fields
 * Body: { fields: ["smith", "province"] }
 *
 * Removes specified fields from admin_locked_fields JSONB.
 * Does NOT change field values — the next scraper run will overwrite them.
 */

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

interface UnlockFieldsRequestBody {
  fields: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId) || listingId <= 0) {
      return apiBadRequest('Invalid listing ID');
    }

    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { user } = authResult;

    // Parse request body
    let body: UnlockFieldsRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { fields } = body;

    if (!Array.isArray(fields) || fields.length === 0) {
      return apiBadRequest('fields array is required and must not be empty');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Fetch existing locks
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, admin_locked_fields')
      .eq('id', listingId)
      .single() as { data: { id: number; admin_locked_fields: Record<string, boolean> | null } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    // Remove specified fields from locks
    const existingLocks = listing.admin_locked_fields || {};
    const updatedLocks = { ...existingLocks };
    for (const field of fields) {
      delete updatedLocks[field];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update({ admin_locked_fields: updatedLocks })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Unlock fields failed', {
        listingId,
        error: updateError.message,
        fields,
      });
      return apiServerError(`Failed to unlock fields: ${updateError.message}`);
    }

    logger.info('Fields unlocked on listing', {
      listingId,
      unlockedFields: fields,
      remainingLocks: Object.keys(updatedLocks),
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      listingId,
      unlockedFields: fields,
      lockedFields: updatedLocks,
    });
  } catch (error) {
    logger.logError('Unlock fields error', error);
    return apiServerError();
  }
}
