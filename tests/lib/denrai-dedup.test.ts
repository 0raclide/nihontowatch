import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing yuhinkai (module-level createClient call)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

import { dedupWithinItem } from '@/lib/supabase/yuhinkai';

type CanonicalMap = Map<string, { parent: string | null; category: string | null }>;

function makeMap(entries: Array<[string, { parent: string | null; category: string | null }]>): CanonicalMap {
  return new Map(entries);
}

describe('dedupWithinItem', () => {
  // ─── Rule 1: Remove generic parent when any child exists ───

  it('removes generic parent when a child is present', () => {
    const canonicalMap = makeMap([
      ['Tokugawa Family', { parent: null, category: 'family' }],
      ['Shogun Ienobu', { parent: 'Tokugawa Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(['Tokugawa Family', 'Shogun Ienobu'], canonicalMap);

    expect(result).toEqual(['Shogun Ienobu']);
  });

  it('keeps parent when it appears alone (no children)', () => {
    const canonicalMap = makeMap([
      ['Tokugawa Family', { parent: null, category: 'family' }],
    ]);

    const result = dedupWithinItem(['Tokugawa Family'], canonicalMap);

    expect(result).toEqual(['Tokugawa Family']);
  });

  // ─── Rule 2: Person trumps family within same group ───

  it('removes family entry when person exists in same group (MIT281 case)', () => {
    const canonicalMap = makeMap([
      ['Kaninomiya Family', { parent: 'Imperial Family', category: 'family' }],
      ["Prince Kan'in Haruhito", { parent: 'Imperial Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(['Kaninomiya Family', "Prince Kan'in Haruhito"], canonicalMap);

    expect(result).toEqual(["Prince Kan'in Haruhito"]);
  });

  it('removes family when parent + family + person all coexist', () => {
    const canonicalMap = makeMap([
      ['Imperial Family', { parent: null, category: 'family' }],
      ['Kaninomiya Family', { parent: 'Imperial Family', category: 'family' }],
      ["Prince Kan'in Haruhito", { parent: 'Imperial Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(
      ['Imperial Family', 'Kaninomiya Family', "Prince Kan'in Haruhito"],
      canonicalMap,
    );

    // Rule 1: "Imperial Family" removed (it's the parent and children exist)
    // Rule 2: "Kaninomiya Family" removed (family, person exists in group)
    // Only person remains
    expect(result).toEqual(["Prince Kan'in Haruhito"]);
  });

  // ─── Rule 3: Keep all persons (different people in same family) ───

  it('keeps multiple persons from the same family', () => {
    const canonicalMap = makeMap([
      ['Tokugawa Ieyasu', { parent: 'Tokugawa Family', category: 'person' }],
      ['Tokugawa Iesato', { parent: 'Tokugawa Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(['Tokugawa Ieyasu', 'Tokugawa Iesato'], canonicalMap);

    expect(result).toHaveLength(2);
    expect(result).toContain('Tokugawa Ieyasu');
    expect(result).toContain('Tokugawa Iesato');
  });

  it('keeps multiple persons but removes family in same group', () => {
    const canonicalMap = makeMap([
      ['Tokugawa Family', { parent: null, category: 'family' }],
      ['Tokugawa Ieyasu', { parent: 'Tokugawa Family', category: 'person' }],
      ['Tokugawa Hidetada', { parent: 'Tokugawa Family', category: 'person' }],
      ['Kishu Tokugawa Family', { parent: 'Tokugawa Family', category: 'family' }],
    ]);

    const result = dedupWithinItem(
      ['Tokugawa Family', 'Tokugawa Ieyasu', 'Tokugawa Hidetada', 'Kishu Tokugawa Family'],
      canonicalMap,
    );

    // Rule 1: "Tokugawa Family" removed (parent with children)
    // Rule 2: "Kishu Tokugawa Family" removed (family, persons exist)
    expect(result).toHaveLength(2);
    expect(result).toContain('Tokugawa Ieyasu');
    expect(result).toContain('Tokugawa Hidetada');
  });

  // ─── Rule 4: Preserve institutions, shrines, uncategorized ───

  it('preserves institution entries', () => {
    const canonicalMap = makeMap([
      ['Sano Art Museum', { parent: null, category: 'institution' }],
    ]);

    const result = dedupWithinItem(['Sano Art Museum'], canonicalMap);

    expect(result).toEqual(['Sano Art Museum']);
  });

  it('preserves institution alongside persons in different groups', () => {
    const canonicalMap = makeMap([
      ['Sano Art Museum', { parent: null, category: 'institution' }],
      ['Tokugawa Ieyasu', { parent: 'Tokugawa Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(['Sano Art Museum', 'Tokugawa Ieyasu'], canonicalMap);

    expect(result).toHaveLength(2);
    expect(result).toContain('Sano Art Museum');
    expect(result).toContain('Tokugawa Ieyasu');
  });

  // ─── Edge cases ───

  it('handles owners not in canonical map (no parent, no category)', () => {
    const canonicalMap: CanonicalMap = new Map();

    const result = dedupWithinItem(['Unknown Owner', 'Another Owner'], canonicalMap);

    // Each unknown owner becomes its own group — all preserved
    expect(result).toHaveLength(2);
    expect(result).toContain('Unknown Owner');
    expect(result).toContain('Another Owner');
  });

  it('handles empty owner list', () => {
    const canonicalMap: CanonicalMap = new Map();

    const result = dedupWithinItem([], canonicalMap);

    expect(result).toEqual([]);
  });

  it('handles single owner', () => {
    const canonicalMap = makeMap([
      ['Emperor Meiji', { parent: 'Imperial Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(['Emperor Meiji'], canonicalMap);

    expect(result).toEqual(['Emperor Meiji']);
  });

  it('does not remove family when no person exists in the group', () => {
    const canonicalMap = makeMap([
      ['Maeda Family', { parent: null, category: 'family' }],
      ['Kaga Maeda Family', { parent: 'Maeda Family', category: 'family' }],
    ]);

    const result = dedupWithinItem(['Maeda Family', 'Kaga Maeda Family'], canonicalMap);

    // Rule 1: "Maeda Family" removed (parent with child)
    // Rule 2: No person exists, so family stays
    expect(result).toEqual(['Kaga Maeda Family']);
  });

  it('handles mixed groups independently', () => {
    const canonicalMap = makeMap([
      // Imperial group: person + family
      ['Imperial Family', { parent: null, category: 'family' }],
      ['Emperor Meiji', { parent: 'Imperial Family', category: 'person' }],
      // Tokugawa group: family only (child, no person)
      ['Kishu Tokugawa Family', { parent: 'Tokugawa Family', category: 'family' }],
      // Standalone institution
      ['Sano Art Museum', { parent: null, category: 'institution' }],
    ]);

    const result = dedupWithinItem(
      ['Imperial Family', 'Emperor Meiji', 'Kishu Tokugawa Family', 'Sano Art Museum'],
      canonicalMap,
    );

    // Imperial: parent removed (rule 1), only person remains
    // Tokugawa: only child, no person → family kept
    // Sano: standalone institution kept
    expect(result).toHaveLength(3);
    expect(result).toContain('Emperor Meiji');
    expect(result).toContain('Kishu Tokugawa Family');
    expect(result).toContain('Sano Art Museum');
  });

  it('handles owner with parent but null category', () => {
    const canonicalMap = makeMap([
      ['Some Family', { parent: null, category: null }],
      ['Some Person', { parent: 'Some Family', category: null }],
    ]);

    const result = dedupWithinItem(['Some Family', 'Some Person'], canonicalMap);

    // Rule 1: parent removed because child exists
    // Rule 2: no person/family categories → no further filtering
    expect(result).toEqual(['Some Person']);
  });

  it('handles nested parent that is also a child of another group', () => {
    const canonicalMap = makeMap([
      ['Tokugawa Family', { parent: null, category: 'family' }],
      ['Owari Tokugawa Family', { parent: 'Tokugawa Family', category: 'family' }],
      ['Tokugawa Ieyasu', { parent: 'Tokugawa Family', category: 'person' }],
    ]);

    const result = dedupWithinItem(
      ['Tokugawa Family', 'Owari Tokugawa Family', 'Tokugawa Ieyasu'],
      canonicalMap,
    );

    // Rule 1: "Tokugawa Family" removed (parent with children)
    // Rule 2: "Owari Tokugawa Family" (family) removed because person exists
    expect(result).toEqual(['Tokugawa Ieyasu']);
  });
});
