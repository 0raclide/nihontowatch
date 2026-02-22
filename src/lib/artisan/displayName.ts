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
export function norm(s: string): string {
  return s.toLowerCase().replace(/[āēīōūĀĒĪŌŪ]/g, ch => MACRON_MAP[ch] || ch);
}

// ---------------------------------------------------------------------------
// Geographic prefixes (provinces / cities found in multi-word school names)
// ---------------------------------------------------------------------------

const GEO_PREFIXES = new Set([
  // Major sword provinces (all romanisation variants)
  'aki', 'awa', 'bingo', 'bitchu', 'bizen', 'bungo', 'buzen', 'chikugo',
  'chikuzen', 'dewa', 'echigo', 'echizen', 'etchu', 'harima', 'higo',
  'hitachi', 'hizen', 'hoki', 'hyuga', 'iga', 'inaba', 'ise', 'iwami',
  'iyo', 'izumi', 'izumo', 'kaga', 'kai', 'kawachi', 'kazusa', 'kii',
  'kozuke', 'mikawa', 'mimasaka', 'mino', 'musashi', 'mutsu', 'nagato',
  'noto', 'omi', 'osumi', 'owari', 'rikuzen', 'sagami', 'sanuki',
  'satsuma', 'settsu', 'shimosa', 'shimotsuke', 'shinano', 'suo', 'suou',
  'suruga', 'tajima', 'tamba', 'tanba', 'tango', 'tosa', 'totomi',
  'ugo', 'uzen', 'wakasa', 'yamashiro', 'yamato',
  // Cities commonly prefixed in school names
  'osaka', 'kyoto', 'edo', 'kamakura', 'nara', 'sakai',
]);

/** Words that should not stand alone as a prefix after geo-stripping. */
const GENERIC_WORDS = new Set(['province', 'school', 'group', 'branch', 'style']);

// ---------------------------------------------------------------------------
// Artisan aliases — common names that differ from the Yuhinkai name_romaji
// ---------------------------------------------------------------------------

const ARTISAN_ALIASES: Record<string, string> = {
  'KAN1670': 'Kencho',              // Osafune Kanenaga, commonly known as "Kencho Kanenaga"
  'KUN539': 'Shintogo Kunimitsu',   // Soshu Kunimitsu, commonly known as "Shintogo Kunimitsu"
  'KUN636': 'Saburo Kunimune',      // Naomune Kunimune, commonly known as "Saburo Kunimune"
  'GOT042': 'Goto Ichijo',          // Waki-Goto Goto Ichijo, commonly known as just "Goto Ichijo"
  'OWA009': 'Nobuie',               // Owari Nobuie, universally known as just "Nobuie"
};

