/**
 * Tests for Semantic Query Parser
 *
 * Specifically tests the category term expansion feature where:
 * - "nihonto" expands to all blade types
 * - "tosogu" expands to all fitting types
 *
 * This ensures typing "tosogu" gives the same results as selecting the Tosogu filter.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSemanticQuery,
  isSemanticTerm,
  getCategoryTypes,
  getCertificationKey,
  getItemTypeKey,
  getSignatureStatusKey,
  getProvinceKey,
  NIHONTO_TYPES,
  TOSOGU_TYPES,
  ARMOR_TYPES,
} from '@/lib/search/semanticQueryParser';

// =============================================================================
// CATEGORY TERM EXPANSION
// =============================================================================

describe('Category Term Expansion', () => {
  describe('nihonto category', () => {
    it('expands "nihonto" to all blade types', () => {
      const result = parseSemanticQuery('nihonto');

      expect(result.extractedFilters.itemTypes).toEqual(
        expect.arrayContaining(['katana', 'wakizashi', 'tanto', 'tachi'])
      );
      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "sword" to all blade types', () => {
      const result = parseSemanticQuery('sword');

      expect(result.extractedFilters.itemTypes).toEqual(
        expect.arrayContaining(['katana', 'wakizashi', 'tanto'])
      );
      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "swords" to all blade types', () => {
      const result = parseSemanticQuery('swords');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "blade" to all blade types', () => {
      const result = parseSemanticQuery('blade');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
    });

    it('expands "blades" to all blade types', () => {
      const result = parseSemanticQuery('blades');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
    });

    it('expands "japanese sword" (multi-word) to all blade types', () => {
      const result = parseSemanticQuery('japanese sword');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "japanese swords" (multi-word) to all blade types', () => {
      const result = parseSemanticQuery('japanese swords');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });
  });

  describe('tosogu category', () => {
    it('expands "tosogu" to all fitting types', () => {
      const result = parseSemanticQuery('tosogu');

      expect(result.extractedFilters.itemTypes).toEqual(
        expect.arrayContaining(['tsuba', 'fuchi-kashira', 'menuki', 'kozuka'])
      );
      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "fittings" to all fitting types', () => {
      const result = parseSemanticQuery('fittings');

      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "fitting" to all fitting types', () => {
      const result = parseSemanticQuery('fitting');

      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
    });

    it('expands "sword fittings" (multi-word) to all fitting types', () => {
      const result = parseSemanticQuery('sword fittings');

      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "kodogu" to all fitting types', () => {
      const result = parseSemanticQuery('kodogu');

      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
    });
  });

  describe('armor category', () => {
    it('expands "armor" to all armor types', () => {
      const result = parseSemanticQuery('armor');

      expect(result.extractedFilters.itemTypes).toEqual(
        expect.arrayContaining(['armor', 'helmet', 'menpo', 'kabuto'])
      );
      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "armour" (British spelling) to all armor types', () => {
      const result = parseSemanticQuery('armour');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "yoroi" to all armor types', () => {
      const result = parseSemanticQuery('yoroi');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
    });

    it('expands "gusoku" to all armor types', () => {
      const result = parseSemanticQuery('gusoku');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
    });

    it('expands "samurai armor" (multi-word) to all armor types', () => {
      const result = parseSemanticQuery('samurai armor');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "japanese armor" (multi-word) to all armor types', () => {
      const result = parseSemanticQuery('japanese armor');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
      expect(result.remainingTerms).toEqual([]);
    });

    it('expands "kacchu" to all armor types', () => {
      const result = parseSemanticQuery('kacchu');

      expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
    });
  });

  describe('category with additional terms', () => {
    it('combines category expansion with artisan search', () => {
      const result = parseSemanticQuery('tosogu goto');

      // Should have all tosogu types
      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
      // "goto" should be passed to text search
      expect(result.remainingTerms).toEqual(['goto']);
    });

    it('combines category expansion with certification', () => {
      const result = parseSemanticQuery('nihonto juyo');

      // Should have all nihonto types
      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      // Should extract Juyo certification
      expect(result.extractedFilters.certifications).toEqual(['Juyo']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('handles nihonto with province name', () => {
      const result = parseSemanticQuery('nihonto bizen');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('handles tosogu with maker name', () => {
      const result = parseSemanticQuery('tosogu yoshioka');

      expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
      expect(result.remainingTerms).toEqual(['yoshioka']);
    });
  });
});

// =============================================================================
// SINGLE ITEM TYPES (should NOT expand)
// =============================================================================

describe('Single Item Types (no expansion)', () => {
  it('"katana" returns only katana, not all nihonto', () => {
    const result = parseSemanticQuery('katana');

    expect(result.extractedFilters.itemTypes).toEqual(['katana']);
    expect(result.remainingTerms).toEqual([]);
  });

  it('"tsuba" returns only tsuba, not all tosogu', () => {
    const result = parseSemanticQuery('tsuba');

    expect(result.extractedFilters.itemTypes).toEqual(['tsuba']);
    expect(result.remainingTerms).toEqual([]);
  });

  it('"wakizashi" returns only wakizashi', () => {
    const result = parseSemanticQuery('wakizashi');

    expect(result.extractedFilters.itemTypes).toEqual(['wakizashi']);
  });

  it('"tanto" returns only tanto', () => {
    const result = parseSemanticQuery('tanto');

    expect(result.extractedFilters.itemTypes).toEqual(['tanto']);
  });

  it('"menuki" returns only menuki', () => {
    const result = parseSemanticQuery('menuki');

    expect(result.extractedFilters.itemTypes).toEqual(['menuki']);
  });

  it('"kozuka" returns only kozuka', () => {
    const result = parseSemanticQuery('kozuka');

    expect(result.extractedFilters.itemTypes).toEqual(['kozuka']);
  });

  // === ARMOR SINGLE TYPES ===
  it('"kabuto" returns only kabuto (not all armor)', () => {
    const result = parseSemanticQuery('kabuto');

    expect(result.extractedFilters.itemTypes).toEqual(['kabuto']);
    expect(result.extractedFilters.itemTypes.length).toBe(1);
  });

  it('"helmet" returns only helmet', () => {
    const result = parseSemanticQuery('helmet');

    expect(result.extractedFilters.itemTypes).toEqual(['helmet']);
  });

  it('"menpo" returns only menpo', () => {
    const result = parseSemanticQuery('menpo');

    expect(result.extractedFilters.itemTypes).toEqual(['menpo']);
  });

  it('"kote" returns only kote', () => {
    const result = parseSemanticQuery('kote');

    expect(result.extractedFilters.itemTypes).toEqual(['kote']);
  });

  it('"suneate" returns only suneate', () => {
    const result = parseSemanticQuery('suneate');

    expect(result.extractedFilters.itemTypes).toEqual(['suneate']);
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe('getCategoryTypes', () => {
  it('returns nihonto types for "nihonto"', () => {
    const types = getCategoryTypes('nihonto');
    expect(types).toBeDefined();
    expect(types).toEqual(NIHONTO_TYPES);
  });

  it('returns tosogu types for "tosogu"', () => {
    const types = getCategoryTypes('tosogu');
    expect(types).toBeDefined();
    expect(types).toEqual(TOSOGU_TYPES);
  });

  it('returns nihonto types for "sword"', () => {
    const types = getCategoryTypes('sword');
    expect(types).toEqual(NIHONTO_TYPES);
  });

  it('returns tosogu types for "fittings"', () => {
    const types = getCategoryTypes('fittings');
    expect(types).toEqual(TOSOGU_TYPES);
  });

  it('returns armor types for "armor"', () => {
    const types = getCategoryTypes('armor');
    expect(types).toBeDefined();
    expect(types).toEqual(ARMOR_TYPES);
  });

  it('returns armor types for "yoroi"', () => {
    const types = getCategoryTypes('yoroi');
    expect(types).toEqual(ARMOR_TYPES);
  });

  it('returns armor types for "kacchu"', () => {
    const types = getCategoryTypes('kacchu');
    expect(types).toEqual(ARMOR_TYPES);
  });

  it('returns undefined for single item types', () => {
    expect(getCategoryTypes('katana')).toBeUndefined();
    expect(getCategoryTypes('tsuba')).toBeUndefined();
  });

  it('returns undefined for unknown terms', () => {
    expect(getCategoryTypes('unknown')).toBeUndefined();
    expect(getCategoryTypes('masamune')).toBeUndefined();
  });
});

describe('isSemanticTerm', () => {
  it('returns true for category terms', () => {
    expect(isSemanticTerm('nihonto')).toBe(true);
    expect(isSemanticTerm('tosogu')).toBe(true);
    expect(isSemanticTerm('sword')).toBe(true);
    expect(isSemanticTerm('fittings')).toBe(true);
    expect(isSemanticTerm('armor')).toBe(true);
    expect(isSemanticTerm('yoroi')).toBe(true);
  });

  it('returns true for item types', () => {
    expect(isSemanticTerm('katana')).toBe(true);
    expect(isSemanticTerm('tsuba')).toBe(true);
    expect(isSemanticTerm('kabuto')).toBe(true);
    expect(isSemanticTerm('menpo')).toBe(true);
  });

  it('returns true for certifications', () => {
    expect(isSemanticTerm('juyo')).toBe(true);
    expect(isSemanticTerm('hozon')).toBe(true);
  });

  it('returns true for province terms', () => {
    expect(isSemanticTerm('bizen')).toBe(true);
    expect(isSemanticTerm('soshu')).toBe(true);
    expect(isSemanticTerm('yamashiro')).toBe(true);
  });

  it('returns false for non-semantic terms', () => {
    expect(isSemanticTerm('goto')).toBe(false);
    expect(isSemanticTerm('masamune')).toBe(false);
  });
});

// =============================================================================
// CASE INSENSITIVITY
// =============================================================================

describe('Case Insensitivity', () => {
  it('handles uppercase "NIHONTO"', () => {
    const result = parseSemanticQuery('NIHONTO');
    expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
  });

  it('handles uppercase "TOSOGU"', () => {
    const result = parseSemanticQuery('TOSOGU');
    expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
  });

  it('handles mixed case "ToSoGu"', () => {
    const result = parseSemanticQuery('ToSoGu');
    expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
  });

  it('handles mixed case "NiHonTo"', () => {
    const result = parseSemanticQuery('NiHonTo');
    expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
  });

  it('handles uppercase "ARMOR"', () => {
    const result = parseSemanticQuery('ARMOR');
    expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
  });

  it('handles mixed case "KaBuTo"', () => {
    const result = parseSemanticQuery('KaBuTo');
    expect(result.extractedFilters.itemTypes).toEqual(['kabuto']);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty string', () => {
    const result = parseSemanticQuery('');
    expect(result.extractedFilters.itemTypes).toEqual([]);
    expect(result.extractedFilters.certifications).toEqual([]);
    expect(result.extractedFilters.signatureStatuses).toEqual([]);
    expect(result.extractedFilters.provinces).toEqual([]);
    expect(result.remainingTerms).toEqual([]);
  });

  it('handles whitespace only', () => {
    const result = parseSemanticQuery('   ');
    expect(result.extractedFilters.itemTypes).toEqual([]);
    expect(result.remainingTerms).toEqual([]);
  });

  it('handles multiple category terms (combines both)', () => {
    const result = parseSemanticQuery('nihonto tosogu');

    // Should have BOTH nihonto AND tosogu types
    const expectedLength = NIHONTO_TYPES.length + TOSOGU_TYPES.length;
    expect(result.extractedFilters.itemTypes.length).toBe(expectedLength);
  });

  it('handles all three category terms (nihonto tosogu armor)', () => {
    const result = parseSemanticQuery('nihonto tosogu armor');

    // Should have all three categories
    const expectedLength = NIHONTO_TYPES.length + TOSOGU_TYPES.length + ARMOR_TYPES.length;
    expect(result.extractedFilters.itemTypes.length).toBe(expectedLength);
  });

  it('does not duplicate types when category overlaps with specific type', () => {
    // "tosogu" as a category includes 'tosogu' as a type - should not duplicate
    const result = parseSemanticQuery('tosogu');

    const tosogaTypeCount = result.extractedFilters.itemTypes.filter(
      t => t === 'tosogu'
    ).length;
    expect(tosogaTypeCount).toBe(1);
  });

  it('handles category with specific type from same category', () => {
    // User searches "tosogu tsuba" - tsuba is already in tosogu types
    const result = parseSemanticQuery('tosogu tsuba');

    // Should have all tosogu types (tsuba already included, no duplicate)
    expect(result.extractedFilters.itemTypes.length).toBe(TOSOGU_TYPES.length);
    expect(result.remainingTerms).toEqual([]);
  });
});

// =============================================================================
// REGRESSION TESTS
// =============================================================================

describe('Regression Tests', () => {
  it('existing certification extraction still works', () => {
    const result = parseSemanticQuery('tanto juyo');

    expect(result.extractedFilters.itemTypes).toEqual(['tanto']);
    expect(result.extractedFilters.certifications).toEqual(['Juyo']);
  });

  it('existing item type extraction still works', () => {
    const result = parseSemanticQuery('katana wakizashi');

    expect(result.extractedFilters.itemTypes).toContain('katana');
    expect(result.extractedFilters.itemTypes).toContain('wakizashi');
    expect(result.extractedFilters.itemTypes.length).toBe(2);
  });

  it('tokubetsu juyo still extracts correctly', () => {
    const result = parseSemanticQuery('tokubetsu juyo katana');

    expect(result.extractedFilters.certifications).toEqual(['Tokuju']);
    expect(result.extractedFilters.itemTypes).toEqual(['katana']);
  });

  it('fuchi-kashira extracts as single type', () => {
    const result = parseSemanticQuery('fuchi-kashira');

    expect(result.extractedFilters.itemTypes).toEqual(['fuchi-kashira']);
  });

  it('extracts province and passes smith name to text search', () => {
    const result = parseSemanticQuery('bizen masamune');

    expect(result.extractedFilters.provinces).toEqual(['Bizen']);
    expect(result.extractedFilters.itemTypes).toEqual([]);
    expect(result.extractedFilters.certifications).toEqual([]);
    expect(result.remainingTerms).toEqual(['masamune']);
  });

  it('armor search with maker name still works', () => {
    const result = parseSemanticQuery('kabuto saotome');

    expect(result.extractedFilters.itemTypes).toEqual(['kabuto']);
    expect(result.remainingTerms).toEqual(['saotome']);
  });

  it('armor category with certification still works', () => {
    const result = parseSemanticQuery('armor hozon');

    expect(result.extractedFilters.itemTypes.length).toBe(ARMOR_TYPES.length);
    expect(result.extractedFilters.certifications).toEqual(['Hozon']);
    expect(result.remainingTerms).toEqual([]);
  });
});

// =============================================================================
// SIGNATURE STATUS EXTRACTION
// =============================================================================

describe('Signature Status Extraction', () => {
  describe('signed variants', () => {
    it('extracts "signed" as signature filter', () => {
      const result = parseSemanticQuery('katana signed');

      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
      expect(result.extractedFilters.itemTypes).toEqual(['katana']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('extracts "mei" as signed filter', () => {
      const result = parseSemanticQuery('mei tanto');

      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
      expect(result.extractedFilters.itemTypes).toEqual(['tanto']);
    });
  });

  describe('unsigned variants', () => {
    it('extracts "unsigned" as signature filter', () => {
      const result = parseSemanticQuery('unsigned wakizashi');

      expect(result.extractedFilters.signatureStatuses).toEqual(['unsigned']);
      expect(result.extractedFilters.itemTypes).toEqual(['wakizashi']);
    });

    it('extracts "mumei" as unsigned filter', () => {
      const result = parseSemanticQuery('mumei tanto');

      expect(result.extractedFilters.signatureStatuses).toEqual(['unsigned']);
      expect(result.extractedFilters.itemTypes).toEqual(['tanto']);
    });
  });

  describe('combined queries', () => {
    it('handles cert + type + signature: "tokuju tachi signed"', () => {
      const result = parseSemanticQuery('tokuju tachi signed');

      expect(result.extractedFilters.certifications).toEqual(['Tokuju']);
      expect(result.extractedFilters.itemTypes).toEqual(['tachi']);
      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('handles signature with province term', () => {
      const result = parseSemanticQuery('signed bizen');

      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('handles signature with category expansion', () => {
      const result = parseSemanticQuery('mumei nihonto');

      expect(result.extractedFilters.signatureStatuses).toEqual(['unsigned']);
      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
    });
  });

  describe('helper functions', () => {
    it('getSignatureStatusKey returns "signed" for "mei"', () => {
      expect(getSignatureStatusKey('mei')).toBe('signed');
      expect(getSignatureStatusKey('signed')).toBe('signed');
    });

    it('getSignatureStatusKey returns "unsigned" for "mumei"', () => {
      expect(getSignatureStatusKey('mumei')).toBe('unsigned');
      expect(getSignatureStatusKey('unsigned')).toBe('unsigned');
    });

    it('getSignatureStatusKey returns undefined for non-signature terms', () => {
      expect(getSignatureStatusKey('katana')).toBeUndefined();
      expect(getSignatureStatusKey('bizen')).toBeUndefined();
    });

    it('isSemanticTerm returns true for signature terms', () => {
      expect(isSemanticTerm('signed')).toBe(true);
      expect(isSemanticTerm('unsigned')).toBe(true);
      expect(isSemanticTerm('mei')).toBe(true);
      expect(isSemanticTerm('mumei')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase "SIGNED"', () => {
      const result = parseSemanticQuery('SIGNED katana');
      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
    });

    it('handles mixed case "MuMei"', () => {
      const result = parseSemanticQuery('MuMei');
      expect(result.extractedFilters.signatureStatuses).toEqual(['unsigned']);
    });
  });
});

// =============================================================================
// PROVINCE / TRADITION EXTRACTION
// =============================================================================

describe('Province/Tradition Extraction', () => {
  describe('basic extraction', () => {
    it('extracts "soshu" as Soshu province', () => {
      const result = parseSemanticQuery('soshu');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('extracts "sagami" as Soshu province (alias)', () => {
      const result = parseSemanticQuery('sagami');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('extracts "bizen" as Bizen province', () => {
      const result = parseSemanticQuery('bizen');
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('extracts "bishu" as Bizen province (alias)', () => {
      const result = parseSemanticQuery('bishu');
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
    });

    it('extracts "noshu" as Mino province (alias)', () => {
      const result = parseSemanticQuery('noshu');
      expect(result.extractedFilters.provinces).toEqual(['Mino']);
    });

    it('extracts "oshu" as Mutsu province (alias)', () => {
      const result = parseSemanticQuery('oshu');
      expect(result.extractedFilters.provinces).toEqual(['Mutsu']);
    });
  });

  describe('combined queries', () => {
    it('"Soshu Masamune" extracts province + smith name', () => {
      const result = parseSemanticQuery('Soshu Masamune');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
      expect(result.remainingTerms).toEqual(['masamune']);
    });

    it('"Bizen Osafune Kanemitsu" extracts province + smith terms', () => {
      const result = parseSemanticQuery('Bizen Osafune Kanemitsu');
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
      expect(result.remainingTerms).toEqual(['osafune', 'kanemitsu']);
    });

    it('combines province with cert and type: "Soshu tanto juyo"', () => {
      const result = parseSemanticQuery('Soshu tanto juyo');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
      expect(result.extractedFilters.itemTypes).toEqual(['tanto']);
      expect(result.extractedFilters.certifications).toEqual(['Juyo']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('multiple provinces: "Soshu Bizen"', () => {
      const result = parseSemanticQuery('Soshu Bizen');
      expect(result.extractedFilters.provinces).toEqual(['Soshu', 'Bizen']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('province with signature status: "signed yamashiro"', () => {
      const result = parseSemanticQuery('signed yamashiro');
      expect(result.extractedFilters.signatureStatuses).toEqual(['signed']);
      expect(result.extractedFilters.provinces).toEqual(['Yamashiro']);
      expect(result.remainingTerms).toEqual([]);
    });

    it('province with category: "nihonto hizen"', () => {
      const result = parseSemanticQuery('nihonto hizen');
      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.extractedFilters.provinces).toEqual(['Hizen']);
      expect(result.remainingTerms).toEqual([]);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase "SOSHU"', () => {
      const result = parseSemanticQuery('SOSHU');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
    });

    it('handles mixed case "BiZeN"', () => {
      const result = parseSemanticQuery('BiZeN');
      expect(result.extractedFilters.provinces).toEqual(['Bizen']);
    });
  });

  describe('does not duplicate provinces', () => {
    it('sagami and soshu both resolve to Soshu without duplicate', () => {
      const result = parseSemanticQuery('sagami soshu');
      expect(result.extractedFilters.provinces).toEqual(['Soshu']);
    });
  });

  describe('helper functions', () => {
    it('getProvinceKey returns canonical name for province terms', () => {
      expect(getProvinceKey('soshu')).toBe('Soshu');
      expect(getProvinceKey('sagami')).toBe('Soshu');
      expect(getProvinceKey('bizen')).toBe('Bizen');
      expect(getProvinceKey('bishu')).toBe('Bizen');
      expect(getProvinceKey('yamashiro')).toBe('Yamashiro');
    });

    it('getProvinceKey returns undefined for non-province terms', () => {
      expect(getProvinceKey('katana')).toBeUndefined();
      expect(getProvinceKey('masamune')).toBeUndefined();
      expect(getProvinceKey('juyo')).toBeUndefined();
    });
  });
});
