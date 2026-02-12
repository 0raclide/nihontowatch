/**
 * Golden tests for collection labels, formatters, and constants.
 *
 * These pin the exact values exported from lib/collection/labels.ts
 * to prevent drift when multiple components share these constants.
 */

import { describe, it, expect } from 'vitest';
import {
  CERT_LABELS,
  STATUS_LABELS,
  CONDITION_LABELS,
  ITEM_TYPE_LABELS,
  SORT_OPTIONS,
  getCertTierClass,
  getItemTypeLabel,
  formatPrice,
  formatDate,
  type CertTier,
} from '@/lib/collection/labels';

// =============================================================================
// CERT_LABELS
// =============================================================================

describe('CERT_LABELS', () => {
  it('has all expected cert types', () => {
    const expectedKeys = [
      'Tokuju', 'tokuju', 'Tokubetsu Juyo',
      'Juyo Bijutsuhin', 'Juyo Bunkazai',
      'Juyo', 'juyo',
      'TokuHozon', 'Tokubetsu Hozon',
      'Hozon', 'hozon',
      'Kokuho',
    ];
    expectedKeys.forEach(key => {
      expect(CERT_LABELS[key], `Missing key: ${key}`).toBeDefined();
    });
  });

  it('Tokubetsu Juyo variants all resolve to same values', () => {
    const variants = ['Tokuju', 'tokuju', 'Tokubetsu Juyo'];
    variants.forEach(key => {
      expect(CERT_LABELS[key].label).toBe('Tokubetsu Juyo');
      expect(CERT_LABELS[key].shortLabel).toBe('Tokuju');
      expect(CERT_LABELS[key].tier).toBe('tokuju');
    });
  });

  it('Juyo variants resolve correctly', () => {
    expect(CERT_LABELS['Juyo'].shortLabel).toBe('Juyo');
    expect(CERT_LABELS['juyo'].shortLabel).toBe('Juyo');
    expect(CERT_LABELS['Juyo'].tier).toBe('juyo');
  });

  it('Hozon variants resolve correctly', () => {
    expect(CERT_LABELS['Hozon'].shortLabel).toBe('Hozon');
    expect(CERT_LABELS['hozon'].shortLabel).toBe('Hozon');
    expect(CERT_LABELS['Hozon'].tier).toBe('hozon');
  });

  it('Tokubetsu Hozon variants resolve correctly', () => {
    expect(CERT_LABELS['TokuHozon'].shortLabel).toBe('Tokuho');
    expect(CERT_LABELS['Tokubetsu Hozon'].shortLabel).toBe('Tokuho');
    expect(CERT_LABELS['TokuHozon'].tier).toBe('tokuho');
  });

  it('Juyo Bijutsuhin has jubi tier', () => {
    expect(CERT_LABELS['Juyo Bijutsuhin'].shortLabel).toBe('Jubi');
    expect(CERT_LABELS['Juyo Bijutsuhin'].tier).toBe('jubi');
  });

  it('Juyo Bunkazai has jubi tier', () => {
    expect(CERT_LABELS['Juyo Bunkazai'].shortLabel).toBe('JuBun');
    expect(CERT_LABELS['Juyo Bunkazai'].tier).toBe('jubi');
  });

  it('Kokuho has tokuju tier', () => {
    expect(CERT_LABELS['Kokuho'].shortLabel).toBe('Kokuho');
    expect(CERT_LABELS['Kokuho'].tier).toBe('tokuju');
  });

  it('every entry has label, shortLabel, and tier', () => {
    Object.entries(CERT_LABELS).forEach(([key, info]) => {
      expect(info.label, `${key}.label`).toBeTruthy();
      expect(info.shortLabel, `${key}.shortLabel`).toBeTruthy();
      expect(info.tier, `${key}.tier`).toBeTruthy();
    });
  });
});

// =============================================================================
// STATUS_LABELS
// =============================================================================

describe('STATUS_LABELS', () => {
  it('has all four statuses', () => {
    expect(STATUS_LABELS.owned).toBe('Owned');
    expect(STATUS_LABELS.sold).toBe('Sold');
    expect(STATUS_LABELS.lent).toBe('Lent');
    expect(STATUS_LABELS.consignment).toBe('On Consignment');
  });

  it('has exactly 4 entries', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
  });
});

// =============================================================================
// CONDITION_LABELS
// =============================================================================

describe('CONDITION_LABELS', () => {
  it('has all five conditions', () => {
    expect(CONDITION_LABELS.mint).toBe('Mint');
    expect(CONDITION_LABELS.excellent).toBe('Excellent');
    expect(CONDITION_LABELS.good).toBe('Good');
    expect(CONDITION_LABELS.fair).toBe('Fair');
    expect(CONDITION_LABELS.project).toBe('Project');
  });

  it('has exactly 5 entries', () => {
    expect(Object.keys(CONDITION_LABELS)).toHaveLength(5);
  });
});

// =============================================================================
// ITEM_TYPE_LABELS
// =============================================================================

