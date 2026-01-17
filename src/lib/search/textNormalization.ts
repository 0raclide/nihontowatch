/**
 * Text normalization utilities for Japanese romanization and search
 * Adapted from Oshi-v2 for Nihontowatch search functionality
 */

// =============================================================================
// MACRON HANDLING
// =============================================================================

/**
 * Macron mapping for Japanese romanization
 * Converts long vowel marks to standard ASCII
 */
const MACRON_MAP: Record<string, string> = {
  'ā': 'a', 'Ā': 'A',
  'ē': 'e', 'Ē': 'E',
  'ī': 'i', 'Ī': 'I',
  'ō': 'o', 'Ō': 'O',
  'ū': 'u', 'Ū': 'U',
};

/**
 * Remove macrons from romanized Japanese text.
 * Converts characters like ō → o, ū → u for search matching.
 *
 * @example
 * removeMacrons('Gotō') // → 'Goto'
 * removeMacrons('Tōkyō') // → 'Tokyo'
 */
export function removeMacrons(str: string): string {
  if (!str) return '';
  return str.replace(/[āĀēĒīĪōŌūŪ]/g, char => MACRON_MAP[char] || char);
}

// =============================================================================
// KANJI VARIANTS
// =============================================================================

/**
 * Kanji variant mapping: simplified (shinjitai) → traditional (kyujitai)
 * The database uses traditional forms, so we map user input to match.
 * Common variants found in Japanese sword smith/maker names.
 */
const KANJI_VARIANTS: Record<string, string> = {
  '国': '國', // kuni - extremely common in smith names
  '広': '廣', // hiro - Kunihiro, Hiroyuki, etc.
  '竜': '龍', // ryū/tatsu - dragon
  '沢': '澤', // sawa - swamp
  '辺': '邊', // be/hen - edge
  '桜': '櫻', // sakura - cherry
  '円': '圓', // en - circle
  '剣': '劍', // ken - sword
  '鉄': '鐵', // tetsu - iron
  '真': '眞', // ma/shin - true
  '斎': '齋', // sai - purification
  '関': '關', // kan - barrier
  '万': '萬', // man - ten thousand
  '芸': '藝', // gei - art
  '学': '學', // gaku - study
  '栄': '榮', // ei - prosperity
  '応': '應', // ō - respond
  '仏': '佛', // butsu - Buddha
  '変': '變', // hen - change
  '弁': '辯', // ben - eloquence (also 辨, 瓣)
  '宝': '寶', // hō/takara - treasure
  '実': '實', // jitsu/mi - truth/fruit
  '写': '寫', // sha - copy
  '当': '當', // tō - hit/this
  '帰': '歸', // ki - return
  '旧': '舊', // kyū - old
  '権': '權', // ken/gon - authority
  '歳': '歲', // sai - year/age
  '浜': '濱', // hama - beach
  '画': '畫', // ga - picture
  '県': '縣', // ken - prefecture
  '経': '經', // kei/kyō - sutra
  '継': '繼', // kei - inherit
  '総': '總', // sō - general
  '聴': '聽', // chō - listen
  '脳': '腦', // nō - brain
  '蔵': '藏', // zō/kura - storehouse
  '覚': '覺', // kaku - perceive
  '観': '觀', // kan - view
  '訳': '譯', // yaku - translate
  '読': '讀', // doku/yomu - read
  '豊': '豐', // hō/yutaka - abundant
  '辞': '辭', // ji - resign/word
  '転': '轉', // ten - revolve
  '遅': '遲', // chi - late
  '鋭': '銳', // ei - sharp
  '闘': '鬪', // tō - fight
  '駅': '驛', // eki - station
  '験': '驗', // ken - test
  '黒': '黑', // koku/kuro - black
};

/**
 * Expand a search string to include traditional kanji variants.
 * Returns the original string with simplified kanji replaced by traditional forms.
 * Use this when searching against a database that uses traditional kanji.
 */
export function toTraditionalKanji(str: string): string {
  if (!str) return '';
  let result = str;
  for (const [simplified, traditional] of Object.entries(KANJI_VARIANTS)) {
    result = result.replaceAll(simplified, traditional);
  }
  return result;
}

/**
 * Check if a string contains any kanji that have variant forms.
 */
export function hasKanjiVariants(str: string): boolean {
  if (!str) return false;
  return Object.keys(KANJI_VARIANTS).some(char => str.includes(char));
}

