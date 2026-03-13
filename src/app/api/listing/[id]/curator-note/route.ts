/**
 * Curator's Note API
 *
 * POST /api/listing/[id]/curator-note — Generate and store (admin-only)
 * GET  /api/listing/[id]/curator-note — Return cached note (public)
 *
 * @module api/listing/[id]/curator-note
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
import { getListingDetail } from '@/lib/listing/getListingDetail';
import { isShowcaseEligible } from '@/lib/listing/showcase';
import { getArtisan, getAiDescription } from '@/lib/supabase/yuhinkai';
import { buildArtistPageData } from '@/lib/artisan/getArtistPageData';
import { distillArtistOverview } from '@/lib/listing/distillArtistOverview';
import {
  assembleCuratorContext,
  computeInputHash,
  shouldSkipGeneration,
  getDataRichness,
} from '@/lib/listing/curatorNote';
import { generateCuratorNote } from '@/lib/listing/generateCuratorNote';

export const dynamic = 'force-dynamic';

/**
 * POST — Generate a curator's note for the listing (admin-only).
 *
 * Query params:
 *   ?force=true — Regenerate even if input hash matches
 */
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

    const force = request.nextUrl.searchParams.get('force') === 'true';

    // Fetch listing detail via service client (needs all fields)
    const serviceClient = createServiceClient();
    const listing = await getListingDetail(serviceClient, listingId);

    if (!listing) {
      return apiNotFound('Listing');
    }

    // Check showcase eligibility
    if (!isShowcaseEligible(listing)) {
      return apiBadRequest('Listing is not showcase-eligible. Use ?force=true with showcase_override or enrich listing data.');
    }

    // Fetch artisan data from Yuhinkai
    let artisanEntity = null;
    let aiDescription = null;

    if (listing.artisan_id) {
      artisanEntity = await getArtisan(listing.artisan_id);
      aiDescription = await getAiDescription(listing.artisan_id);
    }

    // Distill artist overview for richer context (non-fatal)
    let artistOverview = null;
    if (listing.artisan_id) {
      try {
        const pageData = await buildArtistPageData(listing.artisan_id);
        if (pageData) artistOverview = distillArtistOverview(pageData);
      } catch {
        // Non-fatal — artist overview is supplementary
      }
    }

    // Assemble context
    const context = assembleCuratorContext(listing, artisanEntity, aiDescription, artistOverview);

    // Check if we should skip
    if (shouldSkipGeneration(context)) {
      return apiBadRequest('Insufficient data for curator note generation (no artisan match and no setsumei)');
    }

    // Compute input hash and check for staleness
    const inputHash = computeInputHash(context);

    if (!force) {
      // Check if we already have a note with the same input hash
      // Columns not in generated types — cast through any
      const { data: existing } = await (serviceClient as any)
        .from('listings')
        .select('ai_curator_note_input_hash')
        .eq('id', listingId)
        .single();

      if (existing?.ai_curator_note_input_hash === inputHash) {
        // Read the cached note
        const { data: cached } = await (serviceClient as any)
          .from('listings')
          .select('ai_curator_note_en, ai_curator_note_ja, ai_curator_headline_en, ai_curator_headline_ja, ai_curator_note_generated_at')
          .eq('id', listingId)
          .single();

        return apiSuccess({
          en: cached?.ai_curator_note_en ?? null,
          ja: cached?.ai_curator_note_ja ?? null,
          headline_en: cached?.ai_curator_headline_en ?? null,
          headline_ja: cached?.ai_curator_headline_ja ?? null,
          generated_at: cached?.ai_curator_note_generated_at ?? null,
          input_hash: inputHash,
          data_richness: getDataRichness(context),
          cached: true,
        });
      }
    }

    // Generate EN note, then JA note (sequential — avoid concurrent API rate limits)
    const richness = getDataRichness(context);

    logger.info('Generating curator note', {
      listingId,
      richness,
      hasArtisan: !!context.artisan,
      hasSetsumei: !!context.setsumei,
      force,
    });

    const resultEn = await generateCuratorNote(context, 'en');
    const resultJa = await generateCuratorNote(context, 'ja');

    if (!resultEn.note && !resultJa.note) {
      return apiServerError('Both EN and JA generation failed');
    }

    // Store in database — columns not in generated types, cast through any
    const now = new Date().toISOString();
    const { error: updateError } = await (serviceClient as any)
      .from('listings')
      .update({
        ai_curator_note_en: resultEn.note,
        ai_curator_note_ja: resultJa.note,
        ai_curator_headline_en: resultEn.headline,
        ai_curator_headline_ja: resultJa.headline,
        ai_curator_note_generated_at: now,
        ai_curator_note_input_hash: inputHash,
      })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Failed to store curator note', { error: updateError, listingId });
      return apiServerError('Failed to store curator note');
    }

    logger.info('Curator note generated and stored', {
      listingId,
      richness,
      enLength: resultEn.note?.length ?? 0,
      jaLength: resultJa.note?.length ?? 0,
      hasHeadlineEn: !!resultEn.headline,
      hasHeadlineJa: !!resultJa.headline,
    });

    return apiSuccess({
      en: resultEn.note,
      ja: resultJa.note,
      headline_en: resultEn.headline,
      headline_ja: resultJa.headline,
      generated_at: now,
      input_hash: inputHash,
      data_richness: richness,
      cached: false,
    });
  } catch (error) {
    return apiServerError('Curator note generation error', error);
  }
}

/**
 * GET — Return cached curator's note for a listing (public).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId) || listingId <= 0) {
      return apiBadRequest('Invalid listing ID');
    }

    // Columns not in generated types — cast through any
    const serviceClient = createServiceClient();
    const { data, error } = await (serviceClient as any)
      .from('listings')
      .select('ai_curator_note_en, ai_curator_note_ja, ai_curator_headline_en, ai_curator_headline_ja, ai_curator_note_generated_at')
      .eq('id', listingId)
      .single();

    if (error || !data) {
      return apiNotFound('Listing');
    }

    return apiSuccess({
      en: data.ai_curator_note_en ?? null,
      ja: data.ai_curator_note_ja ?? null,
      headline_en: data.ai_curator_headline_en ?? null,
      headline_ja: data.ai_curator_headline_ja ?? null,
      generated_at: data.ai_curator_note_generated_at ?? null,
    });
  } catch (error) {
    return apiServerError('Failed to fetch curator note', error);
  }
}
