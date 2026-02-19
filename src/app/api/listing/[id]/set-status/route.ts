/**
 * Set Listing Status API
 *
 * POST /api/listing/[id]/set-status
 * Body: { sold: boolean }
 *
 * Allows admins to manually override a listing's sold/available status.
 * Sets status_admin_locked=true to protect from scraper overwrites.
 * Records correction in status_corrections audit table.
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
    let body: { sold: boolean };
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    if (typeof body.sold !== 'boolean') {
      return apiBadRequest('sold must be a boolean');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Fetch current listing for audit trail
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, status, is_available, is_sold')
      .eq('id', listingId)
      .single() as { data: { id: number; status: string; is_available: boolean; is_sold: boolean } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    // Compute new values
    const newStatus = body.sold ? 'sold' : 'available';
    const newIsAvailable = !body.sold;
    const newIsSold = body.sold;

    // Update listing status + lock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update({
        status: newStatus,
        is_available: newIsAvailable,
        is_sold: newIsSold,
        status_admin_locked: true,
      })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Set status update failed', {
        listingId,
        error: updateError.message,
      });
      return apiServerError(`Failed to update listing: ${updateError.message}`);
    }

    // Record correction in audit table (upsert — latest correction wins)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: auditError } = await (serviceClient
      .from('status_corrections') as any)
      .upsert({
        listing_id: listingId,
        original_status: listing.status,
        original_is_available: listing.is_available,
        original_is_sold: listing.is_sold,
        corrected_status: newStatus,
        corrected_is_available: newIsAvailable,
        corrected_is_sold: newIsSold,
        corrected_by: user.id,
        corrected_at: new Date().toISOString(),
      }, { onConflict: 'listing_id' });

    if (auditError) {
      // Non-fatal — the status update already succeeded
      logger.error('Status correction audit failed', {
        listingId,
        error: auditError.message,
      });
    }

    logger.info('Listing status overridden', {
      listingId,
      sold: body.sold,
      previousStatus: listing.status,
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      listingId,
      sold: body.sold,
      previousStatus: listing.status,
    });
  } catch (error) {
    logger.logError('Set status error', error);
    return apiServerError();
  }
}