describe('ITEM_TYPE_LABELS', () => {
  it('includes all blade types', () => {
    expect(ITEM_TYPE_LABELS.katana).toBe('Katana');
    expect(ITEM_TYPE_LABELS.wakizashi).toBe('Wakizashi');
    expect(ITEM_TYPE_LABELS.tanto).toBe('Tanto');
    expect(ITEM_TYPE_LABELS.tachi).toBe('Tachi');
    expect(ITEM_TYPE_LABELS.naginata).toBe('Naginata');
    expect(ITEM_TYPE_LABELS.yari).toBe('Yari');
    expect(ITEM_TYPE_LABELS.ken).toBe('Ken');
    expect(ITEM_TYPE_LABELS.kodachi).toBe('Kodachi');
  });

  it('includes all tosogu types', () => {
    expect(ITEM_TYPE_LABELS.tsuba).toBe('Tsuba');
    expect(ITEM_TYPE_LABELS.kozuka).toBe('Kozuka');
    expect(ITEM_TYPE_LABELS.kogai).toBe('Kogai');
    expect(ITEM_TYPE_LABELS.menuki).toBe('Menuki');
    expect(ITEM_TYPE_LABELS['fuchi-kashira']).toBe('Fuchi-Kashira');
    expect(ITEM_TYPE_LABELS.fuchi_kashira).toBe('Fuchi-Kashira');
    expect(ITEM_TYPE_LABELS.tosogu).toBe('Tosogu');
  });

  it('includes other types', () => {
    expect(ITEM_TYPE_LABELS.koshirae).toBe('Koshirae');
    expect(ITEM_TYPE_LABELS.armor).toBe('Armor');
    expect(ITEM_TYPE_LABELS.helmet).toBe('Kabuto');
  });
});

// =============================================================================
// SORT_OPTIONS
// =============================================================================

describe('SORT_OPTIONS', () => {
  it('has 4 options in correct order', () => {
    expect(SORT_OPTIONS).toHaveLength(4);
    expect(SORT_OPTIONS[0].value).toBe('newest');
    expect(SORT_OPTIONS[1].value).toBe('value_desc');
    expect(SORT_OPTIONS[2].value).toBe('value_asc');
    expect(SORT_OPTIONS[3].value).toBe('type');
  });

  it('each option has value and label', () => {
    SORT_OPTIONS.forEach(opt => {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    });
  });
});

// =============================================================================
// getCertTierClass
// =============================================================================

describe('getCertTierClass', () => {
  it('returns correct Tailwind class for each tier', () => {
    expect(getCertTierClass('tokuju')).toBe('text-tokuju');
    expect(getCertTierClass('jubi')).toBe('text-jubi');
    expect(getCertTierClass('juyo')).toBe('text-juyo');
    expect(getCertTierClass('tokuho')).toBe('text-toku-hozon');
    expect(getCertTierClass('hozon')).toBe('text-hozon');
  });

  it('covers every CertTier value', () => {
    const allTiers: CertTier[] = ['tokuju', 'jubi', 'juyo', 'tokuho', 'hozon'];
    allTiers.forEach(tier => {
      expect(getCertTierClass(tier)).toMatch(/^text-/);
    });
  });
});

// =============================================================================
// getItemTypeLabel
// =============================================================================

describe('getItemTypeLabel', () => {
  it('returns "Item" for null', () => {
    expect(getItemTypeLabel(null)).toBe('Item');
  });

  it('returns known labels for mapped types', () => {
    expect(getItemTypeLabel('katana')).toBe('Katana');
    expect(getItemTypeLabel('tsuba')).toBe('Tsuba');
    expect(getItemTypeLabel('helmet')).toBe('Kabuto');
  });

  it('is case-insensitive', () => {
    expect(getItemTypeLabel('KATANA')).toBe('Katana');
    expect(getItemTypeLabel('Tsuba')).toBe('Tsuba');
  });

  it('capitalizes unknown types', () => {
    expect(getItemTypeLabel('something')).toBe('Something');
  });
});

// =============================================================================
// formatPrice
// =============================================================================

describe('formatPrice', () => {
  it('returns null for null value', () => {
    expect(formatPrice(null, 'JPY')).toBeNull();
  });

  it('returns null for zero value', () => {
    expect(formatPrice(0, 'JPY')).toBeNull();
  });

  it('formats JPY without decimals', () => {
    const result = formatPrice(1500000, 'JPY');
    expect(result).toContain('1,500,000');
    expect(result).toContain('¥');
  });

  it('formats USD without decimals', () => {
    const result = formatPrice(25000, 'USD');
    expect(result).toContain('25,000');
    expect(result).toContain('$');
  });

  it('defaults to JPY when currency is null', () => {
    const result = formatPrice(100000, null);
    expect(result).toContain('¥');
  });

  it('handles invalid currency gracefully', () => {
    const result = formatPrice(1000, 'INVALID');
    expect(result).toBeTruthy();
    expect(result).toContain('1,000');
  });
});

// =============================================================================
// formatDate
// =============================================================================

describe('formatDate', () => {
  it('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('formats ISO date strings', () => {
    const result = formatDate('2024-06-15');
    expect(result).toContain('June');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('returns a string for unparseable dates', () => {
    // new Date('not-a-date') creates Invalid Date, toLocaleDateString returns "Invalid Date"
    const result = formatDate('not-a-date');
    expect(result).toBeTruthy();
  });
});
