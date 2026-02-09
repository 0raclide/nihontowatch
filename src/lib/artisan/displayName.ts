/**
 * Artisan display-name deduplication.
 *
 * The Yuhinkai database stores `school` and `name_romaji` separately.
 * Naïvely concatenating them produces duplicates like "Goto Gotō" or
 * "Hizen Tadayoshi Tadahiro".  This module merges them intelligently.
 */

// ---------------------------------------------------------------------------
// Macron normalisation
// ---------------------------------------------------------------------------

const MACRON_MAP: Record<string, string> = {
  'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
  'Ā': 'a', 'Ē': 'e', 'Ī': 'i', 'Ō': 'o', 'Ū': 'u',
};

/** Lowercase + strip macrons so "Gotō" and "Goto" compare equal. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[āēīōūĀĒĪŌŪ]/g, ch => MACRON_MAP[ch] || ch);
}

// ---------------------------------------------------------------------------
// Geographic prefixes (provinces / cities found in multi-word school names)
// ---------------------------------------------------------------------------

const GEO_PREFIXES = new Set([
  // Major sword provinces
  'aki', 'awa', 'bingo', 'bitchu', 'bizen', 'bungo', 'buzen', 'chikugo',
  'chikuzen', 'echigo', 'echizen', 'etchu', 'harima', 'higo', 'hitachi',
  'hizen', 'hoki', 'hyuga', 'iga', 'inaba', 'ise', 'iwami', 'iyo',
  'izumi', 'izumo', 'kaga', 'kai', 'kawachi', 'kazusa', 'kii', 'kozuke',
  'mikawa', 'mino', 'musashi', 'mutsu', 'nagato', 'noto', 'omi', 'osumi',
  'owari', 'rikuzen', 'sagami', 'sanuki', 'satsuma', 'settsu', 'shimosa',
  'shimotsuke', 'shinano', 'suou', 'suruga', 'tajima', 'tamba', 'tango',
  'tosa', 'totomi', 'ugo', 'uzen', 'wakasa', 'yamashiro', 'yamato',
  // Cities commonly prefixed in school names
  'osaka', 'kyoto', 'edo', 'kamakura', 'nara', 'sakai',
]);

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

export interface DisplayParts {
  /** Text to show before the name (may be null if redundant). */
  prefix: string | null;
  /** The artisan's personal name. */
  name: string;
}

/**
 * Derive non-redundant display parts for an artisan.
 *
 * Rules (applied in order):
 * 1. Exact match (macron-normalised) → no prefix
 * 2. Name starts with school → no prefix (school already in name)
 * 3. School ends with name → prefix is the leading portion of school
 * 4. Lineage overlap → last word of school shares 4+ char prefix with name → school as display
 * 5. Geographic prefix stripping → first word of school is province/city → strip it
 * 6. Default → school as prefix
 */
export function getArtisanDisplayParts(
  nameRomaji: string | null,
  school: string | null,
): DisplayParts {
  const name = nameRomaji || '';
  if (!school || !name) return { prefix: school || null, name };

  const sNorm = norm(school);
  const nNorm = norm(name);

  // Rule 1: exact match
  if (sNorm === nNorm) {
    return { prefix: null, name };
  }

  // Rule 2: name already starts with school (e.g. school="Gotō", name="Gotō Renjō")
  if (nNorm.startsWith(sNorm + ' ') || nNorm.startsWith(sNorm)) {
    // Only suppress if the normalized school is a whole-word prefix of name
    const afterSchool = nNorm.slice(sNorm.length);
    if (afterSchool === '' || afterSchool.startsWith(' ')) {
      return { prefix: null, name };
    }
  }

  // Rule 3: school ends with name (e.g. school="Hizen Tadayoshi", name="Tadayoshi")
  if (sNorm.endsWith(' ' + nNorm)) {
    const prefixPart = school.slice(0, -(name.length + 1)).trim();
    return { prefix: prefixPart || null, name: school };
  }

  // Rule 4: lineage overlap — last word of school shares 4+ char root with first word of name
  const schoolWords = school.split(' ');
  if (schoolWords.length >= 1) {
    const lastSchoolWord = norm(schoolWords[schoolWords.length - 1]);
    const firstNameWord = norm(name.split(' ')[0]);
    if (
      lastSchoolWord.length >= 5 &&
      firstNameWord.length >= 4 &&
      lastSchoolWord.slice(0, 4) === firstNameWord.slice(0, 4)
    ) {
      return { prefix: null, name: school };
    }
  }

  // Rule 5: geographic prefix stripping
  if (schoolWords.length >= 2) {
    const firstWord = norm(schoolWords[0]);
    if (GEO_PREFIXES.has(firstWord)) {
      const stripped = schoolWords.slice(1).join(' ');
      return { prefix: stripped, name };
    }
  }

  // Rule 6: default
  return { prefix: school, name };
}

/**
 * Convenience: return a single display string (prefix + name).
 * For rendering with separate styling, use `getArtisanDisplayParts` directly.
 */
export function getArtisanDisplayName(
  nameRomaji: string | null,
  school: string | null,
): string {
  const { prefix, name } = getArtisanDisplayParts(nameRomaji, school);
  return prefix ? `${prefix} ${name}` : name;
}
