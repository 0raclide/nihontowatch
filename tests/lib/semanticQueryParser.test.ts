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
  NIHONTO_TYPES,
  TOSOGU_TYPES,
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

    it('handles nihonto with smith name', () => {
      const result = parseSemanticQuery('nihonto bizen');

      expect(result.extractedFilters.itemTypes.length).toBe(NIHONTO_TYPES.length);
      expect(result.remainingTerms).toEqual(['bizen']);
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

  it('returns undefined for single item types', () => {
    expect(getCategoryTypes('katana')).toBeUndefined();
    expect(getCategoryTypes('tsuba')).toBeUndefined();
  });

  it('returns undefined for unknown terms', () => {
    expect(getCategoryTypes('unknown')).toBeUndefined();
    expect(getCategoryTypes('bizen')).toBeUndefined();
  });
});

describe('isSemanticTerm', () => {
  it('returns true for category terms', () => {
    expect(isSemanticTerm('nihonto')).toBe(true);
    expect(isSemanticTerm('tosogu')).toBe(true);
    expect(isSemanticTerm('sword')).toBe(true);
    expect(isSemanticTerm('fittings')).toBe(true);
  });

  it('returns true for item types', () => {
    expect(isSemanticTerm('katana')).toBe(true);
    expect(isSemanticTerm('tsuba')).toBe(true);
  });

  it('returns true for certifications', () => {
    expect(isSemanticTerm('juyo')).toBe(true);
    expect(isSemanticTerm('hozon')).toBe(true);
  });

  it('returns false for non-semantic terms', () => {
    expect(isSemanticTerm('bizen')).toBe(false);
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
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty string', () => {
    const result = parseSemanticQuery('');
    expect(result.extractedFilters.itemTypes).toEqual([]);
    expect(result.extractedFilters.certifications).toEqual([]);
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

  it('artisan names pass through to text search', () => {
    const result = parseSemanticQuery('bizen masamune');

    expect(result.extractedFilters.itemTypes).toEqual([]);
    expect(result.extractedFilters.certifications).toEqual([]);
    expect(result.remainingTerms).toEqual(['bizen', 'masamune']);
  });
});
