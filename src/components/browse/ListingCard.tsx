'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { SetsumeiZufuBadge } from '@/components/ui/SetsumeiZufuBadge';
import { ArtisanTooltip } from '@/components/artisan/ArtisanTooltip';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useViewportTrackingOptional } from '@/lib/viewport';
import { getAllImages, getCachedValidation, isRenderFailed, setRenderFailed, dealerDoesNotPublishImages, getPlaceholderKanji } from '@/lib/images';
import { shouldShowNewBadge } from '@/lib/newListing';
import { isTrialModeActive } from '@/types/subscription';
import { isSetsumeiEligibleCert } from '@/types';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { useLocale } from '@/i18n/LocaleContext';
import { formatRelativeTime } from '@/lib/time';

// 7 days in milliseconds - matches the data delay for free tier
const EARLY_ACCESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if a listing is within the "early access" window (7 days)
 * This means free tier users can't see this listing yet
 */
function isEarlyAccessListing(firstSeenAt: string): boolean {
  const listingDate = new Date(firstSeenAt).getTime();
  const cutoff = Date.now() - EARLY_ACCESS_WINDOW_MS;
  return listingDate > cutoff;
}

interface SoldData {
  sale_date: string | null;
  days_on_market: number | null;
  days_on_market_display: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}

// Yuhinkai enrichment data from browse API (subset for badge display)
interface YuhinkaiEnrichmentBadge {
  setsumei_en: string | null;
  match_confidence: string | null;
  connection_source: string | null;
  verification_status: string | null;
}

