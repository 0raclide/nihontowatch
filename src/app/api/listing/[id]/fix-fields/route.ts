/**
 * Fix Fields API
 *
 * POST /api/listing/[id]/fix-fields
 * Body: { fields: { smith: "Gojo", province: "Yamashiro", ... } }
 *
 * Updates arbitrary listing fields after admin correction.
 * Auto-locks changed fields in admin_locked_fields JSONB to prevent scraper overwrites.
 * Recomputes featured_score after update.
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

// Fields that can be edited via admin UI
const EDITABLE_FIELDS = new Set([
  'smith',
  'school',
  'province',
  'era',
  'mei_type',
  'nagasa_cm',
  'sori_cm',
  'motohaba_cm',
  'sakihaba_cm',
  'kasane_cm',
  'weight_g',
  'price_value',
  'price_currency',
  'item_type',
  // Tosogu fields
  'tosogu_maker',
  'tosogu_school',
]);

// Fields that should be parsed as numbers
const NUMERIC_FIELDS = new Set([
  'nagasa_cm',
  'sori_cm',
  'motohaba_cm',
  'sakihaba_cm',
  'kasane_cm',
  'weight_g',
  'price_value',
]);

interface FixFieldsRequestBody {
  fields: Record<string, unknown>;
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
    let body: FixFieldsRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { fields } = body;

    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return apiBadRequest('fields object is required and must not be empty');
    }

    // Filter to only editable fields and build update payload
    const updates: Record<string, unknown> = {};
    const lockedFieldNames: string[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (!EDITABLE_FIELDS.has(key)) {
        continue; // silently skip unknown fields
      }

      if (NUMERIC_FIELDS.has(key)) {
        // Convert to number or null
        if (value === '' || value === null || value === undefined) {
          updates[key] = null;
        } else {
          const num = Number(value);
          if (isNaN(num)) {
            return apiBadRequest(`Invalid numeric value for ${key}`);
          }
          updates[key] = num;
        }
      } else {
        // String fields: empty string → null
        updates[key] = (value === '' || value === null || value === undefined) ? null : String(value);
      }

      lockedFieldNames.push(key);
    }

    if (Object.keys(updates).length === 0) {
      return apiBadRequest('No valid editable fields provided');
    }

    // Use service client for update (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Fetch existing listing to merge locks
    const { data: listing, error: fetchError } = await serviceClient
      .from('listings')
      .select('id, admin_locked_fields')
      .eq('id', listingId)
      .single() as { data: { id: number; admin_locked_fields: Record<string, boolean> | null } | null; error: { message: string } | null };

    if (fetchError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    // Merge new locks with existing (never removes existing locks)
    const existingLocks = listing.admin_locked_fields || {};
    const newLocks: Record<string, boolean> = {};
    for (const field of lockedFieldNames) {
      newLocks[field] = true;
    }
    const mergedLocks = { ...existingLocks, ...newLocks };

    // Update fields + admin_locked_fields in one call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient
      .from('listings') as any)
      .update({ ...updates, admin_locked_fields: mergedLocks })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Fix fields update failed', {
        listingId,
        error: updateError.message,
        fields: Object.keys(updates),
      });
      return apiServerError(`Failed to update fields: ${updateError.message}`);
    }

    // Recompute featured_score inline (MUST await — Vercel serverless freezes after response)
    try {
      await recomputeScoreForListing(serviceClient, listingId);
    } catch (err) {
      logger.logError('[fix-fields] Score recompute failed', err, { listingId });
    }

    logger.info('Fields corrected on listing', {
      listingId,
      fields: Object.keys(updates),
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      listingId,
      updatedFields: Object.keys(updates),
      lockedFields: mergedLocks,
    });
  } catch (error) {
    logger.logError('Fix fields error', error);
    return apiServerError();
  }
}
