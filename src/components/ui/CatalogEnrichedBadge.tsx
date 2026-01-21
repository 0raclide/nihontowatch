'use client';

import type { YuhinkaiEnrichment } from '@/types';

interface CatalogEnrichedBadgeProps {
  enrichment: YuhinkaiEnrichment;
  /** Compact mode for listing cards */
  compact?: boolean;
  className?: string;
}

/**
 * Badge indicating a listing has Yuhinkai catalog enrichment.
 *
 * Uses positive framing ("Catalog Enriched") rather than "Verified"
 * to avoid implying non-enriched items are unverified.
 *
 * Only shown for DEFINITIVE confidence matches with auto/confirmed status.
 */
export function CatalogEnrichedBadge({
  enrichment,
  compact = false,
  className = '',
}: CatalogEnrichedBadgeProps) {
  // Only show for DEFINITIVE matches
  if (enrichment.match_confidence !== 'DEFINITIVE') {
    return null;
  }

  // Only show for auto or confirmed status
  if (!['auto', 'confirmed'].includes(enrichment.verification_status)) {
    return null;
  }

  if (compact) {
    return (
      <span
        data-testid="catalog-enriched-badge"
        className={`
          text-[9px] uppercase tracking-wider font-medium
          px-1.5 py-0.5 rounded
          bg-gold/15 text-gold border border-gold/30
          ${className}
        `.trim()}
        title="Enhanced with official catalog data"
      >
        Catalog
      </span>
    );
  }

  return (
    <span
      data-testid="catalog-enriched-badge"
      className={`
        text-[10px] uppercase tracking-wider font-semibold
        px-2 py-0.5 rounded
        bg-gold/15 text-gold border border-gold/30
        inline-flex items-center gap-1
        ${className}
      `.trim()}
      title={`Match confidence: ${(enrichment.match_score * 100).toFixed(0)}%`}
    >
      <svg
        className="w-3 h-3"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      Catalog Enriched
    </span>
  );
}

/**
 * Inline indicator for catalog enrichment in metadata grids.
 * Shows as a small golden dot with tooltip.
 */
export function CatalogEnrichedIndicator({
  className = '',
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full bg-gold ${className}`}
      title="Enhanced with official catalog data"
      aria-label="Catalog enriched"
    />
  );
}
