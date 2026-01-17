/**
 * Freshness tracking types
 * Used to determine how confident we are about a listing's age
 */

export type FreshnessConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type FreshnessSource = 'dealer_meta' | 'wayback' | 'inferred' | 'unknown';

export interface FreshnessData {
  confidence: FreshnessConfidence;
  source: FreshnessSource;
  displayDate: string | null;
}

export interface FreshnessDisplayResult {
  text: string;
  show: boolean;
  isVerified: boolean;
}