/** Return the well-known alias for an artisan, or null if none. */
export function getArtisanAlias(code: string): string | null {
  return ARTISAN_ALIASES[code] || null;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

export interface DisplayParts {
  /** Text to show before the name (may be null if redundant). */
  prefix: string | null;
  /** The artisan's personal name. */
  name: string;
}

/** Split school into tokens on spaces, hyphens, and "/" */
function schoolTokens(school: string): string[] {
  return school.split(/[\s/]+/).filter(Boolean);
}

/**
 * Derive non-redundant display parts for an artisan.
 *
 * Rules (applied in order):
 * 1. Exact match (macron-normalised) → no prefix
 * 2. Name starts with school → no prefix (school already in name)
 * 2b. School starts with name (whole word) → show school only
 * 3. School ends with name (space or hyphen) → show school only
 * 3b. Name appears as a token in school → show school only
 * 3c. School appears as a token in name → show name only
 * 4. School ends with name exactly (normalised) → show school only
 * 5. Geographic prefix stripping → first word is province/city → strip it
 *    (but only if remainder is meaningful, not just "Province")
 * 6. Default → school as prefix
 */
export function getArtisanDisplayParts(
  nameRomaji: string | null,
  school: string | null,
): DisplayParts {
  const name = nameRomaji || '';
  if (!school || !name) return { prefix: school || null, name };

  // Schools with "/" separator (e.g., "Natsuo / Tokyo Fine Arts") indicate
  // founder name / institutional alias.  Using these as display prefixes
  // produces misleading results:
  //   "Natsuo / Tokyo Fine Arts Shomin"  (Rule 6 — school prepended to student)
  //   "Natsuo / Tokyo Fine Arts"          (Rule 2b — replaces founder's own name)
  // Just display the artisan's own name.
  if (school.includes('/')) {
    return { prefix: null, name };
  }

  const sNorm = norm(school);
  const nNorm = norm(name);

  // Rule 1: exact match
  if (sNorm === nNorm) {
    return { prefix: null, name };
  }

  // Rule 2: name already starts with school (e.g. school="Gotō", name="Gotō Renjō")
  if (nNorm.startsWith(sNorm)) {
    const afterSchool = nNorm.slice(sNorm.length);
    if (afterSchool === '' || afterSchool.startsWith(' ')) {
      return { prefix: null, name };
    }
  }

  // Rule 2b: school starts with name as a whole word (e.g. school="Oishi Sa", name="Oishi")
  if (sNorm.startsWith(nNorm)) {
    const afterName = sNorm.slice(nNorm.length);
    if (afterName === '' || afterName.startsWith(' ')) {
      return { prefix: null, name: school };
    }
  }

  // Rule 3: school ends with name (e.g. school="Hizen Tadayoshi", name="Tadayoshi"
  // or school="Sue-Naminohira", name="Naminohira")
  if (sNorm.endsWith(' ' + nNorm) || sNorm.endsWith('-' + nNorm)) {
    return { prefix: null, name: school };
  }

  // Rule 3b: name appears as a token in school
  // e.g. school="Bizen Osafune", name="Osafune"
  const sTokens = schoolTokens(school).map(norm);
  if (sTokens.includes(nNorm)) {
    return { prefix: null, name: school };
  }

  // Rule 3c: school appears as a token in name (reverse of 3b)
  // e.g. school="Ichijō", name="Gotō Ichijō"
  const nTokens = name.split(/[\s-]+/).map(norm);
  if (nTokens.includes(sNorm)) {
    return { prefix: null, name };
  }

  // Rule 4: lineage substitution — multi-word school where the last word
  // shares a 4+ char root with the artisan's name (same lineage, different person).
  // Strip the lineage founder's name, keep the school/province prefix.
  // e.g. "Horikawa Kunihiro" + "Kunitomo" → "Horikawa Kunitomo"
  //      "Hizen Tadayoshi"   + "Tadahiro" → "Hizen Tadahiro"
  const schoolWords = school.split(' ');
  if (schoolWords.length >= 2) {
    const lastSchoolWord = norm(schoolWords[schoolWords.length - 1]);
    const firstNameWord = norm(name.split(' ')[0]);
    if (
      lastSchoolWord.length >= 5 &&
      firstNameWord.length >= 4 &&
      lastSchoolWord.slice(0, 4) === firstNameWord.slice(0, 4)
    ) {
      const lineagePrefix = schoolWords.slice(0, -1).join(' ');
      return { prefix: lineagePrefix, name };
    }
  }

  // Rule 5: geographic prefix stripping
  if (schoolWords.length >= 2) {
    const firstWord = norm(schoolWords[0]);
    if (GEO_PREFIXES.has(firstWord)) {
      const stripped = schoolWords.slice(1).join(' ');
      const strippedNorm = norm(stripped);
      // Don't strip if the remainder is just a generic word like "Province"
      if (!GENERIC_WORDS.has(strippedNorm)) {
        return { prefix: stripped, name };
      }
      // "Aki Province" → just show name with no prefix (province shown elsewhere)
      return { prefix: null, name };
    }
  }

  // Rule 6: default
  return { prefix: school, name };
}

/**
 * Convenience: return a single display string (prefix + name).
 * For rendering with separate styling, use `getArtisanDisplayParts` directly.
 *
 * When `code` starts with "NS-" the entity is a school, not an individual
 * maker, so we append " School" (e.g. "Gotō School") unless the base name
 * already contains the word.
 */
export function getArtisanDisplayName(
  nameRomaji: string | null,
  school: string | null,
  code?: string | null,
): string {
  const { prefix, name } = getArtisanDisplayParts(nameRomaji, school);
  const base = prefix ? `${prefix} ${name}` : name;
  if (code?.startsWith('NS-') && base && !norm(base).includes('school')) {
    return `${base} School`;
  }
  return base;
}

/**
 * Kanji display name for Japanese locale.
 * Much simpler than romaji — kanji names are already compact and don't need
 * the school-prefix deduplication logic.
 *
 * NS-* school codes: append "派" (school) suffix, e.g. "後藤派"
 * Individual makers: return name_kanji as-is
 */
export function getArtisanDisplayNameKanji(
  nameKanji: string | null,
  code?: string | null,
): string | null {
  if (!nameKanji) return null;
  if (code?.startsWith('NS-') && !nameKanji.endsWith('派')) {
    return `${nameKanji}派`;
  }
  return nameKanji;
}
