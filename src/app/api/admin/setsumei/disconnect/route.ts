/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - yuhinkai_enrichments table not in generated types
/**
 * Disconnect Setsumei API
 *
 * DELETE /api/admin/setsumei/disconnect
 * Body: { listing_id: number }
 *
 * Removes a manual connection between a nihontowatch listing
 * and a Yuhinkai catalog record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface DisconnectRequestBody {
  listing_id: number;
}

// =============================================================================
// ADMIN VERIFICATION
// =============================================================================

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user };
}

// =============================================================================
// DELETE HANDLER
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    // Parse request body
    let body: DisconnectRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { listing_id } = body;

    // Validate request body
    if (!listing_id || typeof listing_id !== 'number' || listing_id <= 0) {
      return NextResponse.json(
        { error: 'Invalid listing_id: must be a positive integer' },
        { status: 400 }
      );
    }

    // Use service client for deletion (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Check for existing enrichment
    const { data: existingEnrichment, error: fetchError } = await serviceClient
      .from('yuhinkai_enrichments')
      .select('id, yuhinkai_collection, yuhinkai_volume, yuhinkai_item_number, connection_source')
      .eq('listing_id', listing_id)
      .single();

    if (fetchError || !existingEnrichment) {
      return NextResponse.json(
        { error: `No enrichment found for listing ${listing_id}` },
        { status: 404 }
      );
    }

    // Delete the enrichment
    const { error: deleteError } = await serviceClient
      .from('yuhinkai_enrichments')
      .delete()
      .eq('listing_id', listing_id);

    if (deleteError) {
      console.error('[setsumei/disconnect] Delete error:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete enrichment: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[setsumei/disconnect] Enrichment removed: listing ${listing_id} (was ${existingEnrichment.yuhinkai_collection} vol.${existingEnrichment.yuhinkai_volume} #${existingEnrichment.yuhinkai_item_number}, source: ${existingEnrichment.connection_source}) by ${user.id}`
    );

    return NextResponse.json({
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
    console.error('[setsumei/disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
