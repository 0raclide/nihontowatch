/**
 * Fix Artisan API
 *
 * POST /api/listing/[id]/fix-artisan
 * Body: { artisan_id: string, confidence?: 'HIGH' | 'MEDIUM' | 'LOW' }
 *
 * Updates the artisan_id on a listing after admin correction.
 * Automatically marks the match as verified correct.
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

interface FixArtisanRequestBody {
  artisan_id: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
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
    let body: FixArtisanRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { artisan_id, confidence = 'HIGH', notes } = body;

    // Validate artisan_id
    if (!artisan_id || typeof artisan_id !== 'string' || artisan_id.length < 2) {
      return apiBadRequest('Invalid artisan_id');
    }

    // Validate confidence
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
      return apiBadRequest('Invalid confidence value');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Check if listing exists
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, artisan_id')
      .eq('id', listingId)
      .single() as { data: { id: number; artisan_id: string | null } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    const previousArtisanId = listing.artisan_id;

    // Update the artisan_id and mark as verified correct
    const updateData = {
      artisan_id: artisan_id,
      artisan_confidence: confidence,
      artisan_method: 'ADMIN_CORRECTION',
      artisan_matched_at: new Date().toISOString(),
      artisan_verified: 'correct' as const,
      artisan_verified_at: new Date().toISOString(),
      artisan_verified_by: user.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update(updateData)
      .eq('id', listingId);

    if (updateError) {
      logger.error('Fix artisan update failed', {
        listingId,
        error: updateError.message,
      });
      return apiServerError(`Failed to update artisan: ${updateError.message}`);
    }

    // Store correction in artisan_corrections table for pipeline re-apply
    // Using upsert to handle re-corrections on same listing
    const correctionData = {
      listing_id: listingId,
      corrected_artisan_id: artisan_id,
      original_artisan_id: previousArtisanId,
      corrected_by: user.id,
      corrected_at: new Date().toISOString(),
      notes: notes || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: correctionError } = await (serviceClient
      .from('artisan_corrections') as any)
      .upsert(correctionData, {
        onConflict: 'listing_id',
        ignoreDuplicates: false,
      });

    if (correctionError) {
      // Log but don't fail - the listing update already succeeded
      logger.error('Failed to store artisan correction record', {
        listingId,
        error: correctionError.message,
      });
    }

    logger.info('Artisan corrected on listing', {
      listingId,
      previousArtisanId,
      newArtisanId: artisan_id,
      confidence,
      userId: user.id,
      correctionStored: !correctionError,
    });

    return apiSuccess({
      success: true,
      listingId,
      previousArtisanId,
      artisanId: artisan_id,
      confidence,
    });
  } catch (error) {
    logger.logError('Fix artisan error', error);
    return apiServerError();
  }
}