interface Listing {
  id: string;
  url: string;
  title: string | null;
  title_en?: string | null; // English translation of title
  title_ja?: string | null; // Japanese translation of title (for EN-source listings)
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
  era?: string | null;
  last_scraped_at?: string | null;
  images: string[] | null;
  stored_images?: string[] | null;
  first_seen_at: string;
  is_initial_import?: boolean | null; // DB column: TRUE = bulk import, FALSE = genuine new
  dealer_earliest_seen_at?: string | null; // Earliest listing from this dealer (for baseline check)
  status: string;
  is_available: boolean;
  is_sold: boolean;
  sold_data?: SoldData | null; // Sold item data with confidence
  setsumei_text_en?: string | null; // OCR-extracted NBTHK evaluation translation
  // Yuhinkai enrichment from browse API (array from view, we use first if present)
  listing_yuhinkai_enrichment?: YuhinkaiEnrichmentBadge[];
  // Or single enrichment object (from QuickView context after optimistic update)
  yuhinkai_enrichment?: YuhinkaiEnrichmentBadge | null;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
  // Artisan matching (admin-only display)
  artisan_id?: string | null;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  artisan_display_name?: string | null;
  artisan_name_kanji?: string | null;
  artisan_method?: string | null;
  artisan_candidates?: Array<{
    artisan_id: string;
    name_kanji?: string;
    name_romaji?: string;
    school?: string;
    generation?: string;
    is_school_code?: boolean;
    retrieval_method?: string;
    retrieval_score?: number;
  }> | null;
  artisan_verified?: 'correct' | 'incorrect' | null;
  admin_hidden?: boolean;
  status_admin_locked?: boolean;
  focal_x?: number | null;
  focal_y?: number | null;
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

interface ListingCardProps {
  listing: Listing;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
  priority?: boolean; // For above-the-fold images
  showFavoriteButton?: boolean;
  searchId?: string; // Correlation ID for CTR tracking
  isAdmin?: boolean; // For admin-only features like artisan code display
  mobileView?: 'grid' | 'gallery'; // Mobile layout mode (only affects < sm breakpoint)
  fontSize?: 'compact' | 'standard' | 'large'; // Font size preference (both views)
  imageAspect?: string; // Override image aspect ratio (default: 'aspect-[3/4]')
  focalPosition?: string; // Pre-computed object-position (e.g. "45.2% 32.1%") from parent
}

/**
 * Mobile sizing presets — only affect base (< sm) classes.
 * sm: and lg: overrides in the JSX restore tablet/desktop styling.
 */
interface SizePreset {
  hPad: string; hText: string; cPad: string; type: string;
  attr: string; attrH: string; price: string; pPad: string;
}
const GALLERY_SIZES: Record<string, SizePreset> = {
  compact: {
    hPad: 'px-3 py-2',      hText: 'text-[10px]',
    cPad: 'px-4 pt-3 pb-3', type: 'text-[17px]',
    attr: 'text-[12px]',    attrH: 'h-[22px]',
    price: 'text-[14px]',   pPad: 'pt-2 mt-1',
  },
  standard: {
    hPad: 'px-4 py-2.5',    hText: 'text-[11px]',
    cPad: 'px-5 pt-3.5 pb-4', type: 'text-[21px]',
    attr: 'text-[14px]',    attrH: 'h-[24px]',
    price: 'text-[16px]',   pPad: 'pt-2.5 mt-1',
  },
  large: {
    hPad: 'px-5 py-3',      hText: 'text-[12px]',
    cPad: 'px-6 pt-4 pb-5', type: 'text-[24px]',
    attr: 'text-[16px]',    attrH: 'h-[28px]',
    price: 'text-[17px]',   pPad: 'pt-3 mt-2',
  },
};
const GRID_SIZES: Record<string, SizePreset> = {
  compact: {
    hPad: 'px-2 py-1',      hText: 'text-[7px]',
    cPad: 'px-1.5 pt-1.5 pb-1.5', type: 'text-[11px]',
    attr: 'text-[8px]',     attrH: 'h-[14px]',
    price: 'text-[11px]',   pPad: 'pt-1 mt-0.5',
  },
  standard: {
    hPad: 'px-2 py-1.5',    hText: 'text-[8px]',
    cPad: 'px-2 pt-2 pb-2', type: 'text-[13px]',
    attr: 'text-[10px]',    attrH: 'h-[17px]',
    price: 'text-[13px]',   pPad: 'pt-1.5 mt-0.5',
  },
  large: {
    hPad: 'px-2.5 py-2',    hText: 'text-[9px]',
    cPad: 'px-2.5 pt-2.5 pb-2', type: 'text-[14px]',
    attr: 'text-[11px]',    attrH: 'h-[19px]',
    price: 'text-[14px]',   pPad: 'pt-1.5 mt-0.5',
  },
};

// Normalize Japanese kanji and variants to standard English keys
const ITEM_TYPE_NORMALIZE: Record<string, string> = {
  // Japanese kanji
  '刀': 'katana',
  '脇差': 'wakizashi',
  '短刀': 'tanto',
  '太刀': 'tachi',
  '槍': 'yari',
  '薙刀': 'naginata',
  '鍔': 'tsuba',
  '小柄': 'kozuka',
  '目貫': 'menuki',
  '甲冑': 'armor',
  '兜': 'kabuto',
  '拵': 'koshirae',
  '拵え': 'koshirae',
  // Variants
  'fuchi_kashira': 'fuchi-kashira',
  'Katana': 'katana',
  'Wakizashi': 'wakizashi',
  'Tanto': 'tanto',
  'Tachi': 'tachi',
  'Tsuba': 'tsuba',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  // Swords
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  kodachi: 'Kodachi',
  ken: 'Ken',
  daisho: 'Daisho',
  // Tosogu (fittings)
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  kogai: 'Kogai',
  menuki: 'Menuki',
  fuchi: 'Fuchi',
  kashira: 'Kashira',
  futatokoro: 'Futatokoro',
  mitokoromono: 'Mitokoromono',
  koshirae: 'Koshirae',
  tosogu: 'Tosogu',
  // Armor
  armor: 'Armor',
  kabuto: 'Kabuto',
  helmet: 'Kabuto',
  // Other
  stand: 'Stand',
  book: 'Book',
  other: 'Other',
};

function normalizeItemType(rawType: string | null): string | null {
  if (!rawType) return null;
  const normalized = ITEM_TYPE_NORMALIZE[rawType] || rawType.toLowerCase();
  return ITEM_TYPE_LABELS[normalized] || ITEM_TYPE_LABELS[rawType.toLowerCase()] || null;
}

// Check if string contains Japanese characters (hiragana, katakana, kanji)
function containsJapanese(str: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);
}

