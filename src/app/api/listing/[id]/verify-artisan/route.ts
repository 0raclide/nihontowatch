/**
 * Artisan Verification API
 *
 * POST /api/listing/[id]/verify-artisan
 * Body: { verified: 'correct' | 'incorrect' | null }
 *
 * Allows admins to flag artisan matches as correct or incorrect for QA.
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

// =============================================================================
// TYPES
// =============================================================================

interface VerifyRequestBody {
  verified: 'correct' | 'incorrect' | null;
}

// =============================================================================
// POST HANDLER
// =============================================================================

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
    let body: VerifyRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { verified } = body;

    // Validate verified value
    if (verified !== 'correct' && verified !== 'incorrect' && verified !== null) {
      return apiBadRequest('Invalid verified value: must be "correct", "incorrect", or null');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Check if listing exists and has an artisan_id
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, artisan_id')
      .eq('id', listingId)
      .single() as { data: { id: number; artisan_id: string | null } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    if (!listing.artisan_id) {
      return apiBadRequest('Listing has no artisan match to verify');
    }

    // Update the verification status
    // When admin verifies (correct or incorrect), lock the artisan fields
    // When admin clears verification (null), unlock so scraper can re-match
    const updateData = verified === null
      ? {
          artisan_verified: null,
          artisan_verified_at: null,
          artisan_verified_by: null,
          artisan_admin_locked: false,
        }
      : {
          artisan_verified: verified,
          artisan_verified_at: new Date().toISOString(),
          artisan_verified_by: user.id,
          artisan_admin_locked: true,
        };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update(updateData)
      .eq('id', listingId);

    if (updateError) {
      logger.error('Artisan verification update failed', {
        listingId,
        error: updateError.message,
      });
      return apiServerError(`Failed to update verification: ${updateError.message}`);
    }

    logger.info('Artisan verification updated', {
      listingId,
      artisanId: listing.artisan_id,
      verified,
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      listingId,
      artisanId: listing.artisan_id,
      verified,
    });
  } catch (error) {
    logger.logError('Artisan verification error', error);
    return apiServerError();
  }
}
