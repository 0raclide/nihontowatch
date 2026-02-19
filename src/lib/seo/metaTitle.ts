/**
 * SEO Metadata Builders for Listing Detail Pages
 *
 * Structured, keyword-optimized titles and descriptions built from
 * rich listing fields (certification, artisan, type, school, era, province).
 * Matches collector search patterns like "Juyo Masamune Katana".
 */

import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if string contains Japanese characters (hiragana, katakana, kanji) */
function containsJapanese(str: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);
}

/** Normalize cert_type to a short, human-friendly label */
function formatCert(certType: string | null | undefined): string | null {
  if (!certType) return null;
  const raw = certType.trim();

  // Already short enough or well-known abbreviation
  const map: Record<string, string> = {
    juyo: 'Juyo',
    'tokubetsu juyo': 'Tokubetsu Juyo',
    hozon: 'Hozon',
    'tokubetsu hozon': 'Tokubetsu Hozon',
    'juyo bijutsuhin': 'Juyo Bijutsuhin',
    'juyo bunkazai': 'Juyo Bunkazai',
    koshu_tokubetsu_kicho: 'Koshu Tokubetsu Kicho',
    kicho: 'Kicho',
    'tokubetsu kicho': 'Tokubetsu Kicho',
  };

  const lower = raw.toLowerCase();
  if (map[lower]) return map[lower];

  // If it's already short and capitalized, use as-is
  if (raw.length <= 25 && !containsJapanese(raw)) return raw;

  return null;
}

/** Normalize item_type to a display label */
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  kodachi: 'Kodachi',
  naginata: 'Naginata',
  'naginata naoshi': 'Naginata-Naoshi',
  yari: 'Yari',
  ken: 'Ken',
  daisho: 'Daisho',
  tsuba: 'Tsuba',
  menuki: 'Menuki',
  kozuka: 'Kozuka',
  kogai: 'Kogai',
  fuchi: 'Fuchi',
  kashira: 'Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  'fuchi-kashira': 'Fuchi-Kashira',
  futatokoro: 'Futatokoro',
  mitokoromono: 'Mitokoromono',
  tosogu: 'Tosogu',
  armor: 'Armor',
  helmet: 'Helmet',
  koshirae: 'Koshirae',
  stand: 'Stand',
  book: 'Book',
  other: 'Other',
  unknown: 'Unknown',
};

function getTypeLabel(itemType: string | null | undefined): string | null {
  if (!itemType) return null;
  return ITEM_TYPE_LABELS[itemType.toLowerCase()] || null;
}

// Tosogu item types (fittings — use material/school as qualifier instead of province/era)
const TOSOGU_TYPES = new Set([
  'tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira',
  'fuchi_kashira', 'fuchi-kashira', 'futatokoro', 'mitokoromono', 'tosogu',
]);

function isTosogu(itemType: string | null | undefined): boolean {
  if (!itemType) return false;
  return TOSOGU_TYPES.has(itemType.toLowerCase());
}

// ---------------------------------------------------------------------------
// Item type prefixes to strip from title_en when extracting artisan name
// ---------------------------------------------------------------------------

const ITEM_TYPE_PREFIXES = [
  'Katana:', 'Wakizashi:', 'Tanto:', 'Tachi:', 'Kodachi:',
  'Naginata:', 'Yari:', 'Ken:', 'Daisho:',
  'Tsuba:', 'Fuchi-Kashira:', 'Kozuka:', 'Kogai:', 'Menuki:',
  'Koshirae:', 'Armor:', 'Helmet:',
  'Katana ', 'Wakizashi ', 'Tanto ', 'Tachi ',
];

// ---------------------------------------------------------------------------
// Artisan Name Resolution
// ---------------------------------------------------------------------------

export interface SeoFields {
  title: string;
  title_en?: string | null;
  item_type?: string | null;
  cert_type?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  school?: string | null;
  tosogu_school?: string | null;
  era?: string | null;
  tosogu_era?: string | null;
  province?: string | null;
  tosogu_material?: string | null;
  nagasa_cm?: number | null;
  mei_type?: string | null;
  price_value?: number | null;
  price_currency?: string | null;
  is_sold?: boolean;
  is_available?: boolean;
  dealer_name?: string | null;
}

/**
 * Resolve a romanized artisan name for SEO titles.
 * Fallback chain:
 *   1. smith / tosogu_maker (if already romanized)
 *   2. Extract from title_en (strip item type prefix, apply school pattern)
 *   3. school / tosogu_school (if romanized — matches queries like "Juyo Ichimonji")
 *   4. null
 */
