/**
 * Disconnect Setsumei API
 *
 * DELETE /api/admin/setsumei/disconnect
 * Body: { listing_id: number }
 *
 * Removes a manual connection between a nihontowatch listing
 * and a Yuhinkai catalog record.
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

interface DisconnectRequestBody {
  listing_id: number;
}

// =============================================================================
// DELETE HANDLER
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { user } = authResult;

    // Parse request body
    let body: DisconnectRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { listing_id } = body;

    // Validate request body
    if (!listing_id || typeof listing_id !== 'number' || listing_id <= 0) {
      return apiBadRequest('Invalid listing_id: must be a positive integer');
    }

    // Use service client for deletion (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Type assertion needed - yuhinkai_enrichments table not in generated types
    type YuhinkaiEnrichmentTable = ReturnType<typeof serviceClient.from>;
    type EnrichmentSelectResult = {
      data: {
        id: number;
        yuhinkai_collection: string | null;
        yuhinkai_volume: number | null;
        yuhinkai_item_number: number | null;
        connection_source: string | null;
      } | null;
      error: { message: string } | null;
    };

    // Check for existing enrichment
    const { data: existingEnrichment, error: fetchError } = await (serviceClient
      .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
      .select('id, yuhinkai_collection, yuhinkai_volume, yuhinkai_item_number, connection_source')
      .eq('listing_id', listing_id)
      .single() as EnrichmentSelectResult;

    if (fetchError || !existingEnrichment) {
      return apiNotFound(`Enrichment for listing ${listing_id}`);
    }

    // Delete the enrichment
    const { error: deleteError } = await (serviceClient
      .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
      .delete()
      .eq('listing_id', listing_id) as { error: { message: string } | null };

    if (deleteError) {
      logger.error('Setsumei enrichment delete failed', { listing_id, error: deleteError.message });
      return apiServerError(`Failed to delete enrichment: ${deleteError.message}`);
    }

    logger.info('Setsumei enrichment removed', {
      listing_id,
      collection: existingEnrichment.yuhinkai_collection,
      volume: existingEnrichment.yuhinkai_volume,
      itemNumber: existingEnrichment.yuhinkai_item_number,
      source: existingEnrichment.connection_source,
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      deleted: {
        listing_id,
        yuhinkai_collection: existingEnrichment.yuhinkai_collection,
        yuhinkai_volume: existingEnrichment.yuhinkai_volume,
        yuhinkai_item_number: existingEnrichment.yuhinkai_item_number,
        was_manual: existingEnrichment.connection_source === 'manual',
      },
    });
  } catch (error) {
    logger.logError('Setsumei disconnect error', error);
    return apiServerError();
  }
}