// Item type prefixes to strip from title_en when extracting artisan name
const ITEM_TYPE_PREFIXES = [
  'Katana:', 'Wakizashi:', 'Tanto:', 'Tachi:', 'Kodachi:',
  'Naginata:', 'Yari:', 'Ken:', 'Daisho:',
  'Tsuba:', 'Fuchi-Kashira:', 'Kozuka:', 'Kogai:', 'Menuki:',
  'Koshirae:', 'Armor:', 'Helmet:',
  'Katana ', 'Wakizashi ', 'Tanto ', 'Tachi ',
];

/**
 * Extract romanized artisan name from title_en when smith/maker is in Japanese.
 * e.g., title_en: "Katana: Soshu Yukimitsu", school: "Soshu" → returns "Yukimitsu"
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

/**
 * Get romanized artisan name, extracting from title_en if smith/maker is in Japanese.
 */
function getArtisanName(
  rawName: string | null,
  school: string | null,
  titleEn: string | null | undefined
): string | null {
  if (!rawName) return null;

  // If already romanized, use it
  if (!containsJapanese(rawName)) return rawName;

  // Otherwise, try to extract from title_en
  return extractArtisanFromTitleEn(titleEn, school);
}

/**
 * Get romanized school name (returns null if Japanese).
 */
function getSchoolName(school: string | null): string | null {
  if (!school) return null;
  if (containsJapanese(school)) return null;
  return school;
}

// CERT_LABELS and defense-in-depth logic moved to src/lib/cert/validation.ts

function convertPrice(
  value: number,
  sourceCurrency: string,
  targetCurrency: Currency,
  rates: ExchangeRates | null
): number {
  if (!rates || sourceCurrency === targetCurrency) {
    return value;
  }

  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  const sourceRate = rates.rates[source] || 1;
  const targetRate = rates.rates[target] || 1;
  const valueInUsd = value / sourceRate;
  return valueInUsd * targetRate;
}

function formatPrice(
  value: number | null,
  sourceCurrency: string | null,
  targetCurrency: Currency,
  rates: ExchangeRates | null
): string {
  if (value === null) return 'Ask';

  const source = sourceCurrency || 'USD';
  const converted = convertPrice(value, source, targetCurrency, rates);

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: targetCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(Math.round(converted));
}


/**
 * Check if a listing has English setsumei translation available.
 * Checks both OCR-extracted setsumei AND Yuhinkai enrichment.
 * Requires Juyo/Tokuju cert — prevents showing orphaned hallucinated setsumei.
 */
function hasSetsumeiTranslation(listing: Listing): boolean {
  // Setsumei only exists for Juyo/Tokubetsu Juyo
  if (!isSetsumeiEligibleCert(listing.cert_type)) {
    return false;
  }

  // Check OCR-extracted setsumei
  if (listing.setsumei_text_en) {
    return true;
  }

  // Check Yuhinkai enrichment (from browse API - array)
  const enrichmentArray = listing.listing_yuhinkai_enrichment;
  if (enrichmentArray && enrichmentArray.length > 0) {
    const enrichment = enrichmentArray[0];
    // Must have setsumei_en, DEFINITIVE confidence, and valid verification
    if (
      enrichment.setsumei_en &&
      enrichment.match_confidence === 'DEFINITIVE' &&
      (enrichment.connection_source === 'manual'
        ? enrichment.verification_status === 'confirmed'
        : ['auto', 'confirmed'].includes(enrichment.verification_status || ''))
    ) {
      // Only show manual connections (auto-matcher not production-ready)
      if (enrichment.connection_source === 'manual') {
        return true;
      }
    }
  }

  // Check Yuhinkai enrichment (from QuickView context - single object)
  const enrichment = listing.yuhinkai_enrichment;
  if (enrichment?.setsumei_en) {
    if (
      enrichment.match_confidence === 'DEFINITIVE' &&
      enrichment.connection_source === 'manual' &&
      enrichment.verification_status === 'confirmed'
    ) {
      return true;
    }
  }

  return false;
}

