// Japanese Sword Terminology Glossary
// Loads comprehensive glossary from data file

import glossaryData from '@/data/glossary.json';
import type { GlossaryEntry, GlossaryCategory, GlossaryData } from './types';

// Type assertion for the imported JSON
const data = glossaryData as GlossaryData;

// Build lookup dictionary from JSON data
const glossary: Record<string, GlossaryEntry> = {};

for (const item of data.terms) {
  const key = item.romaji.toLowerCase();
  const entry: GlossaryEntry = {
    term: item.romaji.charAt(0).toUpperCase() + item.romaji.slice(1),
    romaji: item.romaji,
    kanji: item.kanji,
    definition: item.definition,
    category: item.category as GlossaryCategory,
  };

  glossary[key] = entry;

  // Also add without hyphens for easier matching
  const keyNoHyphen = key.replace(/-/g, '');
  if (keyNoHyphen !== key) {
    glossary[keyNoHyphen] = entry;
  }

  // Add with spaces instead of hyphens
  const keyWithSpaces = key.replace(/-/g, ' ');
  if (keyWithSpaces !== key) {
    glossary[keyWithSpaces] = entry;
  }
}

/**
 * Find a term in the glossary (case-insensitive)
 * Handles macrons, hyphens, and various input formats
 */
export function findTerm(term: string): GlossaryEntry | undefined {
  // Normalize the term
  const normalized = term
    .toLowerCase()
    .trim()
    .replace(/[ōū]/g, (c) => {
      const map: Record<string, string> = { ō: 'o', ū: 'u' };
      return map[c] || c;
    });

  // Try direct match
  if (glossary[normalized]) {
    return glossary[normalized];
  }

  // Try without hyphens
  const noHyphen = normalized.replace(/-/g, '');
  if (glossary[noHyphen]) {
    return glossary[noHyphen];
  }

  // Try with hyphens replaced by spaces
  const withSpaces = normalized.replace(/-/g, ' ');
  if (glossary[withSpaces]) {
    return glossary[withSpaces];
  }

  return undefined;
}

/**
 * Get all terms for a specific category
 */
export function getTermsByCategory(category: GlossaryCategory): GlossaryEntry[] {
  // Use Set to avoid duplicates from alias entries
  const seen = new Set<string>();
  return Object.values(glossary).filter((entry) => {
    if (entry.category !== category) return false;
    const key = entry.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get all unique glossary entries (avoiding duplicates from aliases)
 */
export function getAllTerms(): GlossaryEntry[] {
  const seen = new Set<string>();
  return Object.values(glossary).filter((entry) => {
    const key = entry.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get total term count from metadata
 */
export function getTermCount(): number {
  return data._metadata.total_terms;
}

/**
 * Get category descriptions from metadata
 */
export function getCategories(): Record<string, string> {
  return data.categories;
}

/**
 * Get glossary metadata
 */
export function getMetadata() {
  return data._metadata;
}

// Re-export types
export type { GlossaryEntry, GlossaryCategory } from './types';
export { CATEGORY_LABELS } from './types';
