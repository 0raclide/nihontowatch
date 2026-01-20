import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from '@/lib/constants';

// Enable ISR caching for listing details
export const revalidate = 600; // 10 minutes

// Extended listing type with dealer info
interface ListingWithDealer {
  id: number;
  url: string;
  title: string;
  title_en: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  price_jpy: number | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  cert_session: string | null;
  cert_organization: string | null;
  era: string | null;
  province: string | null;
  mei_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  kasane_cm: number | null;
  weight_g: number | null;
  description: string | null;
  description_en: string | null;
  setsumei_text_en: string | null;
  setsumei_text_ja: string | null;
  setsumei_metadata: Record<string, unknown> | null;
  setsumei_processed_at: string | null;
  images: string[] | null;
  stored_images: string[] | null;
  first_seen_at: string;
  last_scraped_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
}

/**
 * GET /api/listing/[id]
 *
 * Fetch a single listing with dealer info and baseline for "New this week" badge.
 * Server-side route enables edge caching - reducing Supabase queries.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id);

  if (isNaN(listingId)) {
    return NextResponse.json(
      { error: 'Invalid listing ID' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Fetch listing with dealer info
    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        id,
        url,
        title,
        title_en,
        item_type,
        price_value,
        price_currency,
        price_jpy,
        smith,
        tosogu_maker,
        school,
        tosogu_school,
        cert_type,
        cert_session,
        cert_organization,
        era,
        province,
        mei_type,
        nagasa_cm,
        sori_cm,
        motohaba_cm,
        sakihaba_cm,
        kasane_cm,
        weight_g,
        description,
        description_en,
        setsumei_text_en,
        setsumei_text_ja,
        setsumei_metadata,
        setsumei_processed_at,
        images,
        stored_images,
        first_seen_at,
        last_scraped_at,
        status,
        is_available,
        is_sold,
        dealer_id,
        dealers (
          id,
          name,
          domain
        )
      `)
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      console.error('Listing fetch error:', error);
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    const typedListing = listing as unknown as ListingWithDealer;

    // Fetch dealer baseline for "New this week" badge
    // This is the earliest listing from this dealer
    let dealerEarliestSeenAt: string | null = null;

    if (typedListing.dealer_id) {
      const { data: baseline } = await supabase
        .from('listings')
        .select('first_seen_at')
        .eq('dealer_id', typedListing.dealer_id)
        .order('first_seen_at', { ascending: true })
        .limit(1)
        .single();

      if (baseline) {
        dealerEarliestSeenAt = (baseline as { first_seen_at: string }).first_seen_at;
      }
    }

    // Enrich listing with dealer baseline
    const enrichedListing = {
      ...typedListing,
      dealer_earliest_seen_at: dealerEarliestSeenAt,
    };

    const response = NextResponse.json({ listing: enrichedListing });

    // Cache for 10 minutes at edge, serve stale for 30 minutes while revalidating
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE.LISTING_DETAIL}, stale-while-revalidate=1800`
    );

    return response;
  } catch (error) {
    console.error('Listing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
