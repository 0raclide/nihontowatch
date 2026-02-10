/**
 * Maps specific Japanese nengō (era names) to broad historical periods.
 *
 * The Yuhinkai database stores eras as strings like "Ōei (1394-1428)".
 * This utility parses the start year and maps to ~9 broad periods for
 * the artist directory filter dropdown.
 */

export interface BroadPeriod {
  name: string;
  startYear: number;
  endYear: number;
}

export const BROAD_PERIODS: BroadPeriod[] = [
  { name: 'Heian', startYear: 0, endYear: 1185 },
  { name: 'Kamakura', startYear: 1185, endYear: 1333 },
  { name: 'Nanbokucho', startYear: 1333, endYear: 1392 },
  { name: 'Muromachi', startYear: 1392, endYear: 1573 },
  { name: 'Momoyama', startYear: 1573, endYear: 1603 },
  { name: 'Edo', startYear: 1603, endYear: 1868 },
  { name: 'Meiji', startYear: 1868, endYear: 1912 },
  { name: 'Taishō', startYear: 1912, endYear: 1926 },
  { name: 'Shōwa', startYear: 1926, endYear: 1989 },
];

/** Order index for chronological sorting */
export const PERIOD_ORDER: Record<string, number> = Object.fromEntries(
  BROAD_PERIODS.map((p, i) => [p.name, i])
);

/**
 * String-based fallbacks for era names that don't contain a parseable year range.
 * Matches case-insensitively against the era string.
 */
const STRING_FALLBACKS: Array<{ pattern: RegExp; period: string }> = [
  { pattern: /\bheian\b/i, period: 'Heian' },
  { pattern: /\bkamakura\b/i, period: 'Kamakura' },
  { pattern: /\bnanboku/i, period: 'Nanbokucho' },
  { pattern: /\bmuromachi\b/i, period: 'Muromachi' },
  { pattern: /\bmomoyama\b/i, period: 'Momoyama' },
  { pattern: /\bedo\b/i, period: 'Edo' },
  { pattern: /\bmeiji\b/i, period: 'Meiji' },
  { pattern: /\btaish[oō]\b/i, period: 'Taishō' },
  { pattern: /\bsh[oō]wa\b/i, period: 'Shōwa' },
  // Composite era labels used in Yuhinkai
  { pattern: /\bkoto\b/i, period: 'Heian' },
  { pattern: /\bshinto\b/i, period: 'Momoyama' },
  { pattern: /\bshinshinto\b/i, period: 'Edo' },
  { pattern: /\bgendai\b/i, period: 'Shōwa' },
];

/**
 * Parse the start year from an era string like "Ōei (1394-1428)".
 * Returns null if no year range found.
 */
function parseStartYear(era: string): number | null {
  const match = era.match(/\((\d{3,4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Map a specific era string to its broad historical period name.
 * Returns null if the era can't be mapped.
 */
export function eraToBroadPeriod(era: string | null | undefined): string | null {
  if (!era) return null;

  // Try parsing a year first
  const year = parseStartYear(era);
  if (year !== null) {
    for (const period of BROAD_PERIODS) {
      if (year >= period.startYear && year < period.endYear) {
        return period.name;
      }
    }
    // Year >= 1989 (post-Shōwa) — map to Shōwa as the latest bucket
    if (year >= 1989) return 'Shōwa';
  }

  // Fall back to string matching
  for (const { pattern, period } of STRING_FALLBACKS) {
    if (pattern.test(era)) return period;
  }

  return null;
}
