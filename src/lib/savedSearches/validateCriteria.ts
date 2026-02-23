import type { SavedSearchCriteria } from '@/types';

/**
 * Validate saved search criteria.
 * Returns an error message string if invalid, or null if valid.
 *
 * IMPORTANT: This validation must stay in sync with the client-side
 * `hasFilters` check in MobileAlertBar.tsx and SaveSearchButton.tsx.
 * If you add a new filter here, add it to those components too.
 */
export function validateCriteria(criteria: SavedSearchCriteria): string | null {
  // At least one filter should be set
  const hasFilter =
    criteria.itemTypes?.length ||
    criteria.certifications?.length ||
    criteria.dealers?.length ||
    criteria.schools?.length ||
    criteria.query ||
    criteria.minPrice !== undefined ||
    criteria.maxPrice !== undefined ||
    criteria.askOnly ||
    !!criteria.category;

  if (!hasFilter) {
    return 'At least one search filter is required';
  }

  // Validate arrays
  if (criteria.itemTypes && !Array.isArray(criteria.itemTypes)) {
    return 'itemTypes must be an array';
  }
  if (criteria.certifications && !Array.isArray(criteria.certifications)) {
    return 'certifications must be an array';
  }
  if (criteria.dealers && !Array.isArray(criteria.dealers)) {
    return 'dealers must be an array';
  }

  // Validate price range
  if (
    criteria.minPrice !== undefined &&
    criteria.maxPrice !== undefined &&
    criteria.minPrice > criteria.maxPrice
  ) {
    return 'minPrice cannot be greater than maxPrice';
  }

  return null;
}
