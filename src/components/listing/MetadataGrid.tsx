'use client';

import type { Listing, ListingWithEnrichment } from '@/types';
import { isBlade, isTosogu, hasVerifiedEnrichment } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

import { containsJapanese } from '@/lib/text/japanese';

// =============================================================================
// HELPERS - Romanization and artisan extraction
// =============================================================================

// Item type prefixes to strip from title_en when extracting artisan name
const ITEM_TYPE_PREFIXES = [
  'Katana:', 'Wakizashi:', 'Tanto:', 'Tachi:', 'Kodachi:',
  'Naginata:', 'Yari:', 'Ken:', 'Daisho:',
  'Tsuba:', 'Fuchi-Kashira:', 'Kozuka:', 'Kogai:', 'Menuki:',
  'Koshirae:', 'Armor:', 'Helmet:',
  // Without colons (some titles use space instead)
  'Katana ', 'Wakizashi ', 'Tanto ', 'Tachi ',
];

/**
 * Extract romanized artisan name from title_en when smith/maker is in Japanese.
 *
 * For example:
 * - title_en: "Katana: Soshu Yukimitsu", school: "Soshu" → returns "Yukimitsu"
 * - title_en: "Wakizashi: Bizen Osafune Sukesada", school: "Osafune" → returns "Sukesada"
 * - title_en: "Tsuba: Nobuie" → returns "Nobuie"
 */
function extractArtisanFromTitleEn(
  titleEn: string | null | undefined,
  school: string | null | undefined
): string | null {
  if (!titleEn) return null;

  let cleaned = titleEn.trim();

  // Remove item type prefix (e.g., "Katana: " or "Katana ")
  for (const prefix of ITEM_TYPE_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  // If we have a romanized school name, try to extract artisan after it
  if (school && !containsJapanese(school)) {
    const schoolLower = school.toLowerCase();
    const cleanedLower = cleaned.toLowerCase();

    // Check if title starts with school name (e.g., "Soshu Yukimitsu")
    if (cleanedLower.startsWith(schoolLower + ' ')) {
      const artisan = cleaned.slice(school.length).trim();
      if (artisan && !containsJapanese(artisan)) {
        return artisan;
      }
    }

    // Check for province + school pattern (e.g., "Bizen Osafune Sukesada")
    // Common provinces that appear in titles
    const provinces = ['Bizen', 'Yamashiro', 'Yamato', 'Sagami', 'Mino', 'Settsu', 'Hizen', 'Satsuma', 'Echizen'];
    for (const province of provinces) {
      const pattern = province.toLowerCase() + ' ' + schoolLower + ' ';
      if (cleanedLower.startsWith(pattern)) {
        const artisan = cleaned.slice(pattern.length - 1).trim(); // -1 to account for trailing space
        if (artisan && !containsJapanese(artisan)) {
          return artisan;
        }
      }
    }
  }

  // If no school or couldn't extract, return the cleaned title if it looks like an artisan name
  // (single word or two words, no Japanese)
  const words = cleaned.split(/\s+/);
  if (words.length <= 3 && !containsJapanese(cleaned)) {
    // Skip if it looks like a full title rather than just a name
    if (!cleaned.includes('(') && !cleaned.includes('NBTHK') && !cleaned.includes('Hozon')) {
      return cleaned;
    }
  }

  return null;
}

// =============================================================================
// TYPES
// =============================================================================

interface MetadataGridProps {
  listing: Listing;
  variant?: 'full' | 'compact';
  className?: string;
  showAttribution?: boolean;
  showMeasurements?: boolean;
  hideArtisan?: boolean; // Hide smith/maker (shown elsewhere)
  hideSchool?: boolean;  // Hide school (shown elsewhere)
}

interface MetadataItemProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  fullWidth?: boolean;
}

// =============================================================================
// CERTIFICATION CONFIG
// =============================================================================