function cleanTitle(title: string | null, smith: string | null, maker: string | null, untitledLabel = 'Untitled'): string {
  if (!title) return untitledLabel;

  let cleaned = title;
  cleaned = cleaned.replace(/^(Katana|Wakizashi|Tanto|Tachi|Tsuba|Kozuka|Menuki|Koshirae|Naginata|Yari):\s*/i, '');
  cleaned = cleaned.replace(/\s*\(NBTHK [^)]+\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\([^)]*Hozon[^)]*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\([^)]*Juyo[^)]*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if ((smith || maker) && cleaned.length > 50) {
    const artisan = smith || maker;
    if (artisan && cleaned.toLowerCase().startsWith(artisan.toLowerCase())) {
      return artisan;
    }
  }

  return cleaned || title;
}

// Tiny placeholder for blur effect
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

// Memoized ListingCard to prevent unnecessary re-renders when parent updates
// The comparison function checks props that actually affect rendering
export const ListingCard = memo(function ListingCard({
  listing,
  currency,
  exchangeRates,
  priority = false,
  showFavoriteButton = true,
  searchId,
  isAdmin = false,
  mobileView = 'gallery',
  fontSize = 'large',
  imageAspect,
  focalPosition,
}: ListingCardProps) {
  // Mobile view helpers — only affect base (mobile) classes; sm:/lg: overrides restore tablet/desktop
  const isGridMobile = mobileView === 'grid';
  const sz = isGridMobile
    ? (GRID_SIZES[fontSize] || GRID_SIZES.large)
    : (GALLERY_SIZES[fontSize] || GALLERY_SIZES.large);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const { t, locale } = useLocale();
  const activity = useActivityOptional();
  const quickView = useQuickViewOptional();
  const viewportTracking = useViewportTrackingOptional();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { preloadListing, cancelPreloads } = useImagePreloader();

  // Admin: toggle hide/unhide listing
  const handleToggleHidden = useCallback(async () => {
    const newHidden = !listing.admin_hidden;
    try {
      const res = await fetch(`/api/listing/${listing.id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHidden }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('listing-refreshed', {
          detail: { id: Number(listing.id), admin_hidden: newHidden },
        }));
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.admin_hidden]);

  // Admin: toggle sold/available status
  const handleToggleSold = useCallback(async () => {
    const markAsSold = listing.is_available;
    try {
      const res = await fetch(`/api/listing/${listing.id}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: markAsSold }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('listing-refreshed', {
          detail: {
            id: Number(listing.id),
            status: markAsSold ? 'sold' : 'available',
            is_available: !markAsSold,
            is_sold: markAsSold,
            status_admin_locked: true,
          },
        }));
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.is_available]);

  // Register for viewport tracking when mounted
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !viewportTracking) return;

    viewportTracking.trackElement(element, Number(listing.id));
    return () => {
      viewportTracking.untrackElement(element);
    };
  }, [listing.id, viewportTracking]);

  // Memoize expensive computations that derive from listing data
  // These run on every render otherwise, and with 100 cards that's significant
  const { allImages, school, artisan, itemType, cleanedTitle, certInfo } = useMemo(() => ({
    allImages: getAllImages(listing),
    school: getSchoolName(listing.school) || getSchoolName(listing.tosogu_school),
    artisan: getArtisanName(listing.smith, listing.school, listing.title_en)
      || getArtisanName(listing.tosogu_maker, listing.tosogu_school, listing.title_en),
    itemType: normalizeItemType(listing.item_type),
    cleanedTitle: cleanTitle(
      locale === 'en' && listing.title_en ? listing.title_en
        : locale === 'ja' && listing.title_ja ? listing.title_ja
        : listing.title,
      listing.smith, listing.tosogu_maker, t('listing.untitled')
    ),
    certInfo: getValidatedCertInfo(listing),
  }), [
    listing.id,
    listing.images,
    listing.stored_images,
    listing.school,
    listing.tosogu_school,
    listing.smith,
    listing.tosogu_maker,
    listing.title,
    listing.title_en,
    listing.title_ja,
    listing.item_type,
    listing.cert_type,
    listing.price_value,
    listing.price_currency,
    locale,
    t,
  ]);

  // Derive thumbnail URL, skipping images known to be broken.
  // Two independent checks:
  // 1. validationCache: dimension-invalid (tiny icons/buttons) — from useValidatedImages
  // 2. renderFailedSet: Next.js Image render failure — from this component's onError
  // These caches are intentionally separate to prevent cross-contamination.
  // fallbackIndex dependency triggers re-evaluation after each onError.
  const imageUrl = useMemo(() => {
    for (const url of allImages) {
      if (getCachedValidation(url) === 'invalid') continue;
      if (isRenderFailed(url)) continue;
      return url;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allImages, fallbackIndex]);

  // Check if item is definitively sold (for showing sale data)
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  // Check if item is unavailable for any reason (sold, reserved, withdrawn, etc.)
  // This catches reserved items that were slipping through without visual indicator
  const isUnavailable = !listing.is_available;
  const isAskPrice = listing.price_value === null;

  // Build SEO-optimized alt text (memoized since it depends on memoized values)
  const altText = useMemo(() => {
    return [
      itemType,
      certInfo?.label,
      artisan ? `by ${artisan}` : null,
      cleanedTitle !== itemType ? cleanedTitle : null,
    ].filter(Boolean).join(' - ') || listing.title || 'Japanese sword listing';
  }, [itemType, certInfo?.label, artisan, cleanedTitle, listing.title]);

  // Handle card click - open quick view or track activity
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't handle if clicking on interactive elements (favorite button, artisan tooltip)
    if ((e.target as HTMLElement).closest('[data-favorite-button]') ||
        (e.target as HTMLElement).closest('[data-artisan-tooltip]')) {
      return;
    }

    // Track search click-through for CTR analytics (if this came from a search)
    if (searchId && activity) {
      activity.trackSearchClickThrough(searchId, Number(listing.id));
    }

    // Track QuickView open (engagement event, not click-through to dealer)
    if (activity) {
      activity.trackQuickViewOpen(
        Number(listing.id),
        listing.dealers?.name,
        'listing_card'
      );
    }

    // Open quick view if available
    if (quickView) {
      // Convert local Listing type to the imported Listing type for context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.openQuickView(listing as any);
    }
  }, [activity, quickView, listing, searchId]);

  // Preload QuickView images on hover (after 150ms delay)
  const handleMouseEnter = useCallback(() => {
    // Only preload if QuickView is available (no point otherwise)
    if (!quickView) return;

    hoverTimerRef.current = setTimeout(() => {
      preloadListing(listing);
    }, 150);
  }, [quickView, preloadListing, listing]);

  // Preload QuickView images on touch (immediately, no delay)
  // Mobile devices don't hover, so we preload on touchstart for instant QuickView
  const handleTouchStart = useCallback(() => {
    if (!quickView) return;
    preloadListing(listing);
  }, [quickView, preloadListing, listing]);

  // Cancel preload if user moves away before delay
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    cancelPreloads();
  }, [cancelPreloads]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);


  // Shared image element
  const placeholderKanji = getPlaceholderKanji(listing.item_type);

  const imageElement = dealerDoesNotPublishImages(listing.dealers?.domain) ? (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linen text-center">
      <span className="font-serif text-[72px] sm:text-[80px] leading-none text-muted/10 select-none" aria-hidden="true">
        {placeholderKanji}
      </span>
      <span className="text-[9px] text-muted/40 tracking-widest uppercase mt-3">
        {t('listing.photosNotPublished')}
      </span>
    </div>
  ) : (hasError || !imageUrl) ? (
    <div className="absolute inset-0 flex items-center justify-center bg-linen">
      <span className="font-serif text-[72px] sm:text-[80px] leading-none text-muted/10 select-none" aria-hidden="true">
        {placeholderKanji}
      </span>
    </div>
  ) : (
    <Image
      key={imageUrl}
      src={imageUrl}
      alt={altText}
      fill
      className={`object-cover group-hover:scale-105 transition-[opacity,transform] duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      }`}
      style={focalPosition ? { objectPosition: focalPosition } : undefined}
      sizes={isGridMobile ? '(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
      priority={priority}
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? undefined : 'lazy'}
      placeholder="blur"
      blurDataURL={BLUR_PLACEHOLDER}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        if (imageUrl) {
          setRenderFailed(imageUrl);
        }
        const hasRemaining = allImages.some(url =>
          getCachedValidation(url) !== 'invalid' && !isRenderFailed(url)
        );
        if (hasRemaining) {
          setFallbackIndex(prev => prev + 1);
        } else {
          setIsLoading(false);
          setHasError(true);
        }
      }}
    />
  );

  // Shared unavailable overlay
  const unavailableOverlay = isUnavailable && (
    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
      <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">
        {isSold ? t('badge.sold') : t('listing.unavailable')}
      </span>
      {isSold && listing.sold_data?.sale_date && (
        <span className="text-[9px] text-white/80 mt-0.5">
          {listing.sold_data.sale_date}
        </span>
      )}
      {isSold && listing.sold_data?.days_on_market_display && (
        <span className={`text-[8px] mt-0.5 font-medium ${
          listing.sold_data.confidence === 'high' ? 'text-green-400' :
          listing.sold_data.confidence === 'medium' ? 'text-yellow-400' :
          'text-white/60'
        }`}>
          {t('listing.listed')} {listing.sold_data.days_on_market_display}
        </span>
      )}
    </div>
  );

  // Shared favorite button
  const favoriteBtn = showFavoriteButton && !isUnavailable && (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <FavoriteButton listingId={Number(listing.id)} size="sm" />
    </div>
  );

  // Shared "New" badge
  const isNew = shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import);
  const newBadge = isNew && (
    <span
      data-testid="new-listing-badge"
      className="text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 bg-new-listing-bg text-new-listing"
    >
      {isEarlyAccessListing(listing.first_seen_at) && !isTrialModeActive() ? t('badge.earlyAccess') : t('badge.new')}
    </span>
  );

  // Artisan display name (resolved server-side from Yuhinkai)
  const isUnknownArtisan = listing.artisan_id === 'UNKNOWN';
  const artisanDisplayName = isUnknownArtisan
    ? t('listing.unlistedArtist')
    : (locale === 'ja' && listing.artisan_name_kanji)
      ? listing.artisan_name_kanji
      : (listing.artisan_display_name || listing.artisan_id);

  // Price display
  const priceDisplay = listing.price_value === null
    ? t('listing.ask')
    : formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates);

  // Cert text color (no bg badge — just colored text in header)
  const certTextColor = certInfo
    ? certInfo.tier === 'tokuju' ? 'text-tokuju'
      : certInfo.tier === 'jubi' ? 'text-jubi'
      : certInfo.tier === 'juyo' ? 'text-juyo'
      : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
      : 'text-hozon'
    : '';

  // Attribution priority: artisan tag takes absolute priority over smith/school
  const hasArtisanTag = !!(artisanDisplayName && listing.artisan_id && listing.artisan_confidence !== 'NONE');
  const primaryName = hasArtisanTag ? artisanDisplayName! : (artisan || school || null);
  const isLinked = hasArtisanTag && !!listing.artisan_id && !isAdmin && !isUnknownArtisan;
  const linkHref = listing.artisan_id ? `/artists/${listing.artisan_id}` : '#';

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      data-testid="listing-card"
      data-listing-id={listing.id}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`group block bg-cream border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer${
        !isGridMobile ? ' shadow rounded overflow-hidden sm:shadow-none sm:rounded-none sm:overflow-visible' : ''
      }`}
    >
      {/* Header: dealer (left) + book icon + cert (right) */}
      <div className={`${sz.hPad} sm:px-3 sm:py-2 lg:px-4 lg:py-2.5 flex items-center justify-between`}>
        <span className={`${sz.hText} sm:text-[9px] lg:text-[10px] font-medium tracking-[0.14em] text-muted capitalize`}>
          {listing.dealers?.name}
        </span>
        <div className={`flex items-center ${isGridMobile ? 'gap-1' : 'gap-2'}`}>
          {locale !== 'ja' && hasSetsumeiTranslation(listing) && <SetsumeiZufuBadge iconOnly />}
          {certInfo && (
            <span className={`${sz.hText} sm:text-[9px] lg:text-[10px] uppercase tracking-wider font-bold ${certTextColor}`}>
              {t(certInfo.certKey)}
            </span>
          )}
        </div>
      </div>

      {/* Tall image — 3:4 aspect */}
      <div className={`relative ${imageAspect || 'aspect-[3/4]'} overflow-hidden bg-linen`}>
        {isLoading && imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />}
        {imageElement}
        {unavailableOverlay}
        {favoriteBtn}
        {isAdmin && listing.admin_hidden && (
          <div className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/80 text-white" title="Hidden from public">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          </div>
        )}
        {isAdmin && listing.status_admin_locked && (
          <div className={`absolute top-2 ${listing.admin_hidden ? 'left-10' : 'left-2'} w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/80 text-white`} title="Status manually overridden">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${sz.cPad} sm:px-3 sm:pt-3 sm:pb-3 lg:px-4 lg:pt-3.5 lg:pb-4 flex flex-col gap-0.5`}>
        {/* Type — primary identifier */}
        <h3 className={`${sz.type} sm:text-[15px] lg:text-base font-semibold leading-snug text-ink group-hover:text-gold transition-colors`}>
          {itemType || cleanedTitle}
        </h3>

        {/* Attribution — gold underline on artisan, plain text fallback */}
        {primaryName ? (
          <div className={`${sz.attrH} sm:h-[20px] lg:h-[22px] flex items-baseline overflow-hidden`}>
            <span className={`${sz.attr} sm:text-[11px] lg:text-[12px] text-muted font-normal mr-1 shrink-0`}>{t('listing.by')}</span>
            {isLinked ? (
              <a
                href={linkHref}
                data-artisan-tooltip
                onClick={(e) => e.stopPropagation()}
                className={`${sz.attr} sm:text-[11px] lg:text-[12px] font-medium text-ink border-b border-gold/40 pb-px hover:border-gold transition-colors truncate`}
              >
                {primaryName}
              </a>
            ) : hasArtisanTag && isAdmin ? (
              <ArtisanTooltip
                listingId={parseInt(listing.id)}
                artisanId={listing.artisan_id!}
                confidence={listing.artisan_confidence as 'HIGH' | 'MEDIUM' | 'LOW'}
                method={listing.artisan_method}
                candidates={listing.artisan_candidates}
                verified={listing.artisan_verified}
                certType={listing.cert_type}
                adminHidden={listing.admin_hidden}
                onToggleHidden={handleToggleHidden}
              >
                <span className={`${sz.attr} sm:text-[11px] lg:text-[12px] ${isUnknownArtisan ? 'italic text-muted' : 'font-medium text-ink border-b border-gold/40 pb-px'} truncate`}>
                  {primaryName}
                </span>
              </ArtisanTooltip>
            ) : hasArtisanTag && isUnknownArtisan ? (
              <span className={`${sz.attr} sm:text-[11px] lg:text-[12px] italic text-muted truncate`}>
                {primaryName}
              </span>
            ) : hasArtisanTag ? (
              <span className={`${sz.attr} sm:text-[11px] lg:text-[12px] font-medium text-ink border-b border-gold/40 pb-px truncate`}>
                {primaryName}
              </span>
            ) : (
              <span className={`${sz.attr} sm:text-[11px] lg:text-[12px] text-charcoal truncate`}>
                {primaryName}
              </span>
            )}
          </div>
        ) : isAdmin && !listing.artisan_id ? (
          <div className={`${sz.attrH} sm:h-[20px] lg:h-[22px] flex items-baseline`}>
            <ArtisanTooltip listingId={parseInt(listing.id)} startInSearchMode certType={listing.cert_type} adminHidden={listing.admin_hidden} onToggleHidden={handleToggleHidden}>
              <span className="text-[10px] font-medium text-muted hover:text-ink transition-colors cursor-pointer">
                {t('listing.setArtisan')}
              </span>
            </ArtisanTooltip>
          </div>
        ) : <div className={`${sz.attrH} sm:h-[20px] lg:h-[22px]`} />}

        {/* JA metadata row — nagasa + era (ichimokuryouzen: key specs at a glance) */}
        {locale === 'ja' && (listing.nagasa_cm || listing.era) && (
          <div className="flex items-center gap-2 text-[10px] text-muted truncate">
            {listing.nagasa_cm && (
              <span>{listing.nagasa_cm}cm</span>
            )}
            {listing.nagasa_cm && listing.era && <span className="text-border">·</span>}
            {listing.era && (
              <span>{(() => { const k = `era.${listing.era}`; const r = t(k); return r === k ? listing.era : r; })()}</span>
            )}
          </div>
        )}

        {/* Price row */}
        <div className={`${sz.pPad} sm:pt-2 sm:mt-1 border-t border-border/40 flex items-center justify-between`}>
          <span className={`${sz.price} sm:text-[14px] lg:text-[15px] tabular-nums ${isAskPrice ? 'text-charcoal' : 'text-ink font-medium'}`}>
            {priceDisplay}
          </span>
          <div className="flex items-center gap-1.5">
            {locale === 'ja' && !isNew && listing.last_scraped_at && (
              <span className="text-[9px] text-muted/60 tabular-nums hidden sm:inline">
                {t('card.confirmed', { time: formatRelativeTime(listing.last_scraped_at, t) })}
              </span>
            )}
            {newBadge}
          </div>
        </div>
      </div>
    </div>
  );

}, (prevProps, nextProps) => {
  return (
    prevProps.listing.id === nextProps.listing.id &&
    prevProps.currency === nextProps.currency &&
    prevProps.priority === nextProps.priority &&
    prevProps.showFavoriteButton === nextProps.showFavoriteButton &&
    prevProps.exchangeRates?.timestamp === nextProps.exchangeRates?.timestamp &&
    prevProps.listing.setsumei_text_en === nextProps.listing.setsumei_text_en &&
    prevProps.listing.listing_yuhinkai_enrichment?.length === nextProps.listing.listing_yuhinkai_enrichment?.length &&
    prevProps.listing.artisan_id === nextProps.listing.artisan_id &&
    prevProps.listing.artisan_display_name === nextProps.listing.artisan_display_name &&
    prevProps.listing.artisan_name_kanji === nextProps.listing.artisan_name_kanji &&
    prevProps.listing.artisan_confidence === nextProps.listing.artisan_confidence &&
    prevProps.listing.cert_type === nextProps.listing.cert_type &&
    prevProps.listing.status === nextProps.listing.status &&
    prevProps.listing.is_sold === nextProps.listing.is_sold &&
    prevProps.listing.is_available === nextProps.listing.is_available &&
    prevProps.listing.status_admin_locked === nextProps.listing.status_admin_locked &&
    prevProps.mobileView === nextProps.mobileView &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.imageAspect === nextProps.imageAspect &&
    prevProps.listing.era === nextProps.listing.era &&
    prevProps.listing.nagasa_cm === nextProps.listing.nagasa_cm
  );
});
