/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - yuhinkai_enrichments table not in generated types
/**
 * Preview Setsumei Connection API
 *
 * GET /api/admin/setsumei/preview?url=<yuhinkai_url>&listing_id=<id>
 *
 * Fetches the catalog record from oshi-v2 and the listing from nihontowatch
 * for preview before creating a manual connection.
 */

import { NextRequest, NextResponse } from 'next/server';
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

export const dynamic = 'force-dynamic';

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
// GET HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const yuhinkaiUrl = searchParams.get('url');
    const listingIdStr = searchParams.get('listing_id');

    if (!yuhinkaiUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: url' },
        { status: 400 }
      );
    }

    if (!listingIdStr) {
      return NextResponse.json(
        { error: 'Missing required parameter: listing_id' },
        { status: 400 }
      );
    }

    const listingId = parseInt(listingIdStr, 10);
    if (isNaN(listingId) || listingId <= 0) {
      return NextResponse.json(
        { error: 'Invalid listing_id: must be a positive integer' },
        { status: 400 }
      );
    }

    // Parse the Yuhinkai URL
    const parseResult = parseYuhinkaiUrl(yuhinkaiUrl);
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
        {
          error: `Catalog record not found: ${collection} vol.${volume} #${itemNumber}`,
          parsed: parseResult.data,
        },
        { status: 404 }
      );
    }

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
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: `Listing not found: ${listingId}` },
        { status: 404 }
      );
    }

    // Check for existing enrichment
    const { data: existingEnrichment } = await supabase
      .from('yuhinkai_enrichments')
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
      .single();

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

    return NextResponse.json({
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
    console.error('[setsumei/preview] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
