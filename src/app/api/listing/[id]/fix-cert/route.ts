/**
 * Fix Certification API
 *
 * POST /api/listing/[id]/fix-cert
 * Body: { cert_type: string | null, notes?: string }
 *
 * Updates the cert_type on a listing after admin correction.
 * Sets cert_admin_locked to prevent scraper overwrites.
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
import { recomputeScoreForListing } from '@/lib/featured/scoring';

export const dynamic = 'force-dynamic';

const VALID_CERT_TYPES = [
  'tokubetsu_juyo', 'Tokuju',
  'Juyo Bijutsuhin', 'JuyoBijutsuhin', 'juyo_bijutsuhin',
  'Juyo', 'juyo',
  'TokuHozon', 'tokubetsu_hozon',
  'TokuKicho',
  'Hozon', 'hozon',
  'nbthk', 'nthk',
];

interface FixCertRequestBody {
  cert_type: string | null;
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
    let body: FixCertRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { cert_type, notes } = body;

    // Validate cert_type (null is allowed — clears the cert)
    if (cert_type !== null && (typeof cert_type !== 'string' || !VALID_CERT_TYPES.includes(cert_type))) {
      return apiBadRequest('Invalid cert_type value');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Check if listing exists
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, cert_type')
      .eq('id', listingId)
      .single() as { data: { id: number; cert_type: string | null } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    const previousCertType = listing.cert_type;

    // Update cert_type and lock against scraper overwrites
    const updateData = {
      cert_type: cert_type,
      cert_admin_locked: true,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update(updateData)
      .eq('id', listingId);

    if (updateError) {
      logger.error('Fix cert update failed', {
        listingId,
        error: updateError.message,
      });
      return apiServerError(`Failed to update cert: ${updateError.message}`);
    }

    // Store correction in cert_corrections table for audit trail
    const correctionData = {
      listing_id: listingId,
      original_cert: previousCertType,
      corrected_cert: cert_type,
      corrected_by: user.id,
      corrected_at: new Date().toISOString(),
      notes: notes || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: correctionError } = await (serviceClient
      .from('cert_corrections') as any)
      .upsert(correctionData, {
        onConflict: 'listing_id',
        ignoreDuplicates: false,
      });

    if (correctionError) {
      // Log but don't fail - the listing update already succeeded
      logger.error('Failed to store cert correction record', {
        listingId,
        error: correctionError.message,
      });
    }

    // Recompute featured_score inline
    try {
      await recomputeScoreForListing(serviceClient, listingId);
    } catch (err) {
      logger.logError('[fix-cert] Score recompute failed', err, { listingId });
    }

    logger.info('Cert corrected on listing', {
      listingId,
      previousCertType,
      newCertType: cert_type,
      userId: user.id,
      correctionStored: !correctionError,
    });

    return apiSuccess({
      success: true,
      listingId,
      previousCertType,
      certType: cert_type,
    });
  } catch (error) {
    logger.logError('Fix cert error', error);
    return apiServerError();
  }
}
