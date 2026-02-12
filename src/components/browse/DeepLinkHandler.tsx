'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';

/**
 * Map raw API listing data to the format QuickView expects.
 * The API returns 'dealers' (plural) from Supabase join;
 * we add a 'dealer' (singular) alias for component compatibility.
 */
function mapApiListing(listingData: Record<string, unknown>): Listing {
  return {
    ...listingData,
    dealer: listingData.dealers ? {
      id: (listingData.dealers as Record<string, unknown>).id,
      name: (listingData.dealers as Record<string, unknown>).name,
      domain: (listingData.dealers as Record<string, unknown>).domain,
    } : undefined,
  } as Listing;
}

/**
 * Handles deep links to listings via URL parameters.
 *
 * Supports two modes:
 * 1. Single listing: ?listing=<id> — opens one listing in QuickView
 * 2. Multi-listing carousel: ?listings=<id1>,<id2>,... — fetches all in parallel,
 *    opens a navigable QuickView carousel (used by alert email CTAs)
 *
 * Optional ?alert_search=<name> stores context in sessionStorage for the
 * AlertContextBanner to display "Match 1 of N — <name>".
 *
 * ?listings= takes priority over ?listing= if both are present.
 */
export function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const quickView = useQuickViewOptional();
  const hasHandledRef = useRef(false);
  const listingParam = searchParams.get('listing');
  const listingsParam = searchParams.get('listings');
  const alertSearchParam = searchParams.get('alert_search');

  useEffect(() => {
    if (hasHandledRef.current) return;
    if (!quickView) return;

    // Multi-listing carousel (?listings= takes priority)
    if (listingsParam) {
      const ids = listingsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (ids.length === 0) return;

      const fetchAndOpenMultiple = async () => {
        try {
          const results = await Promise.allSettled(
            ids.map((id) =>
              fetch(`/api/listing/${id}`).then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data.listing) throw new Error('No listing data');
                return mapApiListing(data.listing);
              })
            )
          );

          const listings = results
            .filter((r): r is PromiseFulfilledResult<Listing> => r.status === 'fulfilled')
            .map((r) => r.value);

          if (listings.length === 0) return;

          // Store alert context for the banner
          if (alertSearchParam) {
            try {
              sessionStorage.setItem(
                'quickview_alert_context',
                JSON.stringify({
                  searchName: alertSearchParam,
                  totalMatches: ids.length,
                })
              );
            } catch {
              // sessionStorage may be unavailable
            }
          }

          quickView.setListings(listings);
          quickView.openQuickView(listings[0]);
          hasHandledRef.current = true;
        } catch (err) {
          console.error('Error handling multi-listing deep link:', err);
        }
      };

      fetchAndOpenMultiple();
      return;
    }

    // Single listing (?listing=)
    if (listingParam) {
      const listingId = parseInt(listingParam, 10);
      if (isNaN(listingId)) return;

      const fetchAndOpenListing = async () => {
        try {
          const response = await fetch(`/api/listing/${listingId}`);
          if (!response.ok) {
            console.error('Failed to fetch listing for deep link:', response.status);
            return;
          }

          const data = await response.json();
          if (!data.listing) {
            console.error('No listing data in response for deep link');
            return;
          }

          const listing = mapApiListing(data.listing);
          quickView.openQuickView(listing);
          hasHandledRef.current = true;
        } catch (err) {
          console.error('Error handling deep link:', err);
        }
      };

      fetchAndOpenListing();
    }
  }, [listingParam, listingsParam, alertSearchParam, quickView]);

  return null;
}
