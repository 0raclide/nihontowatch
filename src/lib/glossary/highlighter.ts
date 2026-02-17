// Text highlighting engine for glossary terms
// Efficiently finds and highlights Japanese sword terminology in text

import { getAllTerms, findTerm, type GlossaryEntry } from './index';

export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'term'; content: string; entry: GlossaryEntry };

// Cache for the compiled regex
let cachedMatcher: RegExp | null = null;

/**
 * Check if a character is a Unicode letter (handles macrons, accents, etc.)
 * Uses Unicode property escapes for proper letter detection
 */
function isUnicodeLetter(char: string | undefined): boolean {
  if (!char) return false;
  // Match any Unicode letter (Latin, Japanese, etc.)
  return /\p{L}/u.test(char);
}

/**
 * Check if a match is at a valid word boundary
 * Handles Unicode characters that JavaScript's \b doesn't recognize
 * e.g., prevents "ken" from matching inside "Tōken" (ō is Unicode)
 */
function isAtWordBoundary(text: string, start: number, end: number): boolean {
  const charBefore = text[start - 1];
  const charAfter = text[end];

  // Check if surrounded by letters (not a word boundary)
  const letterBefore = isUnicodeLetter(charBefore);
  const letterAfter = isUnicodeLetter(charAfter);

  // Valid if NOT preceded by a letter AND NOT followed by a letter
  // (i.e., at least one side is a word boundary)
  return !letterBefore && !letterAfter;
}

/**
 * Build a regex pattern that matches all glossary terms
 * Terms are sorted by length (longest first) to handle overlapping matches
 * e.g., "ko-itame" matches before "itame"
 */
export function buildTermMatcher(): RegExp {
  if (cachedMatcher) {
    return cachedMatcher;
  }

  const terms = getAllTerms();

  // Get all romaji terms and sort by length (longest first)
  const termPatterns = terms
    .map((t) => t.romaji)
    .sort((a, b) => b.length - a.length)
    .map((term) => {
      // Escape special regex characters and handle hyphen variants
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match with or without hyphens, case insensitive
      // e.g., "ko-itame" also matches "ko itame" or "koitame"
      const flexible = escaped.replace(/-/g, '[- ]?');
      // Match macron variants: o↔ō, u↔ū
      const withMacrons = flexible
        .replace(/o/gi, '[oō]')
        .replace(/u/gi, '[uū]');
      return withMacrons;
    });

  // Build regex WITHOUT word boundaries - we'll check boundaries manually
  // to properly handle Unicode characters like ō, ū, etc.
  cachedMatcher = new RegExp(`(${termPatterns.join('|')})`, 'gi');
  return cachedMatcher;
}

interface MatchInfo {
  start: number;
  end: number;
  match: string;
  entry: GlossaryEntry;
}

/**
 * Find all term matches in text with their positions
 * Returns non-overlapping matches sorted by position
 */
export function findTermMatches(text: string): MatchInfo[] {
  const matcher = buildTermMatcher();
  const matches: MatchInfo[] = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];

  // Reset regex state
  matcher.lastIndex = 0;

  let match;
  while ((match = matcher.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check Unicode-aware word boundaries
    // This prevents "ken" from matching inside "Tōken" (ō is a Unicode letter)
    if (!isAtWordBoundary(text, start, end)) {
      continue;
    }

    // Check if this range overlaps with any existing match
    const overlaps = occupiedRanges.some(
      (range) => start < range.end && end > range.start
    );

    if (!overlaps) {
      // Normalize the matched term to find its glossary entry
      const entry = findTerm(match[0]);
      if (entry) {
        matches.push({
          start,
          end,
          match: match[0],
          entry,
        });
        occupiedRanges.push({ start, end });
      }
    }
  }

  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Segment text into plain text and matched terms
 * Returns an array of segments that can be rendered with highlighting
 */
export function segmentText(text: string): TextSegment[] {
  if (!text) {
    return [];
  }

  const matches = findTermMatches(text);

  if (matches.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before this match
    if (match.start > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.start),
      });
    }

    // Add the matched term
    segments.push({
      type: 'term',
      content: match.match,
      entry: match.entry,
    });

    lastIndex = match.end;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Check if text contains any glossary terms
 * Useful for conditional rendering optimization
 */
export function hasGlossaryTerms(text: string): boolean {
  if (!text) return false;
  const matcher = buildTermMatcher();
  matcher.lastIndex = 0;
  return matcher.test(text);
}
