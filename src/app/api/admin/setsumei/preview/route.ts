/**
 * Preview Setsumei Connection API
 *
 * GET /api/admin/setsumei/preview?url=<yuhinkai_url>&listing_id=<id>
 *
 * Fetches the catalog record from oshi-v2 and the listing from nihontowatch
 * for preview before creating a manual connection.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseYuhinkaiUrl, buildFullYuhinkaiUrl, getCollectionDisplayName } from '@/lib/yuhinkai/urlParser';
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

export const dynamic = 'force-dynamic';

// =============================================================================
// GET HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const yuhinkaiUrl = searchParams.get('url');
    const listingIdStr = searchParams.get('listing_id');

    if (!yuhinkaiUrl) {
      return apiBadRequest('Missing required parameter: url');
    }

    if (!listingIdStr) {
      return apiBadRequest('Missing required parameter: listing_id');
    }

    const listingId = parseInt(listingIdStr, 10);
    if (isNaN(listingId) || listingId <= 0) {
      return apiBadRequest('Invalid listing_id: must be a positive integer');
    }

    // Parse the Yuhinkai URL
    const parseResult = parseYuhinkaiUrl(yuhinkaiUrl);
    if (!parseResult.success) {
      return apiBadRequest(parseResult.error);
    }

    const { collection, volume, itemNumber } = parseResult.data;

    // Fetch catalog record from oshi-v2
    const catalogRecord = await fetchCatalogRecord(collection, volume, itemNumber);

    if (!catalogRecord) {
      return apiNotFound(`Catalog record ${collection} vol.${volume} #${itemNumber}`);
    }

    // Type definitions for query results
    type ListingWithDealer = {
      id: number;
      title: string | null;
      title_en: string | null;
      description: string | null;
      description_en: string | null;
      item_type: string | null;
      item_category: string | null;
      smith: string | null;
      school: string | null;
      tosogu_maker: string | null;
      tosogu_school: string | null;
      cert_type: string | null;
      cert_session: string | null;
      price_value: number | null;
      price_currency: string | null;
      images: string[] | null;
      dealers: { id: number; name: string; domain: string } | null;
    };

    type ExistingEnrichment = {
      id: number;
      yuhinkai_uuid: string | null;
      yuhinkai_collection: string | null;
      yuhinkai_volume: number | null;
      yuhinkai_item_number: number | null;
      match_confidence: string | null;
      verification_status: string | null;
      connection_source: string | null;
      verified_by: string | null;
      verified_at: string | null;
    };

    // Fetch listing from nihontowatch
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        title_en,
        description,
        description_en,
        item_type,
        item_category,
        smith,
        school,
        tosogu_maker,
        tosogu_school,
        cert_type,
        cert_session,
        price_value,
        price_currency,
        images,
        dealers!inner (
          id,
          name,
          domain
        )
      `)
      .eq('id', listingId)
      .single() as { data: ListingWithDealer | null; error: { message: string } | null };

    if (listingError || !listing) {
      return apiNotFound(`Listing ${listingId}`);
    }

    // Check for existing enrichment
    // Type assertion needed - yuhinkai_enrichments table not in generated types
    type YuhinkaiEnrichmentTable = ReturnType<typeof supabase.from>;
    const { data: existingEnrichment } = await (supabase
      .from('yuhinkai_enrichments') as unknown as YuhinkaiEnrichmentTable)
      .select(`
        id,
        yuhinkai_uuid,
        yuhinkai_collection,
        yuhinkai_volume,
        yuhinkai_item_number,
        match_confidence,
        verification_status,
        connection_source,
        verified_by,
        verified_at
      `)
      .eq('listing_id', listingId)
      .single() as { data: ExistingEnrichment | null };

    // Extract enrichment data from catalog record
    const enrichmentPreview = {
      yuhinkai_uuid: catalogRecord.uuid,
      yuhinkai_collection: catalogRecord.collection,
      yuhinkai_volume: catalogRecord.volume,
      yuhinkai_item_number: catalogRecord.item_number,
      catalog_url: buildFullYuhinkaiUrl(parseResult.data),
      collection_display: getCollectionDisplayName(catalogRecord.collection),
      session_number: catalogRecord.session_number,
      setsumei_ja: catalogRecord.japanese_txt,
      setsumei_en: catalogRecord.translation_md,
      has_setsumei: !!(catalogRecord.japanese_txt || catalogRecord.translation_md),
      enriched_maker: extractArtisanName(catalogRecord.metadata),
      enriched_maker_kanji: extractArtisanKanji(catalogRecord.metadata),
      enriched_school: extractSchool(catalogRecord.metadata),
      enriched_period: extractPeriod(catalogRecord.metadata),
      enriched_cert_type: getCertTypeFromCollection(catalogRecord.collection),
      enriched_cert_session: catalogRecord.session_number,
      item_category: extractItemCategory(catalogRecord.metadata),
    };

    return apiSuccess({
      listing: {
        id: listing.id,
        title: listing.title,
        title_en: listing.title_en,
        item_type: listing.item_type,
        item_category: listing.item_category,
        smith: listing.smith,
        school: listing.school,
        tosogu_maker: listing.tosogu_maker,
        tosogu_school: listing.tosogu_school,
        cert_type: listing.cert_type,
        cert_session: listing.cert_session,
        price_value: listing.price_value,
        price_currency: listing.price_currency,
        image: listing.images?.[0] || null,
        dealer: listing.dealers,
      },
      catalogRecord: enrichmentPreview,
      existingEnrichment: existingEnrichment || null,
      willOverwrite: !!existingEnrichment,
    });
  } catch (error) {
    logger.logError('Setsumei preview error', error);
    return apiServerError();
  }
}
