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
 * - Tosogu: not yet available (height_cm, width_cm columns don't exist in DB)
 */
export function QuickMeasurement({ listing, className = '' }: QuickMeasurementProps) {
  const itemIsBlade = isBlade(listing.item_type);

  // Sword: show nagasa
  if (itemIsBlade && listing.nagasa_cm) {
    return (
      <span className={`text-[12px] text-muted tabular-nums ${className}`}>
        {listing.nagasa_cm}cm
      </span>
    );
  }

  // Tosogu measurements not yet in database
  // TODO: Add when height_cm, width_cm columns exist

  // No measurement available
  return null;
}

/**
 * Helper function to get measurement string without component wrapper
 * Useful for cases where you need just the text
 */
export function getQuickMeasurementText(listing: Listing): string | null {
  const itemIsBlade = isBlade(listing.item_type);

  if (itemIsBlade && listing.nagasa_cm) {
    return `${listing.nagasa_cm}cm`;
  }

  // Tosogu measurements not yet in database
  return null;
}

export default QuickMeasurement;
