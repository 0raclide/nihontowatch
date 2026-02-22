/**
 * Recompute Score API
 *
 * POST /api/listing/[id]/recompute-score
 *
 * Triggers a single-listing featured score recompute.
 * Admin-only endpoint.
 */

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from '@/lib/api/responses';
import { recomputeScoreForListing } from '@/lib/featured/scoring';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId) || listingId <= 0) {
      return apiBadRequest('Invalid listing ID');
    }

    // Verify admin
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const serviceClient = createServiceClient();

    const newScore = await recomputeScoreForListing(serviceClient, listingId);

    if (newScore === null) {
      return apiServerError('Failed to recompute score');
    }

    logger.info('Score recomputed via admin', { listingId, newScore, userId: authResult.user.id });

    return apiSuccess({ listingId, score: newScore });
  } catch (error) {
    logger.logError('Recompute score error', error);
    return apiServerError();
  }
}