export const CERT_CONFIG: Record<string, { label: string; shortLabel: string; certKey: string; tier: 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon' }> = {
  // Pre-war government designation (highest prestige — orange)
  'Juyo Bijutsuhin': { label: 'Juyo Bijutsuhin', shortLabel: 'Jubi', certKey: 'cert.Juyo Bijutsuhin', tier: 'jubi' },
  JuyoBijutsuhin: { label: 'Juyo Bijutsuhin', shortLabel: 'Jubi', certKey: 'cert.Juyo Bijutsuhin', tier: 'jubi' },
  juyo_bijutsuhin: { label: 'Juyo Bijutsuhin', shortLabel: 'Jubi', certKey: 'cert.Juyo Bijutsuhin', tier: 'jubi' },
  // NBTHK — Tokubetsu Juyo (purple)
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', certKey: 'cert.Tokubetsu Juyo', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', certKey: 'cert.Tokuju', tier: 'tokuju' },
  Tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', certKey: 'cert.Tokuju', tier: 'tokuju' },
  tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'Tokuju', certKey: 'cert.tokuju', tier: 'tokuju' },
  // NBTHK — Juyo (blue)
  Juyo: { label: 'Juyo', shortLabel: 'Jūyō', certKey: 'cert.Juyo', tier: 'juyo' },
  juyo: { label: 'Juyo', shortLabel: 'Jūyō', certKey: 'cert.juyo', tier: 'juyo' },
  'Juyo Tosogu': { label: 'Juyo Tosogu', shortLabel: 'Jūyō', certKey: 'cert.Juyo', tier: 'juyo' },
  // NBTHK — Tokubetsu Hozon (brown)
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', shortLabel: 'Tokuho', certKey: 'cert.Tokubetsu Hozon', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', shortLabel: 'Tokuho', certKey: 'cert.tokubetsu_hozon', tier: 'tokuho' },
  TokuHozon: { label: 'Tokubetsu Hozon', shortLabel: 'Tokuho', certKey: 'cert.TokuHozon', tier: 'tokuho' },
  'Tokubetsu Hozon Tosogu': { label: 'Toku Hozon Tosogu', shortLabel: 'Tokuho', certKey: 'cert.TokuHozon', tier: 'tokuho' },
  // NBTHK — Hozon (olive)
  Hozon: { label: 'Hozon', shortLabel: 'Hozon', certKey: 'cert.Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', shortLabel: 'Hozon', certKey: 'cert.hozon', tier: 'hozon' },
  'Hozon Tosogu': { label: 'Hozon Tosogu', shortLabel: 'Hozon', certKey: 'cert.Hozon', tier: 'hozon' },
  'NTHK Kanteisho': { label: 'NTHK', shortLabel: 'NTHK', certKey: 'cert.NTHK', tier: 'hozon' },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Strip school prefix from artisan name to avoid duplication when displayed as "School Artisan".
 * E.g., school="Rai", artisan="Rai Kunitoshi" → artisan="Kunitoshi"
 */
function stripSchoolPrefix(artisan: string | null, school: string | null): string | null {
  if (!artisan || !school) return artisan;
  // If artisan is just the school name, hide artisan (school already shown separately)
  if (artisan.toLowerCase() === school.toLowerCase()) return null;
  // Strip "School " prefix from "School Artisan" to avoid "School School Artisan"
  if (artisan.toLowerCase().startsWith(school.toLowerCase() + ' ')) {
    return artisan.slice(school.length).trim() || artisan;
  }
  return artisan;
}

