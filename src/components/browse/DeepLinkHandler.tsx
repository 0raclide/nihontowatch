'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';

/**
 * Handles deep links to listings via the ?listing= URL parameter.
 *
 * When the page loads with ?listing=<id>, this component:
 * 1. Fetches the listing from the API (same endpoint used by QuickView)
 * 2. Opens the QuickView modal with that listing
 *
 * This enables shareable URLs that open specific listings.
 *
 * Uses the /api/listing/[id] endpoint instead of direct Supabase queries
 * to ensure consistent data format and avoid RLS/client-side issues.
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

    // Fetch and open the listing using the API endpoint
    // This ensures we get the same data format as QuickView's fetchFullListing
    const fetchAndOpenListing = async () => {
      try {
        const response = await fetch(`/api/listing/${listingId}`);

        if (!response.ok) {
          console.error('Failed to fetch listing for deep link:', response.status);
          return;
        }

        const data = await response.json();
        const listingData = data.listing;

        if (!listingData) {
          console.error('No listing data in response for deep link');
          return;
        }

        // The API returns the listing with 'dealers' (plural) from Supabase join
        // Map to both 'dealers' and 'dealer' for compatibility with all components
        const listing = {
          ...listingData,
          // Ensure both singular and plural dealer references work
          dealer: listingData.dealers ? {
            id: listingData.dealers.id,
            name: listingData.dealers.name,
            domain: listingData.dealers.domain,
          } : undefined,
        } as Listing;

        // Open the QuickView with complete listing data
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