// =============================================================================
// SEARCH ALIASES
// =============================================================================

/**
 * Search term aliases for common abbreviations and variants.
 * Maps user-friendly short forms to canonical database values.
 */
const SEARCH_ALIASES: Record<string, string[]> = {
  // Certification abbreviations
  'tokuju': ['tokubetsu juyo', 'tokubetsu_juyo'],
  'tokuho': ['tokubetsu hozon', 'tokubetsu_hozon'],
  'tokukicho': ['tokubetsu kicho', 'tokubetsu_kicho'],

  // Item type abbreviations
  'waki': ['wakizashi'],
  'nagi': ['naginata'],
  'fuchikashira': ['fuchi_kashira', 'fuchi-kashira', 'fuchi kashira'],

  // Common romanization variants
  'tuba': ['tsuba'],
  'tanto': ['tantou', 'tantō'],
  'katana': ['katana'],
};

/**
 * Expand a search word to include aliases.
 * Returns the original word plus any matching alias expansions.
 *
 * @example
 * expandSearchAliases('tokuju') // → ['tokuju', 'tokubetsu juyo', 'tokubetsu_juyo']
 * expandSearchAliases('katana') // → ['katana']
 */
export function expandSearchAliases(word: string): string[] {
  const normalized = word.toLowerCase().trim();
  const aliases = SEARCH_ALIASES[normalized];
  if (aliases) {
    return [normalized, ...aliases];
  }
  return [normalized];
}

// =============================================================================
// SEARCH NORMALIZATION
// =============================================================================

/**
 * Characters that have special meaning in PostgreSQL full-text search
 */
const FTS_SPECIAL_CHARS = /[&|!():<>*]/g;

/**
 * Normalize text for search: lowercase + remove diacritics + trim
 * Handles macrons, extra whitespace, and common variations.
 *
 * @example
 * normalizeSearchText('  Gotō Katana  ') // → 'goto katana'
 * normalizeSearchText('WAKIZASHI') // → 'wakizashi'
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';

  return text
    // Remove macrons first
    .replace(/[āĀēĒīĪōŌūŪ]/g, char => MACRON_MAP[char] || char)
    // Convert to lowercase
    .toLowerCase()
    // Normalize unicode (decompose and remove combining marks for diacritics)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalize to NFC for consistent comparison
    .normalize('NFC')
    // Collapse multiple whitespace to single space
    .replace(/\s+/g, ' ')
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Escape special characters for PostgreSQL full-text search
 */
function escapeFtsSpecialChars(str: string): string {
  return str.replace(FTS_SPECIAL_CHARS, ' ');
}

/**
 * Prepare a search query for PostgreSQL full-text search.
 * - Normalizes text (lowercase, remove diacritics)
 * - Splits into terms (minimum 2 characters)
 * - Adds :* for prefix matching
 * - Joins with & for AND logic
 * - Escapes special characters
 *
 * @example
 * prepareSearchQuery('katana goto') // → 'katana:* & goto:*'
 * prepareSearchQuery('Tōkyō blade') // → 'tokyo:* & blade:*'
 * prepareSearchQuery('a b cd') // → 'cd:*' (single chars filtered)
 */
export function prepareSearchQuery(query: string): string {
  if (!query) return '';

  // Normalize the search text
  const normalized = normalizeSearchText(query);

  // Escape special FTS characters
  const escaped = escapeFtsSpecialChars(normalized);

  // Split into terms and filter short ones
  const terms = escaped
    .split(/\s+/)
    .filter(term => term.length >= 2);

  if (terms.length === 0) return '';

  // Add prefix matching and join with AND
  return terms
    .map(term => `${term}:*`)
    .join(' & ');
}

/**
 * Generate search variants for a query to improve matching.
 * Returns an array of normalized search strings including:
 * - Original (normalized)
 * - With traditional kanji variants
 *
 * @example
 * getSearchVariants('国') // → ['国', '國']
 */
export function getSearchVariants(query: string): string[] {
  if (!query) return [];

  const normalized = normalizeSearchText(query);
  const variants = new Set<string>([normalized]);

  // Add traditional kanji variant if applicable
  if (hasKanjiVariants(query)) {
    variants.add(normalizeSearchText(toTraditionalKanji(query)));
  }

  return Array.from(variants);
}
