'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { SetsumeiZufuBadge } from '@/components/ui/SetsumeiZufuBadge';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useViewportTrackingOptional } from '@/lib/viewport';
import { getImageUrl, dealerDoesNotPublishImages } from '@/lib/images';
import { shouldShowNewBadge } from '@/lib/newListing';
import { trackSearchClick } from '@/lib/tracking/searchTracker';
import { isTrialModeActive } from '@/types/subscription';
import { useImagePreloader } from '@/hooks/useImagePreloader';

// 72 hours in milliseconds - matches the data delay for free tier
const EARLY_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Check if a listing is within the "early access" window (72 hours)
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
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  kodachi: 'Kodachi',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  armor: 'Armor',
  kabuto: 'Kabuto',
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
  TokuHozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
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
}: ListingCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
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
  const { imageUrl, school, artisan, itemType, cleanedTitle, certInfo } = useMemo(() => ({
    imageUrl: getImageUrl(listing),
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
    // Don't handle if clicking on the favorite button
    if ((e.target as HTMLElement).closest('[data-favorite-button]')) {
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
      className="group block bg-paper border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer"
    >
      {/* Dealer Site - Prominent header */}
      <div className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-linen/80 dark:bg-white/10 text-center">
        <span className="text-[10px] lg:text-[12px] font-medium tracking-[0.12em] text-charcoal dark:text-gray-300 lowercase">
          {listing.dealers?.domain}
        </span>
      </div>

      {/* Image Container with skeleton loader */}
      <div className="relative aspect-[4/3] overflow-hidden bg-linen">
        {/* Skeleton loader - shows while loading */}
        {isLoading && (
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
              setIsLoading(false);
              setHasError(true);
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

          {/* Right side: artisan code (admin only, HIGH/MEDIUM/LOW confidence) */}
          {isAdmin && listing.artisan_id &&
           listing.artisan_confidence && listing.artisan_confidence !== 'NONE' && (
            <span className={`text-[9px] lg:text-[10px] font-mono font-medium px-1.5 py-0.5 ${
              listing.artisan_confidence === 'HIGH'
                ? 'bg-artisan-high-bg text-artisan-high'
                : listing.artisan_confidence === 'MEDIUM'
                ? 'bg-artisan-medium-bg text-artisan-medium'
                : 'bg-artisan-low-bg text-artisan-low'
            }`}>
              {listing.artisan_id}
            </span>
          )}
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
          {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at) && (
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
    prevProps.listing.listing_yuhinkai_enrichment?.length === nextProps.listing.listing_yuhinkai_enrichment?.length
  );
});
