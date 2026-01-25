/**
 * Connect Setsumei API
 *
 * POST /api/admin/setsumei/connect
 * Body: { listing_id: number, yuhinkai_url: string }
 *
 * Creates or updates a manual connection between a nihontowatch listing
 * and a Yuhinkai catalog record.
 */

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseYuhinkaiUrl } from '@/lib/yuhinkai/urlParser';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
  apiServiceUnavailable,
} from '@/lib/api/responses';
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
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check if oshi-v2 is configured
    if (!isOshiV2Configured()) {
      return apiServiceUnavailable('Yuhinkai catalog integration is not configured');
    }

    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { user } = authResult;

    // Parse request body
    let body: ConnectRequestBody;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const { listing_id, yuhinkai_url } = body;

    // Validate request body
    if (!listing_id || typeof listing_id !== 'number' || listing_id <= 0) {
      return apiBadRequest('Invalid listing_id: must be a positive integer');
    }

    if (!yuhinkai_url || typeof yuhinkai_url !== 'string') {
      return apiBadRequest('Missing required field: yuhinkai_url');
    }

    // Parse the Yuhinkai URL
    const parseResult = parseYuhinkaiUrl(yuhinkai_url);
    if (!parseResult.success) {
      return apiBadRequest(parseResult.error);
    }

    const { collection, volume, itemNumber } = parseResult.data;

    // Fetch catalog record from oshi-v2
    const catalogRecord = await fetchCatalogRecord(collection, volume, itemNumber);

    if (!catalogRecord) {
      return apiNotFound(`Catalog record ${collection} vol.${volume} #${itemNumber}`);
    }

    // Verify listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return apiNotFound(`Listing ${listing_id}`);
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
    // Type assertion needed - yuhinkai_enrichments table not in generated types
    type YuhinkaiEnrichmentTable = ReturnType<typeof serviceClient.from>;
    type EnrichmentResult = { data: Record<string, unknown> | null; error: { message: string } | null };

    const { data: existingEnrichment } = await (serviceClient
      .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
      .select('id')
      .eq('listing_id', listing_id)
      .single() as { data: { id: number } | null };

    let enrichment: Record<string, unknown> | null = null;

    if (existingEnrichment) {
      // Update existing enrichment
      const { data, error } = await (serviceClient
        .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
        .update(enrichmentData)
        .eq('listing_id', listing_id)
        .select()
        .single() as EnrichmentResult;

      if (error) {
        logger.error('Setsumei enrichment update failed', { listing_id, error: error.message });
        return apiServerError(`Failed to update enrichment: ${error.message}`);
      }

      enrichment = data;
    } else {
      // Insert new enrichment
      const { data, error } = await (serviceClient
        .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
        .insert(enrichmentData)
        .select()
        .single() as EnrichmentResult;

      if (error) {
        logger.error('Setsumei enrichment insert failed', { listing_id, error: error.message });
        return apiServerError(`Failed to create enrichment: ${error.message}`);
      }

      enrichment = data;
    }

    // Safety check (should never happen - both branches above either set data or return early)
    if (!enrichment) {
      logger.error('Enrichment data unexpectedly null after operation', { listing_id });
      return apiServerError('Failed to retrieve enrichment data');
    }

    logger.info('Manual setsumei connection created', {
      listing_id,
      collection,
      volume,
      itemNumber,
      userId: user.id,
    });

    // Return full enrichment for optimistic UI update (instant setsumei display)
    return apiSuccess({
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
    logger.logError('Setsumei connect error', error);
    return apiServerError();
  }
}
