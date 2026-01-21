'use client';

import { useMemo } from 'react';
import { useApiCache } from './useApiCache';
import type { YuhinkaiEnrichment, ItemType } from '@/types';
import { isTosogu, isBlade } from '@/types';

/**
 * Hook for fetching Yuhinkai catalog enrichment data on-demand.
 *
 * Only fetches if the listing is eligible for enrichment:
 * - Item type is tosogu (tsuba, fuchi-kashira, etc.) or blade (katana, wakizashi, etc.)
 * - Certification is Juyo or Tokubetsu Juyo (where enrichment exists)
 *
 * Uses aggressive caching since enrichment data rarely changes.
 *
 * @param listingId - The listing ID to fetch enrichment for
 * @param itemType - The item type (used to determine eligibility)
 * @param certType - The certification type (used to determine eligibility)
 * @returns Enrichment data, loading state, and any errors
 *
 * @example
 * ```tsx
 * const { enrichment, isLoading } = useListingEnrichment(
 *   listing.id,
 *   listing.item_type,
 *   listing.cert_type
 * );
 *
 * if (isLoading) return <EnrichmentSkeleton />;
 * if (enrichment) return <YuhinkaiEnrichmentSection enrichment={enrichment} />;
 * return <SetsumeiSection listing={listing} />;
 * ```
 */

interface EnrichmentResponse {
  enrichment: YuhinkaiEnrichment | null;
}

interface UseListingEnrichmentOptions {
  /** Whether to enable fetching (default: true) */
  enabled?: boolean;
}

interface UseListingEnrichmentReturn {
  /** The enrichment data, or null if not available */
  enrichment: YuhinkaiEnrichment | null;
  /** Whether the enrichment is currently loading */
  isLoading: boolean;
  /** Any error that occurred during fetching */
  error: Error | null;
  /** Whether the listing is eligible for enrichment (used to show skeleton) */
  isEligible: boolean;
}

// Certification types that have Yuhinkai catalog enrichment
// Currently only Juyo Tosogu items have been matched
const ENRICHMENT_CERT_TYPES = [
  'Juyo',
  'juyo',
  'Tokubetsu Juyo',
  'tokubetsu_juyo',
  'Tokuju',
  'tokuju',
  // Tosogu-specific variants
  'Juyo Tosogu',
  'Tokubetsu Juyo Tosogu',
];

/**
 * Check if a listing is eligible for Yuhinkai enrichment.
 * Supports both blades (swords) and tosogu with Juyo/Tokuju certification.
 */
function isEligibleForEnrichment(
  itemType: ItemType | string | undefined,
  certType: string | undefined
): boolean {
  // Must be tosogu or blade type
  if (!itemType || (!isTosogu(itemType as ItemType) && !isBlade(itemType as ItemType))) {
    return false;
  }

  // Must have Juyo or Tokuju certification
  if (!certType || !ENRICHMENT_CERT_TYPES.includes(certType)) {
    return false;
  }

  return true;
}

export function useListingEnrichment(
  listingId: number | undefined,
  itemType: ItemType | string | undefined,
  certType: string | undefined,
  options: UseListingEnrichmentOptions = {}
): UseListingEnrichmentReturn {
  const { enabled = true } = options;

  // Determine eligibility
  const isEligible = useMemo(
    () => isEligibleForEnrichment(itemType, certType),
    [itemType, certType]
  );

  // Only fetch if eligible and enabled
  const shouldFetch = enabled && isEligible && !!listingId;

  // Build URL only if we should fetch
  // Check for ?nocache=1 in the page URL to bust client cache too
  const nocache = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('nocache') === '1';
  const url = shouldFetch
    ? `/api/listing/${listingId}/enrichment${nocache ? '?nocache=1' : ''}`
    : null;

  // Use the cached API fetcher with long TTL (enrichment rarely changes)
  const { data, isLoading, error } = useApiCache<EnrichmentResponse>(url, {
    ttl: 60 * 60 * 1000, // 1 hour cache
    enabled: shouldFetch,
    staleWhileRevalidate: true,
  });

  return {
    enrichment: data?.enrichment ?? null,
    isLoading: shouldFetch && isLoading,
    error,
    isEligible,
  };
}

export default useListingEnrichment;