export function getArtisanInfo(listing: Listing | ListingWithEnrichment, locale: string = 'en'): {
  artisan: string | null;
  school: string | null;
  artisanLabel: string;
  era: string | null;
  isEnriched: boolean;
} {
  // Check for enriched Yuhinkai data (manual connections only)
  const listingWithEnrichment = listing as ListingWithEnrichment;
  if (hasVerifiedEnrichment(listingWithEnrichment)) {
    const enrichment = listingWithEnrichment.yuhinkai_enrichment!;
    const school = enrichment.enriched_school || null;
    const artisan = stripSchoolPrefix(enrichment.enriched_maker || null, school);
    return {
      artisan,
      school,
      artisanLabel: isTosogu(listing.item_type) ? 'Maker' : 'Smith',
      era: enrichment.enriched_period || listing.era || null,
      isEnriched: true,
    };
  }

  // Fall back to raw listing data
  if (isTosogu(listing.item_type)) {
    const rawMaker = listing.tosogu_maker;
    const school = listing.tosogu_school;

    // JA locale: show original Japanese names directly
    // For EN-source listings (international dealers), smith/maker may be romaji —
    // prefer artisan_name_kanji from Yuhinkai enrichment to avoid mixed-script display
    if (locale === 'ja') {
      if (rawMaker && !containsJapanese(rawMaker) && listing.artisan_name_kanji) {
        return {
          artisan: listing.artisan_name_kanji,
          school: null, // kanji name already includes school
          artisanLabel: 'Maker',
          era: listing.era || null,
          isEnriched: false,
        };
      }
      return {
        artisan: stripSchoolPrefix(rawMaker || null, school || null),
        school: school || null,
        artisanLabel: 'Maker',
        era: listing.era || null,
        isEnriched: false,
      };
    }

    // EN locale: If maker is in Japanese, try to extract romanized name from title_en
    let artisan: string | null = null;
    if (rawMaker && containsJapanese(rawMaker)) {
      artisan = extractArtisanFromTitleEn(listing.title_en, school);
    } else {
      artisan = rawMaker || null;
    }

    const displaySchool = school && !containsJapanese(school) ? school : null;
    return {
      artisan: stripSchoolPrefix(artisan, displaySchool),
      school: displaySchool,
      artisanLabel: 'Maker',
      era: listing.era || null,
      isEnriched: false,
    };
  }

  const rawSmith = listing.smith;
  const school = listing.school;

  // JA locale: show original Japanese names directly
  // For EN-source listings (international dealers), smith may be romaji —
  // prefer artisan_name_kanji from Yuhinkai enrichment to avoid mixed-script display
  if (locale === 'ja') {
    if (rawSmith && !containsJapanese(rawSmith) && listing.artisan_name_kanji) {
      return {
        artisan: listing.artisan_name_kanji,
        school: null, // kanji name already includes school
        artisanLabel: 'Smith',
        era: listing.era || null,
        isEnriched: false,
      };
    }
    return {
      artisan: stripSchoolPrefix(rawSmith || null, school || null),
      school: school || null,
      artisanLabel: 'Smith',
      era: listing.era || null,
      isEnriched: false,
    };
  }

  // EN locale: If smith is in Japanese, try to extract romanized name from title_en
  let artisan: string | null = null;
  if (rawSmith && containsJapanese(rawSmith)) {
    artisan = extractArtisanFromTitleEn(listing.title_en, school);
  } else {
    artisan = rawSmith || null;
  }

  const displaySchool = school && !containsJapanese(school) ? school : null;
  return {
    artisan: stripSchoolPrefix(artisan, displaySchool),
    school: displaySchool,
    artisanLabel: 'Smith',
    era: listing.era || null,
    isEnriched: false,
  };
}

export function getCertInfo(certType: string | undefined): {
  label: string;
  shortLabel: string;
  certKey: string;
  tier: 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon';
} | null {
  if (!certType) return null;
  return CERT_CONFIG[certType] || null;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetadataItem({ label, value, unit, fullWidth }: MetadataItemProps) {
  if (value === null || value === undefined) return null;

  const displayValue = unit ? `${value}${unit}` : value;

  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
        {label}
      </span>
      <p className="text-[13px] text-ink">{displayValue}</p>
    </div>
  );
}

