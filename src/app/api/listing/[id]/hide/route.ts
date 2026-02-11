/**
 * Hide Listing API
 *
 * POST /api/listing/[id]/hide
 * Body: { hidden: boolean }
 *
 * Toggles admin_hidden on a listing to hide/unhide from public views.
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
    let body: { hidden: boolean };
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    if (typeof body.hidden !== 'boolean') {
      return apiBadRequest('hidden must be a boolean');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Check if listing exists
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, admin_hidden')
      .eq('id', listingId)
      .single() as { data: { id: number; admin_hidden: boolean } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    // Update admin_hidden
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update({ admin_hidden: body.hidden })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Hide listing update failed', {
        listingId,
        error: updateError.message,
      });
      return apiServerError(`Failed to update listing: ${updateError.message}`);
    }

    logger.info('Listing visibility toggled', {
      listingId,
      hidden: body.hidden,
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      listingId,
      hidden: body.hidden,
    });
  } catch (error) {
    logger.logError('Hide listing error', error);
    return apiServerError();
  }
}
