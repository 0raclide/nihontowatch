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

export type MarketTimeTier = 'fresh' | 'recent' | 'standard' | 'aging' | 'long';

export interface MarketTimeDisplay {
  label: string;           // "3 days", "2 months", "Over a year"
  shortLabel: string;      // "3d", "2mo", "1y+"
  daysOnMarket: number;
  tier: MarketTimeTier;
  startDate: string;       // ISO date for counter calculation
}
