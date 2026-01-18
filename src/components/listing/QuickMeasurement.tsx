'use client';

import type { Listing } from '@/types';
import { isBlade, isTosogu } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface QuickMeasurementProps {
  listing: Listing;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Returns a compact measurement display for the collapsed mobile pill
 * - Swords: nagasa (blade length) e.g., "71.2cm"
 * - Tosogu: dimensions (height × width) e.g., "7.5×7.2cm"
 */
export function QuickMeasurement({ listing, className = '' }: QuickMeasurementProps) {
  const itemIsBlade = isBlade(listing.item_type);
  const itemIsTosogu = isTosogu(listing.item_type);

  // Sword: show nagasa
  if (itemIsBlade && listing.nagasa_cm) {
    return (
      <span className={`text-[12px] text-muted tabular-nums ${className}`}>
        {listing.nagasa_cm}cm
      </span>
    );
  }

  // Tosogu: show height × width
  if (itemIsTosogu && listing.height_cm && listing.width_cm) {
    return (
      <span className={`text-[12px] text-muted tabular-nums ${className}`}>
        {listing.height_cm}×{listing.width_cm}cm
      </span>
    );
  }

  // No measurement available
  return null;
}

/**
 * Helper function to get measurement string without component wrapper
 * Useful for cases where you need just the text
 */
export function getQuickMeasurementText(listing: Listing): string | null {
  const itemIsBlade = isBlade(listing.item_type);
  const itemIsTosogu = isTosogu(listing.item_type);

  if (itemIsBlade && listing.nagasa_cm) {
    return `${listing.nagasa_cm}cm`;
  }

  if (itemIsTosogu && listing.height_cm && listing.width_cm) {
    return `${listing.height_cm}×${listing.width_cm}cm`;
  }

  return null;
}

export default QuickMeasurement;