function MeasurementItem({ label, value, unit }: { label: string; value: number | string | null | undefined; unit: string }) {
  if (!value && value !== 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-ink tabular-nums font-medium">{value}{unit}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MetadataGrid({
  listing,
  variant = 'full',
  className = '',
  showAttribution = true,
  showMeasurements = true,
  hideArtisan = false,
  hideSchool = false,
}: MetadataGridProps) {
  const { t, locale } = useLocale();
  const td = (cat: string, v: string | null | undefined) => {
    if (!v) return v;
    // Strip parenthetical suffixes like "(1185-1333)" for period/era lookups
    const base = v.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const k = `${cat}.${base}`;
    const r = t(k);
    return r === k ? v : r;
  };
  const { artisan, school, artisanLabel, era, isEnriched } = getArtisanInfo(listing, locale);
  const certInfo = getCertInfo(listing.cert_type);
  const itemIsBlade = isBlade(listing.item_type);
  const itemIsTosogu = isTosogu(listing.item_type);

  // Check for available measurements
  // Note: nakago_cm, height_cm, width_cm, thickness_mm, material don't exist in DB yet
  const hasSwordMeasurements = itemIsBlade && (
    listing.nagasa_cm || listing.sori_cm || listing.motohaba_cm ||
    listing.sakihaba_cm || listing.kasane_cm || listing.weight_g
  );
  // Tosogu measurements not yet available in database
  const hasMeasurements = hasSwordMeasurements;

  // Check for attribution data (excluding hidden fields)
  const displayArtisan = !hideArtisan && artisan;
  const displaySchool = !hideSchool && school;
  const hasAttribution = displayArtisan || displaySchool || era || listing.province || listing.mei_type || certInfo;

  if (variant === 'compact') {
    // Compact variant: single row of key measurements
    return (
      <div className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
        {itemIsBlade && listing.nagasa_cm && (
          <MeasurementItem label={t('metadata.nagasa')} value={listing.nagasa_cm} unit="cm" />
        )}
        {/* Tosogu compact measurements - columns not yet in database */}
      </div>
    );
  }

  // Full variant: complete metadata grid
  return (
    <div className={className}>
      {/* Attribution Section */}
      {showAttribution && hasAttribution && (
        <div className="border-b border-border">
          <div className="px-4 py-3 lg:px-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* School + Smith combined (e.g., "Rai Kunimitsu" or "Osafune Tomomitsu") */}
              {(displayArtisan || displaySchool) && (
                <div className="col-span-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
                    {artisanLabel === 'Smith' ? t('metadata.smith') : t('metadata.maker')}
                  </span>
                  <p className="text-[14px] text-ink font-medium">
                    {displaySchool && td('school', school)}
                    {displaySchool && displayArtisan && ' '}
                    {displayArtisan && artisan}
                  </p>
                </div>
              )}

              <MetadataItem label={t('metadata.era')} value={td('period', era)} />
              <MetadataItem label={t('metadata.province')} value={td('province', listing.province)} />
              <MetadataItem label={t('metadata.signature')} value={td('meiType', listing.mei_type)} />

              {/* Certification with session */}
              {certInfo && (
                <div className="col-span-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
                    {t('metadata.papers')}
                  </span>
                  <p className="text-[13px] text-ink">
                    {t(certInfo.certKey)}
                    {listing.cert_session && <span className="text-muted"> #{listing.cert_session}</span>}
                    {listing.cert_organization && <span className="text-muted"> ({listing.cert_organization})</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Measurements Section */}
      {showMeasurements && hasMeasurements && (
        <div className="border-b border-border">
          <div className="px-4 py-3 lg:px-5">
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2 font-medium">
              {itemIsTosogu ? t('metadata.specifications') : t('metadata.measurements')}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {/* Sword measurements */}
              {itemIsBlade && (
                <>
                  <MeasurementItem label={t('metadata.nagasa')} value={listing.nagasa_cm} unit="cm" />
                  <MeasurementItem label={t('metadata.sori')} value={listing.sori_cm} unit="cm" />
                  <MeasurementItem label={t('metadata.motohaba')} value={listing.motohaba_cm} unit="cm" />
                  <MeasurementItem label={t('metadata.sakihaba')} value={listing.sakihaba_cm} unit="cm" />
                  <MeasurementItem label={t('metadata.kasane')} value={listing.kasane_cm} unit="cm" />
                  <MeasurementItem label={t('metadata.weight')} value={listing.weight_g} unit="g" />
                </>
              )}

              {/* Tosogu measurements - columns not yet in database */}
              {/* TODO: Add when height_cm, width_cm, thickness_mm, material columns exist */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetadataGrid;
