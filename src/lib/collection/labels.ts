// =============================================================================
// Shared collection labels, formatters, and constants
//
// Single source of truth for display labels used across:
//   CollectionCard, CollectionItemContent, CollectionMobileSheet,
//   CollectionFilterContent, CollectionBottomBar
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CertTier = 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon';

export interface CertLabelInfo {
  /** Full label, e.g. "Tokubetsu Juyo" */
  label: string;
  /** Abbreviated label, e.g. "Tokuju" */
  shortLabel: string;
  tier: CertTier;
}

// -----------------------------------------------------------------------------
// Certification labels
// -----------------------------------------------------------------------------

export const CERT_LABELS: Record<string, CertLabelInfo> = {
  Tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', tier: 'tokuju' },
  tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', tier: 'tokuju' },
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', tier: 'tokuju' },
  'Juyo Bijutsuhin': { label: 'Juyo Bijutsuhin', shortLabel: 'Jubi', tier: 'jubi' },
  'Juyo Bunkazai': { label: 'Juyo Bunkazai', shortLabel: 'JuBun', tier: 'jubi' },
  Juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'juyo' },
  juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'juyo' },
  TokuHozon: { label: 'Tokubetsu Hozon', shortLabel: 'Tokuho', tier: 'tokuho' },
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', shortLabel: 'Tokuho', tier: 'tokuho' },
  Hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'hozon' },
  Kokuho: { label: 'Kokuho', shortLabel: 'Kokuho', tier: 'tokuju' },
};

// -----------------------------------------------------------------------------
// Status labels
// -----------------------------------------------------------------------------

export const STATUS_LABELS: Record<string, string> = {
  owned: 'Owned',
  sold: 'Sold',
  lent: 'Lent',
  consignment: 'On Consignment',
};

// -----------------------------------------------------------------------------
// Condition labels
// -----------------------------------------------------------------------------

export const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  project: 'Project',
};

// -----------------------------------------------------------------------------
// Item type labels (superset of all known types)
// -----------------------------------------------------------------------------

export const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tanto', tachi: 'Tachi',
  naginata: 'Naginata', yari: 'Yari', ken: 'Ken', kodachi: 'Kodachi',
  tsuba: 'Tsuba', kozuka: 'Kozuka', kogai: 'Kogai', menuki: 'Menuki',
  'fuchi-kashira': 'Fuchi-Kashira', fuchi_kashira: 'Fuchi-Kashira',
  koshirae: 'Koshirae', armor: 'Armor', helmet: 'Kabuto', tosogu: 'Tosogu',
};

// -----------------------------------------------------------------------------
// Sort options (collection grid)
// -----------------------------------------------------------------------------

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest Added' },
  { value: 'value_desc', label: 'Value: High to Low' },
  { value: 'value_asc', label: 'Value: Low to High' },
  { value: 'type', label: 'Item Type' },
] as const;

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

export function getItemTypeLabel(t: string | null): string {
  if (!t) return 'Item';
  return ITEM_TYPE_LABELS[t.toLowerCase()] || t.charAt(0).toUpperCase() + t.slice(1);
}

export function getCertTierClass(tier: CertTier): string {
  switch (tier) {
    case 'tokuju': return 'text-tokuju';
    case 'jubi': return 'text-jubi';
    case 'juyo': return 'text-juyo';
    case 'tokuho': return 'text-toku-hozon';
    case 'hozon': return 'text-hozon';
  }
}

export function formatPrice(value: number | null, currency: string | null): string | null {
  if (!value) return null;
  const curr = currency || 'JPY';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${curr} ${value.toLocaleString()}`;
  }
}

export function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return date;
  }
}
