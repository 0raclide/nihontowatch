/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - yuhinkai_enrichments table not in generated types
/**
 * Connect Setsumei API
 *
 * POST /api/admin/setsumei/connect
 * Body: { listing_id: number, yuhinkai_url: string }
 *
 * Creates or updates a manual connection between a nihontowatch listing
 * and a Yuhinkai catalog record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseYuhinkaiUrl } from '@/lib/yuhinkai/urlParser';
import {
  fetchCatalogRecord,
  extractArtisanName,
  extractArtisanKanji,
  extractSchool,
  extractPeriod,
  extractItemCategory,
  getCertTypeFromCollection,
  isOshiV2Configured,
} from '@/lib/yuhinkai/oshiV2Client';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface ConnectRequestBody {
  listing_id: number;
  yuhinkai_url: string;
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
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check if oshi-v2 is configured
    if (!isOshiV2Configured()) {
      return NextResponse.json(
        { error: 'Yuhinkai catalog integration is not configured' },
        { status: 503 }
      );
    }

    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    // Parse request body
    let body: ConnectRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { listing_id, yuhinkai_url } = body;

    // Validate request body
    if (!listing_id || typeof listing_id !== 'number' || listing_id <= 0) {
      return NextResponse.json(
        { error: 'Invalid listing_id: must be a positive integer' },
        { status: 400 }
      );
    }

    if (!yuhinkai_url || typeof yuhinkai_url !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: yuhinkai_url' },
        { status: 400 }
      );
    }

    // Parse the Yuhinkai URL
    const parseResult = parseYuhinkaiUrl(yuhinkai_url);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 400 }
      );
    }

    const { collection, volume, itemNumber } = parseResult.data;

    // Fetch catalog record from oshi-v2
    const catalogRecord = await fetchCatalogRecord(collection, volume, itemNumber);

    if (!catalogRecord) {
      return NextResponse.json(
        { error: `Catalog record not found: ${collection} vol.${volume} #${itemNumber}` },
        { status: 404 }
      );
    }

    // Verify listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: `Listing not found: ${listing_id}` },
        { status: 404 }
      );
    }

    // Use service client for writing (RLS requires service_role)
    const serviceClient = createServiceClient();

    // Build enrichment data
    const itemCategory = extractItemCategory(catalogRecord.metadata);
    const enrichmentData = {
      listing_id,
      yuhinkai_uuid: catalogRecord.uuid,
      yuhinkai_collection: catalogRecord.collection,
      yuhinkai_volume: catalogRecord.volume,
      yuhinkai_item_number: catalogRecord.item_number,

      // Match metadata (manual = perfect match)
      match_score: 1.0,
      match_confidence: 'DEFINITIVE',
      match_signals: { manual: true, connected_by: user.id },
      matched_fields: ['manual_connection'],

      // Enriched data from catalog
      enriched_maker: extractArtisanName(catalogRecord.metadata),
      enriched_maker_kanji: extractArtisanKanji(catalogRecord.metadata),
      enriched_school: extractSchool(catalogRecord.metadata),
      enriched_period: extractPeriod(catalogRecord.metadata),
      enriched_form_type: itemCategory === 'tosogu' ? catalogRecord.metadata?.form_type : null,

      // Setsumei translations
      setsumei_ja: catalogRecord.japanese_txt,
      setsumei_en: catalogRecord.translation_md,
      setsumei_en_format: 'markdown',

      // Certification
      enriched_cert_type: getCertTypeFromCollection(catalogRecord.collection),
      enriched_cert_session: catalogRecord.session_number,

      // Item category
      item_category: itemCategory,

      // Verification (manual = confirmed)
      verification_status: 'confirmed',
      verified_by: user.id,
      verified_at: new Date().toISOString(),

      // Connection source (this is the new field)
      connection_source: 'manual',

      // Timestamps
      enriched_at: new Date().toISOString(),
    };

    // Check for existing enrichment
    const { data: existingEnrichment } = await serviceClient
      .from('yuhinkai_enrichments')
      .select('id')
      .eq('listing_id', listing_id)
      .single();

    let enrichment;

    if (existingEnrichment) {
      // Update existing enrichment
      const { data, error } = await serviceClient
        .from('yuhinkai_enrichments')
        .update(enrichmentData)
        .eq('listing_id', listing_id)
        .select()
        .single();

      if (error) {
        console.error('[setsumei/connect] Update error:', error);
        return NextResponse.json(
          { error: `Failed to update enrichment: ${error.message}` },
          { status: 500 }
        );
      }

      enrichment = data;
    } else {
      // Insert new enrichment
      const { data, error } = await serviceClient
        .from('yuhinkai_enrichments')
        .insert(enrichmentData)
        .select()
        .single();

      if (error) {
        console.error('[setsumei/connect] Insert error:', error);
        return NextResponse.json(
          { error: `Failed to create enrichment: ${error.message}` },
          { status: 500 }
        );
      }

      enrichment = data;
    }

    console.log(
      `[setsumei/connect] Manual connection created: listing ${listing_id} → ${collection} vol.${volume} #${itemNumber} by ${user.id}`
    );

    // Return full enrichment for optimistic UI update (instant setsumei display)
    return NextResponse.json({
      success: true,
      action: existingEnrichment ? 'updated' : 'created',
      enrichment: {
        // Identity fields
        enrichment_id: enrichment.id,
        listing_id: enrichment.listing_id,
        yuhinkai_uuid: enrichment.yuhinkai_uuid,
        yuhinkai_collection: enrichment.yuhinkai_collection,
        yuhinkai_volume: enrichment.yuhinkai_volume,
        yuhinkai_item_number: enrichment.yuhinkai_item_number,
        // Setsumei translations (needed for optimistic display)
        setsumei_ja: enrichment.setsumei_ja,
        setsumei_en: enrichment.setsumei_en,
        setsumei_en_format: enrichment.setsumei_en_format,
        // Enriched metadata
        enriched_maker: enrichment.enriched_maker,
        enriched_maker_kanji: enrichment.enriched_maker_kanji,
        enriched_school: enrichment.enriched_school,
        enriched_period: enrichment.enriched_period,
        enriched_form_type: enrichment.enriched_form_type,
        item_category: enrichment.item_category,
        // Match confidence (needed for hasVerifiedEnrichment check)
        match_score: enrichment.match_score,
        match_confidence: enrichment.match_confidence,
        // Verification status
        verification_status: enrichment.verification_status,
        connection_source: enrichment.connection_source,
        verified_by: enrichment.verified_by,
        verified_at: enrichment.verified_at,
      },
    });
  } catch (error) {
    console.error('[setsumei/connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
