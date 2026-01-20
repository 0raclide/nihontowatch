'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';

/**
 * Handles deep links to listings via the ?listing= URL parameter.
 *
 * When the page loads with ?listing=<id>, this component:
 * 1. Fetches the listing from Supabase
 * 2. Opens the QuickView modal with that listing
 *
 * This enables shareable URLs that open specific listings.
 */
export function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const quickView = useQuickViewOptional();
  const hasHandledRef = useRef(false);
  const listingParam = searchParams.get('listing');

  useEffect(() => {
    // Only handle once per mount
    if (hasHandledRef.current) return;

    // Skip if no listing param or no QuickView context
    if (!listingParam || !quickView) return;

    const listingId = parseInt(listingParam, 10);
    if (isNaN(listingId)) return;

    // Fetch and open the listing
    const fetchAndOpenListing = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('listings')
          .select(`
            *,
            dealers (
              id,
              name,
              domain,
              is_active,
              created_at
            )
          `)
          .eq('id', listingId)
          .single();

        if (error || !data) {
          console.error('Failed to fetch listing for deep link:', error);
          return;
        }

        // Cast data to a type we can work with
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listingData = data as any;

        // Convert to Listing type expected by QuickView
        // Use type assertion since we know the data from Supabase includes all required fields
        const listing = {
          id: listingData.id,
          url: listingData.url,
          title: listingData.title,
          item_type: listingData.item_type,
          price_value: listingData.price_value,
          price_currency: listingData.price_currency,
          smith: listingData.smith,
          tosogu_maker: listingData.tosogu_maker,
          school: listingData.school,
          tosogu_school: listingData.tosogu_school,
          cert_type: listingData.cert_type,
          nagasa_cm: listingData.nagasa_cm,
          sori_cm: listingData.sori_cm,
          motohaba_cm: listingData.motohaba_cm,
          images: listingData.images || [],
          stored_images: listingData.stored_images,
          first_seen_at: listingData.first_seen_at,
          last_scraped_at: listingData.last_scraped_at,
          scrape_count: listingData.scrape_count || 0,
          status: listingData.status,
          is_available: listingData.is_available,
          is_sold: listingData.is_sold,
          page_exists: listingData.page_exists ?? true,
          dealer_id: listingData.dealer_id,
          dealer: listingData.dealers ? {
            id: listingData.dealers.id,
            name: listingData.dealers.name,
            domain: listingData.dealers.domain,
            is_active: listingData.dealers.is_active,
            created_at: listingData.dealers.created_at,
          } : undefined,
        } as Listing;

        // Open the QuickView
        quickView.openQuickView(listing);
        hasHandledRef.current = true;
      } catch (err) {
        console.error('Error handling deep link:', err);
      }
    };

    fetchAndOpenListing();
  }, [listingParam, quickView]);

  // This component doesn't render anything
  return null;
}
