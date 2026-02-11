'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { SetsumeiZufuBadge } from '@/components/ui/SetsumeiZufuBadge';
import { ArtisanTooltip } from '@/components/artisan/ArtisanTooltip';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useViewportTrackingOptional } from '@/lib/viewport';
import { getAllImages, getCachedValidation, setCachedValidation, dealerDoesNotPublishImages } from '@/lib/images';
import { shouldShowNewBadge } from '@/lib/newListing';
import { trackSearchClick } from '@/lib/tracking/searchTracker';
import { isTrialModeActive } from '@/types/subscription';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import type { CardStyle, TagStyle } from './CardStyleSelector';

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
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
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
  isNearViewport?: boolean; // For lazy loading optimization
  searchId?: number; // For CTR tracking
  isAdmin?: boolean; // For admin-only features like artisan code display
  cardStyle?: CardStyle; // Card design variant
  tagStyle?: TagStyle; // Tag sub-variant for artisan display
}

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
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  kodachi: 'Kodachi',
  ken: 'Ken',
  daisho: 'Daishō',
  // Tosogu (fittings)
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  kogai: 'Kōgai',
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

const CERT_LABELS: Record<string, { label: string; tier: 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon' }> = {
  // Tokubetsu Juyo - highest tier (purple)
  Tokuju: { label: 'Tokuju', tier: 'tokuju' },
  tokuju: { label: 'Tokuju', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokuju', tier: 'tokuju' },
  // Juyo Bijutsuhin - Important Cultural Property (orange/gold)
  JuyoBijutsuhin: { label: 'Jubi', tier: 'jubi' },
  juyo_bijutsuhin: { label: 'Jubi', tier: 'jubi' },
  // Juyo - high tier (blue)
  Juyo: { label: 'Jūyō', tier: 'juyo' },
  juyo: { label: 'Jūyō', tier: 'juyo' },
  // Tokubetsu Hozon - mid tier (brown)
  TokuHozon: { label: 'Tokuho', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokuho', tier: 'tokuho' },
  TokuKicho: { label: 'Tokubetsu Kichō', tier: 'tokuho' },
  // Hozon - standard tier (yellow)
  Hozon: { label: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', tier: 'hozon' },
  nbthk: { label: 'NBTHK', tier: 'hozon' },
  nthk: { label: 'NTHK', tier: 'hozon' },
};

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
 */
function hasSetsumeiTranslation(listing: Listing): boolean {
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

function cleanTitle(title: string | null, smith: string | null, maker: string | null): string {
  if (!title) return 'Untitled';

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
  isNearViewport = true, // Default to true for backward compatibility
  searchId,
  isAdmin = false,
  cardStyle = 'classic',
  tagStyle = 'a',
}: ListingCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const activity = useActivityOptional();
  const quickView = useQuickViewOptional();
  const viewportTracking = useViewportTrackingOptional();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { preloadListing, cancelPreloads } = useImagePreloader();

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
    cleanedTitle: cleanTitle(listing.title, listing.smith, listing.tosogu_maker),
    certInfo: listing.cert_type ? CERT_LABELS[listing.cert_type] : null,
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
    listing.item_type,
    listing.cert_type,
  ]);

  // Derive thumbnail URL, skipping images known to be broken.
  // Checks in-memory validationCache (survives SPA navigation) and
  // sessionStorage (survives hard reload). fallbackIndex as dependency
  // triggers re-evaluation after each onError marks a URL as broken.
  const imageUrl = useMemo(() => {
    for (const url of allImages) {
      if (getCachedValidation(url) === 'invalid') continue;
      try {
        if (typeof window !== 'undefined' && sessionStorage.getItem(`nw:img:bad:${url}`)) {
          setCachedValidation(url, 'invalid');
          continue;
        }
      } catch { /* SSR or storage unavailable */ }
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
    if (searchId) {
      trackSearchClick(searchId, Number(listing.id));
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

  // Shared container props for all card styles (ref must be passed separately)
  const containerProps = {
    role: 'button' as const,
    tabIndex: 0,
    'data-testid': 'listing-card',
    'data-listing-id': listing.id,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e as unknown as React.MouseEvent);
      }
    },
  };

  // Shared image element
  const imageElement = dealerDoesNotPublishImages(listing.dealers?.domain) ? (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linen text-center px-4">
      <svg className="w-10 h-10 text-muted/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-[10px] text-muted/60 font-medium leading-tight">
        This merchant does not<br />publish images
      </span>
    </div>
  ) : (hasError || !imageUrl) ? (
    <div className="absolute inset-0 flex items-center justify-center bg-linen">
      <svg className="w-12 h-12 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  ) : isNearViewport ? (
    <Image
      key={imageUrl}
      src={imageUrl}
      alt={altText}
      fill
      className={`object-cover group-hover:scale-105 transition-all duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      }`}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      priority={priority}
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? undefined : 'lazy'}
      placeholder="blur"
      blurDataURL={BLUR_PLACEHOLDER}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        if (imageUrl) {
          setCachedValidation(imageUrl, 'invalid');
          try { sessionStorage.setItem(`nw:img:bad:${imageUrl}`, '1'); } catch {}
        }
        const hasRemaining = allImages.some(url => getCachedValidation(url) !== 'invalid');
        if (hasRemaining) {
          setFallbackIndex(prev => prev + 1);
        } else {
          setIsLoading(false);
          setHasError(true);
        }
      }}
    />
  ) : (
    <div className="absolute inset-0 bg-linen" />
  );

  // Shared unavailable overlay
  const unavailableOverlay = isUnavailable && (
    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
      <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">
        {isSold ? 'Sold' : 'Unavailable'}
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
          Listed {listing.sold_data.days_on_market_display}
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
  const newBadge = shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import) && (
    <span
      data-testid="new-listing-badge"
      className="text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 bg-new-listing-bg text-new-listing"
    >
      {isEarlyAccessListing(listing.first_seen_at) && !isTrialModeActive() ? 'Early Access' : 'New'}
    </span>
  );

  // Artisan badge (shared across variants)
  const artisanDisplayName = listing.artisan_display_name || listing.artisan_id;

  // Shared artisan badge element (for admin and non-admin)
  const artisanBadge = listing.artisan_id &&
    listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
    (isAdmin || !listing.artisan_id.startsWith('tmp')) ? (
    isAdmin ? (
      <ArtisanTooltip
        listingId={parseInt(listing.id)}
        artisanId={listing.artisan_id}
        confidence={listing.artisan_confidence}
        method={listing.artisan_method}
        candidates={listing.artisan_candidates}
        verified={listing.artisan_verified}
      >
        <span className={`text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 ${
          listing.artisan_confidence === 'HIGH'
            ? 'bg-artisan-high-bg text-artisan-high'
            : listing.artisan_confidence === 'MEDIUM'
            ? 'bg-artisan-medium-bg text-artisan-medium'
            : 'bg-artisan-low-bg text-artisan-low'
        }`}>
          {artisanDisplayName}
        </span>
      </ArtisanTooltip>
    ) : (
      <a
        href={`/artists/${listing.artisan_id}`}
        data-artisan-tooltip
        onClick={(e) => e.stopPropagation()}
        className={`text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 hover:opacity-80 transition-opacity ${
          listing.artisan_confidence === 'HIGH'
            ? 'bg-artisan-high-bg text-artisan-high'
            : listing.artisan_confidence === 'MEDIUM'
            ? 'bg-artisan-medium-bg text-artisan-medium'
            : 'bg-artisan-low-bg text-artisan-low'
        }`}
      >
        {artisanDisplayName}
      </a>
    )
  ) : isAdmin && !listing.artisan_id ? (
    <ArtisanTooltip listingId={parseInt(listing.id)} startInSearchMode>
      <span className="text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 bg-muted/10 text-muted hover:text-ink transition-colors">
        Set ID
      </span>
    </ArtisanTooltip>
  ) : null;

  // Cert badge element (shared)
  const certBadge = certInfo && (
    <span className={`text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 ${
      certInfo.tier === 'tokuju'
        ? 'bg-tokuju-bg text-tokuju'
        : certInfo.tier === 'jubi'
        ? 'bg-jubi-bg text-jubi'
        : certInfo.tier === 'juyo'
        ? 'bg-juyo-bg text-juyo'
        : certInfo.tier === 'tokuho'
        ? 'bg-toku-hozon-bg text-toku-hozon'
        : 'bg-hozon-bg text-hozon'
    }`}>
      {certInfo.label}
    </span>
  );

  // Price display (shared)
  const priceDisplay = formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates);

  // ══════════════════════════════════════════════════════
  // "Refined" — Dealer + cert header, tall image, clean content
  // Best hybrid: Gallery header (no bar) + tall 3:4 image
  // Artisan prominent in attribution, no badge-row crowding
  // ══════════════════════════════════════════════════════
  if (cardStyle === 'clean') {
    // Cert text color (no bg badge — just colored text in header)
    const certTextColor = certInfo
      ? certInfo.tier === 'tokuju' ? 'text-tokuju'
        : certInfo.tier === 'jubi' ? 'text-jubi'
        : certInfo.tier === 'juyo' ? 'text-juyo'
        : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
        : 'text-hozon'
      : '';

    // Resolve the best artisan label for display
    const hasArtisan = !!(artisanDisplayName && listing.artisan_id && listing.artisan_confidence !== 'NONE');
    const displayArtisan = hasArtisan ? artisanDisplayName : (artisan || null);
    const displaySchool = school || null;

    // ── Tag style A: "Inline" ──
    // Artisan name woven naturally into attribution text.
    // No badge, no pill — just clean text. Artisan clickable as link.
    const artisanLineA = (
      <div className="h-[18px] lg:h-[20px]">
        {displayArtisan ? (
          <p className="text-[11px] lg:text-[12px] text-charcoal truncate">
            {hasArtisan && listing.artisan_id && !isAdmin ? (
              <a
                href={`/artists/${listing.artisan_id}`}
                data-artisan-tooltip
                onClick={(e) => e.stopPropagation()}
                className="hover:text-gold transition-colors"
              >
                {displayArtisan}
              </a>
            ) : (
              displayArtisan
            )}
            {displaySchool && displayArtisan !== displaySchool && (
              <span className="text-muted"> · {displaySchool}</span>
            )}
          </p>
        ) : displaySchool ? (
          <p className="text-[11px] lg:text-[12px] text-charcoal truncate">{displaySchool}</p>
        ) : null}
      </div>
    );

    // ── Tag style B: "Pill" ──
    // Artisan shown as a subtle rounded pill (no color coding).
    // Smaller text, soft bg, truncates gracefully.
    const artisanLineB = (
      <div className="h-[20px] lg:h-[22px] flex items-center gap-1.5 overflow-hidden">
        {displayArtisan ? (
          hasArtisan && listing.artisan_id && !isAdmin ? (
            <a
              href={`/artists/${listing.artisan_id}`}
              data-artisan-tooltip
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] lg:text-[11px] font-medium text-charcoal bg-surface px-2 py-0.5 rounded-full truncate max-w-[70%] hover:bg-hover transition-colors"
            >
              {displayArtisan}
            </a>
          ) : (
            <span className="text-[10px] lg:text-[11px] font-medium text-charcoal bg-surface px-2 py-0.5 rounded-full truncate max-w-[70%]">
              {displayArtisan}
            </span>
          )
        ) : null}
        {displaySchool && displayArtisan !== displaySchool && (
          <span className="text-[10px] lg:text-[11px] text-muted truncate">{displaySchool}</span>
        )}
        {!displayArtisan && displaySchool && (
          <span className="text-[11px] lg:text-[12px] text-charcoal truncate">{displaySchool}</span>
        )}
      </div>
    );

    // ── Tag style C: "Underline" ──
    // Artisan name with a subtle gold accent underline. School as quiet suffix.
    const artisanLineC = (
      <div className="h-[20px] lg:h-[22px] flex items-baseline gap-1.5 overflow-hidden">
        {displayArtisan ? (
          hasArtisan && listing.artisan_id && !isAdmin ? (
            <a
              href={`/artists/${listing.artisan_id}`}
              data-artisan-tooltip
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] lg:text-[12px] font-medium text-ink border-b border-gold/40 pb-px hover:border-gold transition-colors truncate max-w-[70%]"
            >
              {displayArtisan}
            </a>
          ) : (
            <span className="text-[11px] lg:text-[12px] font-medium text-ink border-b border-gold/40 pb-px truncate max-w-[70%]">
              {displayArtisan}
            </span>
          )
        ) : null}
        {displaySchool && displayArtisan !== displaySchool && (
          <span className="text-[10px] lg:text-[11px] text-muted/60 truncate">{displaySchool}</span>
        )}
        {!displayArtisan && displaySchool && (
          <span className="text-[11px] lg:text-[12px] text-charcoal truncate">{displaySchool}</span>
        )}
      </div>
    );

    const artisanLine = tagStyle === 'c' ? artisanLineC : tagStyle === 'b' ? artisanLineB : artisanLineA;

    return (
      <div
        ref={cardRef}
        {...containerProps}
        className="group block bg-cream border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer"
      >
        {/* Header: dealer (left) + setsumei icon + cert (right) — no colored bar */}
        <div className="px-3 py-2 lg:px-4 lg:py-2.5 flex items-center justify-between">
          <span className="text-[9px] lg:text-[10px] font-medium tracking-[0.14em] text-muted lowercase">
            {listing.dealers?.name}
          </span>
          <div className="flex items-center gap-2">
            {hasSetsumeiTranslation(listing) && <SetsumeiZufuBadge iconOnly />}
            {certInfo && (
              <span className={`text-[9px] lg:text-[10px] uppercase tracking-wider font-bold ${certTextColor}`}>
                {certInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Tall image — 3:4 aspect, no overlays */}
        <div className="relative aspect-[3/4] overflow-hidden bg-linen">
          {isLoading && imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />}
          {imageElement}
          {unavailableOverlay}
          {favoriteBtn}
        </div>

        {/* Content — spacious, clear hierarchy */}
        <div className="px-3 pt-3 pb-3 lg:px-4 lg:pt-3.5 lg:pb-4 flex flex-col gap-0.5">
          {/* Type — primary identifier */}
          <h3 className="text-[15px] lg:text-base font-semibold leading-snug text-ink group-hover:text-gold transition-colors">
            {itemType || cleanedTitle}
          </h3>

          {/* Attribution — varies by tag style */}
          {artisanLine}

          {/* Price row — clean separator */}
          <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
            <span className={`text-[15px] lg:text-base tabular-nums ${isAskPrice ? 'text-charcoal' : 'text-ink font-semibold'}`}>
              {priceDisplay}
            </span>
            <div className="flex items-center gap-1.5">
              {newBadge}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // "Cinematic" — Tall image, airy content, no overlays
  // Dealer + cert text in a delicate header row
  // Big image → type → artisan · school → price
  // ══════════════════════════════════════════════════════
  if (cardStyle === 'editorial') {
    const certTextColor = certInfo
      ? certInfo.tier === 'tokuju' ? 'text-tokuju'
        : certInfo.tier === 'jubi' ? 'text-jubi'
        : certInfo.tier === 'juyo' ? 'text-juyo'
        : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
        : 'text-hozon'
      : '';

    return (
      <div
        ref={cardRef}
        {...containerProps}
        className="group block bg-cream border border-border/60 hover:border-gold/40 transition-all duration-300 cursor-pointer"
      >
        {/* Slim header — dealer left, cert right */}
        <div className="px-3 py-1.5 lg:px-4 lg:py-2 flex items-baseline justify-between border-b border-border/30">
          <span className="text-[8px] lg:text-[9px] font-medium tracking-[0.16em] text-muted/70 uppercase">
            {listing.dealers?.name}
          </span>
          {certInfo && (
            <span className={`text-[9px] lg:text-[10px] uppercase tracking-wider font-bold ${certTextColor}`}>
              {certInfo.label}
            </span>
          )}
        </div>

        {/* Tall image — 5:7 aspect (taller than 3:4, portrait feel) */}
        <div className="relative aspect-[5/7] overflow-hidden bg-linen">
          {isLoading && imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />}
          {imageElement}
          {unavailableOverlay}
          {favoriteBtn}
        </div>

        {/* Content — minimal, airy */}
        <div className="px-3 pt-2.5 pb-3 lg:px-4 lg:pt-3 lg:pb-3.5">
          {/* Type */}
          <h3 className="text-[14px] lg:text-[15px] font-semibold leading-snug text-ink group-hover:text-gold transition-colors">
            {itemType || cleanedTitle}
          </h3>

          {/* Attribution line — artisan · school */}
          <div className="h-[18px] mt-0.5">
            {(artisanDisplayName && listing.artisan_id && listing.artisan_confidence !== 'NONE') ? (
              <p className="text-[11px] lg:text-[12px] text-charcoal/80 truncate">
                {artisanDisplayName}
                {school && artisanDisplayName !== school && (
                  <span className="text-muted/60"> · {school}</span>
                )}
              </p>
            ) : (artisan || school) ? (
              <p className="text-[11px] lg:text-[12px] text-charcoal/80 truncate">
                {artisan || school}
              </p>
            ) : null}
          </div>

          {/* Price + micro badges */}
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[15px] lg:text-base tabular-nums ${isAskPrice ? 'text-charcoal/70' : 'text-ink font-semibold'}`}>
              {priceDisplay}
            </span>
            <div className="flex items-center gap-1.5">
              {hasSetsumeiTranslation(listing) && <SetsumeiZufuBadge iconOnly />}
              {newBadge}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // "Museum" — Centered, auction-catalog elegance
  // Cert as colored dot + text. Everything centered.
  // Tall image, serif-feeling hierarchy, quiet luxury.
  // ══════════════════════════════════════════════════════
  if (cardStyle === 'gallery') {
    const certDotColor = certInfo
      ? certInfo.tier === 'tokuju' ? 'bg-tokuju'
        : certInfo.tier === 'jubi' ? 'bg-jubi'
        : certInfo.tier === 'juyo' ? 'bg-juyo'
        : certInfo.tier === 'tokuho' ? 'bg-toku-hozon'
        : 'bg-hozon'
      : '';
    const certTextColor = certInfo
      ? certInfo.tier === 'tokuju' ? 'text-tokuju'
        : certInfo.tier === 'jubi' ? 'text-jubi'
        : certInfo.tier === 'juyo' ? 'text-juyo'
        : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
        : 'text-hozon'
      : '';

    return (
      <div
        ref={cardRef}
        {...containerProps}
        className="group block bg-cream border border-border/40 hover:border-gold/30 transition-all duration-300 cursor-pointer"
      >
        {/* Dealer — small, centered, top */}
        <div className="px-3 pt-2.5 pb-1 lg:px-4 lg:pt-3 text-center">
          <span className="text-[8px] lg:text-[9px] font-medium tracking-[0.18em] text-muted/60 uppercase">
            {listing.dealers?.name}
          </span>
        </div>

        {/* Tall image — 3:4 aspect */}
        <div className="relative aspect-[3/4] overflow-hidden bg-linen mx-2.5 lg:mx-3">
          {isLoading && imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />}
          {imageElement}
          {unavailableOverlay}
          {favoriteBtn}
        </div>

        {/* Content — centered, catalog feel */}
        <div className="px-3 pt-3 pb-3 lg:px-4 lg:pt-3.5 lg:pb-4 text-center">
          {/* Cert indicator — dot + label, centered */}
          {certInfo && (
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${certDotColor}`} />
              <span className={`text-[8px] lg:text-[9px] uppercase tracking-[0.2em] font-semibold ${certTextColor}`}>
                {certInfo.label}
              </span>
              {hasSetsumeiTranslation(listing) && <SetsumeiZufuBadge iconOnly />}
            </div>
          )}

          {/* Type — centered headline */}
          <h3 className="text-[16px] lg:text-[17px] font-semibold leading-tight text-ink group-hover:text-gold transition-colors">
            {itemType || cleanedTitle}
          </h3>

          {/* Attribution — centered, elegant */}
          <div className="h-[18px] lg:h-[20px] mt-0.5">
            {(artisanDisplayName && listing.artisan_id && listing.artisan_confidence !== 'NONE') ? (
              <p className="text-[11px] lg:text-[12px] text-charcoal/70 truncate">
                {artisanDisplayName}
                {school && artisanDisplayName !== school && (
                  <span className="text-muted/50"> · {school}</span>
                )}
              </p>
            ) : (artisan || school) ? (
              <p className="text-[11px] lg:text-[12px] text-charcoal/70 truncate">
                {artisan || school}
              </p>
            ) : null}
          </div>

          {/* Price — prominent, centered */}
          <div className="pt-2.5 mt-2 border-t border-border/30">
            <span className={`text-[16px] lg:text-[17px] tabular-nums ${isAskPrice ? 'text-charcoal/60' : 'text-ink font-semibold'}`}>
              {priceDisplay}
            </span>
          </div>

          {/* New badge — centered */}
          {newBadge && (
            <div className="flex items-center justify-center mt-1.5">
              {newBadge}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // DEFAULT: "Classic" — Original design (unchanged)
  // ══════════════════════════════════════════════════════
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
      className="group block bg-cream border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer"
    >
      {/* Dealer Name - Prominent header */}
      <div className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-surface text-center">
        <span className="text-[10px] lg:text-[12px] font-medium tracking-[0.12em] text-charcoal dark:text-gray-300 lowercase">
          {listing.dealers?.name}
        </span>
      </div>

      {/* Image Container with skeleton loader */}
      <div className="relative aspect-[4/3] overflow-hidden bg-linen">
        {/* Skeleton loader - shows while loading (hide if no valid image to try) */}
        {isLoading && imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />
        )}

        {/* Fallback for missing/broken images */}
        {dealerDoesNotPublishImages(listing.dealers?.domain) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-linen text-center px-4">
            <svg className="w-10 h-10 text-muted/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] text-muted/60 font-medium leading-tight">
              This merchant does not<br />publish images
            </span>
          </div>
        ) : (hasError || !imageUrl) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-linen">
            <svg className="w-12 h-12 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : isNearViewport ? (
          <Image
            src={imageUrl}
            alt={altText}
            fill
            className={`object-cover group-hover:scale-105 transition-all duration-500 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            // fetchPriority hints to browser which images to load first
            // This improves LCP for above-the-fold images
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : 'lazy'}
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              // Try next image in the array before showing error state
              if (fallbackIndex + 1 < allImages.length) {
                setFallbackIndex(fallbackIndex + 1);
              } else {
                setIsLoading(false);
                setHasError(true);
              }
            }}
          />
        ) : (
          // Placeholder shown for cards not yet near viewport
          <div className="absolute inset-0 bg-linen" />
        )}

        {/* Unavailable overlay - shows for sold, reserved, withdrawn items */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">
              {isSold ? 'Sold' : 'Unavailable'}
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
                Listed {listing.sold_data.days_on_market_display}
              </span>
            )}
          </div>
        )}

        {/* Favorite button - hidden for unavailable items */}
        {showFavoriteButton && !isUnavailable && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <FavoriteButton listingId={Number(listing.id)} size="sm" />
          </div>
        )}
      </div>

      {/* Content - Fixed height with flex layout for consistent card sizes */}
      <div className="p-2.5 lg:p-4 flex flex-col h-[130px] lg:h-[140px]">
        {/* Certification & Setsumei badges - fixed height slot */}
        <div className="h-[24px] lg:h-[28px] flex items-center justify-between">
          {/* Left side: certification + setsumei badges */}
          <div className="flex items-center gap-1.5">
            {certInfo && (
              <span className={`text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 ${
                certInfo.tier === 'tokuju'
                  ? 'bg-tokuju-bg text-tokuju'
                  : certInfo.tier === 'jubi'
                  ? 'bg-jubi-bg text-jubi'
                  : certInfo.tier === 'juyo'
                  ? 'bg-juyo-bg text-juyo'
                  : certInfo.tier === 'tokuho'
                  ? 'bg-toku-hozon-bg text-toku-hozon'
                  : 'bg-hozon-bg text-hozon'
              }`}>
                {certInfo.label}
              </span>
            )}
            {hasSetsumeiTranslation(listing) && (
              <SetsumeiZufuBadge compact />
            )}
          </div>

          {/* Right side: artisan code (HIGH/MEDIUM/LOW confidence) */}
          {/* Hide tmp-prefixed provisional codes from non-admin users */}
          {listing.artisan_id &&
           listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
           (isAdmin || !listing.artisan_id.startsWith('tmp')) ? (
            isAdmin ? (
              <ArtisanTooltip
                listingId={parseInt(listing.id)}
                artisanId={listing.artisan_id}
                confidence={listing.artisan_confidence}
                method={listing.artisan_method}
                candidates={listing.artisan_candidates}
                verified={listing.artisan_verified}
              >
                <span className={`text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 ${
                  listing.artisan_confidence === 'HIGH'
                    ? 'bg-artisan-high-bg text-artisan-high'
                    : listing.artisan_confidence === 'MEDIUM'
                    ? 'bg-artisan-medium-bg text-artisan-medium'
                    : 'bg-artisan-low-bg text-artisan-low'
                }`}>
                  {listing.artisan_display_name || listing.artisan_id}
                </span>
              </ArtisanTooltip>
            ) : (
              <a
                href={`/artists/${listing.artisan_id}`}
                data-artisan-tooltip
                onClick={(e) => e.stopPropagation()}
                className={`text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 hover:opacity-80 transition-opacity ${
                  listing.artisan_confidence === 'HIGH'
                    ? 'bg-artisan-high-bg text-artisan-high'
                    : listing.artisan_confidence === 'MEDIUM'
                    ? 'bg-artisan-medium-bg text-artisan-medium'
                    : 'bg-artisan-low-bg text-artisan-low'
                }`}
              >
                {listing.artisan_display_name || listing.artisan_id}
              </a>
            )
          ) : isAdmin && !listing.artisan_id ? (
            /* Admin: show "Set ID" badge for unmatched listings */
            <ArtisanTooltip
              listingId={parseInt(listing.id)}
              startInSearchMode
            >
              <span className="text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 bg-muted/10 text-muted hover:text-ink transition-colors">
                Set ID
              </span>
            </ArtisanTooltip>
          ) : null}
        </div>

        {/* Item Type - Primary identifier (always English), fallback to cleaned title */}
        <h3 className="text-[15px] lg:text-base font-semibold leading-snug text-ink group-hover:text-gold transition-colors mb-1">
          {itemType || cleanedTitle}
        </h3>

        {/* Smith/School - Key attribution - fixed height slot */}
        <div className="h-[20px] lg:h-[22px]">
          {(artisan || school) && (
            <p className="text-[12px] lg:text-[13px] text-charcoal truncate">
              {artisan || school}
            </p>
          )}
        </div>

        {/* Price row - always at bottom */}
        <div className="pt-2.5 mt-auto border-t border-border/50 flex items-center justify-between">
          <span className={`text-[15px] lg:text-base tabular-nums ${
            isAskPrice
              ? 'text-charcoal'
              : 'text-ink font-semibold'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates)}
          </span>
          {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import) && (
            <span
              data-testid="new-listing-badge"
              className="text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 bg-new-listing-bg text-new-listing"
            >
              {isEarlyAccessListing(listing.first_seen_at) && !isTrialModeActive() ? 'Early Access' : 'New'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  // Only re-render if something that affects display has changed
  return (
    prevProps.listing.id === nextProps.listing.id &&
    prevProps.currency === nextProps.currency &&
    prevProps.priority === nextProps.priority &&
    prevProps.isNearViewport === nextProps.isNearViewport &&
    prevProps.showFavoriteButton === nextProps.showFavoriteButton &&
    // Compare exchange rates by timestamp (cheaper than deep compare)
    prevProps.exchangeRates?.timestamp === nextProps.exchangeRates?.timestamp &&
    // Re-render if setsumei availability changes (OCR or Yuhinkai enrichment)
    prevProps.listing.setsumei_text_en === nextProps.listing.setsumei_text_en &&
    prevProps.listing.listing_yuhinkai_enrichment?.length === nextProps.listing.listing_yuhinkai_enrichment?.length &&
    // Re-render if artisan data changes (after admin fix-artisan)
    prevProps.listing.artisan_id === nextProps.listing.artisan_id &&
    prevProps.listing.artisan_display_name === nextProps.listing.artisan_display_name &&
    prevProps.listing.artisan_confidence === nextProps.listing.artisan_confidence &&
    // Re-render if card style changes
    prevProps.cardStyle === nextProps.cardStyle &&
    prevProps.tagStyle === nextProps.tagStyle
  );
});
