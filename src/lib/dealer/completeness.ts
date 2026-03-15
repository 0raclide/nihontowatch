import type { DisplayItem } from '@/types/displayItem';
import { getAttributionName } from '@/lib/listing/attribution';

export interface CompletenessResult {
  score: number;
  total: number;
  missing: string[];
}

/**
 * Compute listing completeness score (0–100) for dealer inventory table.
 *
 * Scoring weights:
 *   images (20), price (20), attribution (15), measurements (15),
 *   description (10), era (5), cert (5), school (5), province (5) = 100
 */
export function computeInventoryCompleteness(item: DisplayItem): CompletenessResult {
  const total = 100;
  let score = 0;
  const missing: string[] = [];

  // Images (20) — at least 1 image
  const imageCount = (item.stored_images?.length || 0) || (item.images?.length || 0);
  if (imageCount > 0) {
    score += 20;
  } else {
    missing.push('Images');
  }

  // Price (20) — has a price value
  if (item.price_value != null && item.price_value > 0) {
    score += 20;
  } else {
    missing.push('Price');
  }

  // Attribution (15) — smith or tosogu_maker
  if (getAttributionName(item)) {
    score += 15;
  } else {
    missing.push('Attribution');
  }

  // Measurements (15) — at least one measurement field
  const hasMeasurements =
    item.nagasa_cm != null ||
    item.sori_cm != null ||
    item.motohaba_cm != null ||
    item.sakihaba_cm != null;
  if (hasMeasurements) {
    score += 15;
  } else {
    missing.push('Measurements');
  }

  // Description (10)
  if (item.description && item.description.trim().length > 0) {
    score += 10;
  } else {
    missing.push('Description');
  }

  // Era (5)
  if (item.era) {
    score += 5;
  } else {
    missing.push('Era');
  }

  // Certification (5)
  if (item.cert_type) {
    score += 5;
  } else {
    missing.push('Certification');
  }

  // School (5)
  const school = item.school || item.tosogu_school;
  if (school) {
    score += 5;
  } else {
    missing.push('School');
  }

  // Province (5)
  if (item.province) {
    score += 5;
  } else {
    missing.push('Province');
  }

  return { score, total, missing };
}
