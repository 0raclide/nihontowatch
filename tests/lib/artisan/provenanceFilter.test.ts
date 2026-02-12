import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing yuhinkai
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

/**
 * Tests for the non-provenance filter fix in getDenraiForArtisan().
 *
 * Bug: Entries with category === 'non_provenance' (narrative fragments,
 * publication references, cert-date entries) were passing through the
 * Phase 3 filter and being counted as Named Collectors (score 2).
 *
 * Fix: Added `if (info?.category === 'non_provenance') continue;`
 * in the Phase 3 loop before adding to ownerMap.
 *
 * These tests verify the filtering logic in isolation by importing
 * dedupWithinItem and simulating the Phase 3 loop.
 */

import { dedupWithinItem } from '@/lib/supabase/yuhinkai';

type CanonicalMap = Map<string, { parent: string | null; category: string | null }>;

// Simulate Phase 3 logic: dedup within item, then filter non-provenance
function simulatePhase3Filter(
  rows: Array<{ gold_denrai_owners: string[] }>,
  canonicalMap: CanonicalMap
): Map<string, number> {
  const ownerMap = new Map<string, number>();

  for (const row of rows) {
    const owners = row.gold_denrai_owners;
    if (!owners || !Array.isArray(owners)) continue;

    const seen = new Set<string>();
    const uniqueOwners: string[] = [];
    for (const owner of owners) {
      const trimmed = owner.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        uniqueOwners.push(trimmed);
      }
    }

    const deduped = dedupWithinItem(uniqueOwners, canonicalMap);

    // This is the fix: skip non_provenance entries
    for (const owner of deduped) {
      const info = canonicalMap.get(owner);
      if (info?.category === 'non_provenance') continue;
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    }
  }

  return ownerMap;
}

describe('Non-provenance filter (Phase 3)', () => {
  it('filters out entries with category "non_provenance"', () => {
    const canonicalMap: CanonicalMap = new Map([
      ['Tokugawa Family', { parent: null, category: 'family' }],
      ['Sword Was Badly Bent', { parent: null, category: 'non_provenance' }],
    ]);

    const rows = [
      { gold_denrai_owners: ['Tokugawa Family', 'Sword Was Badly Bent'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.has('Tokugawa Family')).toBe(true);
    expect(result.has('Sword Was Badly Bent')).toBe(false);
  });

  it('keeps entries with null category (unknown owners)', () => {
    const canonicalMap: CanonicalMap = new Map();

    const rows = [
      { gold_denrai_owners: ['Unknown Owner'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.has('Unknown Owner')).toBe(true);
    expect(result.get('Unknown Owner')).toBe(1);
  });

  it('keeps entries with non-"non_provenance" categories', () => {
    const canonicalMap: CanonicalMap = new Map([
      ['Maeda Family', { parent: null, category: 'family' }],
      ['Seikado Bunko', { parent: null, category: 'institution' }],
      ['Kasuga Taisha', { parent: null, category: 'shrine' }],
      ['Emperor Meiji', { parent: 'Imperial Family', category: 'person' }],
    ]);

    const rows = [
      { gold_denrai_owners: ['Maeda Family', 'Seikado Bunko', 'Kasuga Taisha', 'Emperor Meiji'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.size).toBe(4);
    expect(result.has('Maeda Family')).toBe(true);
    expect(result.has('Seikado Bunko')).toBe(true);
    expect(result.has('Kasuga Taisha')).toBe(true);
    expect(result.has('Emperor Meiji')).toBe(true);
  });

  it('filters multiple non_provenance entries from same item', () => {
    const canonicalMap: CanonicalMap = new Map([
      ['Tokugawa Family', { parent: null, category: 'family' }],
      ['Listed In Publication', { parent: null, category: 'non_provenance' }],
      ['Certified 1962', { parent: null, category: 'non_provenance' }],
      ['Previously Known As Meibutsu', { parent: null, category: 'non_provenance' }],
    ]);

    const rows = [
      { gold_denrai_owners: ['Tokugawa Family', 'Listed In Publication', 'Certified 1962', 'Previously Known As Meibutsu'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.size).toBe(1);
    expect(result.has('Tokugawa Family')).toBe(true);
  });

  it('correctly counts across multiple items after filtering', () => {
    const canonicalMap: CanonicalMap = new Map([
      ['Maeda Family', { parent: null, category: 'family' }],
      ['Noise Entry', { parent: null, category: 'non_provenance' }],
    ]);

    const rows = [
      { gold_denrai_owners: ['Maeda Family', 'Noise Entry'] },
      { gold_denrai_owners: ['Maeda Family', 'Noise Entry'] },
      { gold_denrai_owners: ['Maeda Family'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.get('Maeda Family')).toBe(3);
    expect(result.has('Noise Entry')).toBe(false);
  });

  it('returns empty map when all owners are non_provenance', () => {
    const canonicalMap: CanonicalMap = new Map([
      ['Noise A', { parent: null, category: 'non_provenance' }],
      ['Noise B', { parent: null, category: 'non_provenance' }],
    ]);

    const rows = [
      { gold_denrai_owners: ['Noise A', 'Noise B'] },
    ];

    const result = simulatePhase3Filter(rows, canonicalMap);

    expect(result.size).toBe(0);
  });

  it('handles empty owner arrays', () => {
    const canonicalMap: CanonicalMap = new Map();
    const rows = [{ gold_denrai_owners: [] }];
    const result = simulatePhase3Filter(rows, canonicalMap);
    expect(result.size).toBe(0);
  });

  it('handles whitespace-only owners', () => {
    const canonicalMap: CanonicalMap = new Map();
    const rows = [{ gold_denrai_owners: ['  ', '', ' '] }];
    const result = simulatePhase3Filter(rows, canonicalMap);
    expect(result.size).toBe(0);
  });
});