export function resolveArtisanNameForSeo(fields: SeoFields): string | null {
  // 1. Direct smith / maker — only if romanized
  const directName = getAttributionName(fields);
  if (directName && !containsJapanese(directName)) {
    return directName;
  }

  // 2. Extract from title_en
  const school = getAttributionSchool(fields);
  const extracted = extractArtisanFromTitleEn(fields.title_en, school);
  if (extracted) return extracted;

  // 3. Fall back to school name (if romanized)
  if (school && !containsJapanese(school)) {
    return school;
  }

  return null;
}

/**
 * Extract romanized artisan name from title_en.
 * Adapted from ListingCard.tsx logic.
 */
function extractArtisanFromTitleEn(
  titleEn: string | null | undefined,
  school: string | null | undefined
): string | null {
  if (!titleEn) return null;

  let cleaned = titleEn.trim();

  // Remove item type prefix
  for (const prefix of ITEM_TYPE_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  // If we have a romanized school name, extract artisan after it
  if (school && !containsJapanese(school)) {
    const schoolLower = school.toLowerCase();
    const cleanedLower = cleaned.toLowerCase();

    if (cleanedLower.startsWith(schoolLower + ' ')) {
      const artisan = cleaned.slice(school.length).trim();
      if (artisan && !containsJapanese(artisan)) {
        return artisan;
      }
    }

    // Province + school pattern (e.g., "Bizen Osafune Sukesada")
    const provinces = ['Bizen', 'Yamashiro', 'Yamato', 'Sagami', 'Mino', 'Settsu', 'Hizen', 'Satsuma', 'Echizen'];
    for (const province of provinces) {
      const pattern = province.toLowerCase() + ' ' + schoolLower + ' ';
      if (cleanedLower.startsWith(pattern)) {
        const artisan = cleaned.slice(pattern.length - 1).trim();
        if (artisan && !containsJapanese(artisan)) {
          return artisan;
        }
      }
    }
  }

  // Fallback: return cleaned title if it looks like just an artisan name
  const words = cleaned.split(/\s+/);
  if (words.length <= 3 && !containsJapanese(cleaned)) {
    if (!cleaned.includes('(') && !cleaned.includes('NBTHK') && !cleaned.includes('Hozon')) {
      return cleaned;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Title Builder
// ---------------------------------------------------------------------------

const SUFFIX = ' | NihontoWatch';
const MAX_TITLE_LEN = 60;

/**
 * Build a structured, keyword-optimized page title.
 *
 * Pattern: {Cert} {Artisan} {Type} — {Qualifier} | NihontoWatch
 *
 * Examples:
 *   "Juyo Masamune Katana — Soshu, Kamakura | NihontoWatch"
 *   "Tokubetsu Hozon Ishiguro Masatsune Tsuba — Shakudo | NihontoWatch"
 *   "Katana — Bizen, Muromachi | NihontoWatch"
 */
export function buildSeoTitle(fields: SeoFields): string {
  const cert = formatCert(fields.cert_type);
  const artisan = resolveArtisanNameForSeo(fields);
  const typeLabel = getTypeLabel(fields.item_type);

  // Build core segment: {Cert} {Artisan} {Type}
  const coreParts: string[] = [];
  if (cert) coreParts.push(cert);
  if (artisan) coreParts.push(artisan);
  if (typeLabel) coreParts.push(typeLabel);

  let core = coreParts.join(' ');

  // If we have nothing useful, fall back to raw title + type
  if (!core) {
    const fallbackTitle = fields.title_en || fields.title;
    if (typeLabel) {
      core = `${fallbackTitle} — ${typeLabel}`;
    } else {
      core = fallbackTitle;
    }
    return truncateTitle(core);
  }

  // Build qualifier segment (after em-dash)
  const qualifier = buildQualifier(fields, artisan);

  if (qualifier) {
    const full = `${core} — ${qualifier}${SUFFIX}`;
    if (full.length <= MAX_TITLE_LEN) return full;

    // Try without qualifier if too long
    const withoutQualifier = `${core}${SUFFIX}`;
    if (withoutQualifier.length <= MAX_TITLE_LEN) return withoutQualifier;

    return truncateTitle(core);
  }

  const full = `${core}${SUFFIX}`;
  if (full.length <= MAX_TITLE_LEN) return full;

  return truncateTitle(core);
}

/** Build the qualifier segment after the em-dash */
function buildQualifier(fields: SeoFields, artisanUsed: string | null): string | null {
  if (isTosogu(fields.item_type)) {
    // Tosogu: prefer material, then school (if not already used as artisan)
    if (fields.tosogu_material && !containsJapanese(fields.tosogu_material)) {
      return fields.tosogu_material;
    }
    const school = getAttributionSchool(fields);
    if (school && !containsJapanese(school) && school !== artisanUsed) {
      return school;
    }
    return null;
  }

  // Swords: {Province}, {Era} (tosogu_era as fallback for era)
  const era = fields.era || fields.tosogu_era;
  const parts: string[] = [];
  if (fields.province && !containsJapanese(fields.province)) {
    parts.push(fields.province);
  }
  if (era && !containsJapanese(era)) {
    parts.push(era);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Truncate to fit within MAX_TITLE_LEN including suffix */
function truncateTitle(core: string): string {
  const maxCore = MAX_TITLE_LEN - SUFFIX.length;
  if (core.length <= maxCore) return core + SUFFIX;
  return core.slice(0, maxCore - 1).trimEnd() + '…' + SUFFIX;
}

// ---------------------------------------------------------------------------
// Description Builder
// ---------------------------------------------------------------------------

/**
 * Build a structured meta description for SEO.
 *
 * Available: "{Cert} {Artisan} {Type} for sale. {Price}. {Specs}. {Context}. Available from {Dealer} on NihontoWatch."
 * Sold:      "{Cert} {Artisan} {Type} — sold. Was {Price}. {Specs}. Previously listed by {Dealer} on NihontoWatch."
 */
export function buildSeoDescription(fields: SeoFields): string {
  const cert = formatCert(fields.cert_type);
  const artisan = resolveArtisanNameForSeo(fields);
  const typeLabel = getTypeLabel(fields.item_type);
  const isSold = fields.is_sold || !fields.is_available;
  const dealerName = fields.dealer_name || 'Unknown Dealer';

  // Build subject line: "{Cert} {Artisan} {Type}"
  const subjectParts: string[] = [];
  if (cert) subjectParts.push(cert);
  if (artisan) subjectParts.push(artisan);
  if (typeLabel) subjectParts.push(typeLabel);

  let subject = subjectParts.join(' ');
  if (!subject) {
    subject = fields.title_en || fields.title;
  }

  // Price
  const price = formatDescPrice(fields.price_value, fields.price_currency);

  // Specs (nagasa for swords)
  const specs = fields.nagasa_cm ? `Nagasa ${fields.nagasa_cm}cm` : null;

  // Context: era + province (use tosogu_era as fallback)
  const era = fields.era || fields.tosogu_era;
  const contextParts: string[] = [];
  if (era && !containsJapanese(era)) {
    contextParts.push(`${era} period`);
  }
  if (fields.province && !containsJapanese(fields.province)) {
    contextParts.push(`${fields.province} province`);
  }
  const context = contextParts.length > 0 ? contextParts.join(', ') : null;

  // Assemble
  const segments: string[] = [];

  if (isSold) {
    segments.push(`${subject} — sold.`);
    if (price) segments.push(`Was ${price}.`);
  } else {
    segments.push(`${subject} for sale.`);
    if (price) segments.push(`${price}.`);
  }

  if (specs) segments.push(`${specs}.`);
  if (context) segments.push(`${context}.`);

  if (isSold) {
    segments.push(`Previously listed by ${dealerName} on NihontoWatch.`);
  } else {
    segments.push(`Available from ${dealerName} on NihontoWatch.`);
  }

  let desc = segments.join(' ');

  // Google typically truncates at ~155 chars
  if (desc.length > 160) {
    // Drop context first, then specs
    const trimmed: string[] = [];
    if (isSold) {
      trimmed.push(`${subject} — sold.`);
      if (price) trimmed.push(`Was ${price}.`);
    } else {
      trimmed.push(`${subject} for sale.`);
      if (price) trimmed.push(`${price}.`);
    }
    if (isSold) {
      trimmed.push(`Previously listed by ${dealerName} on NihontoWatch.`);
    } else {
      trimmed.push(`Available from ${dealerName} on NihontoWatch.`);
    }
    desc = trimmed.join(' ');
  }

  return desc;
}

function formatDescPrice(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (!value) return null;
  const curr = currency || 'JPY';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
}
