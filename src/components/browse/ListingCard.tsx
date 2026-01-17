'use client';

import Image from 'next/image';
import { useState, useCallback } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { getMarketTimeDisplay } from '@/lib/freshness';

interface Listing {
  id: string;
  url: string;
  title: string | null;
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
  first_seen_at: string;
  listing_published_at?: string | null;
  freshness_source?: string;
  freshness_confidence?: string;
  wayback_first_archive_at?: string | null;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
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
function isJapanese(str: string): boolean {
  // Matches hiragana, katakana, and CJK unified ideographs (kanji)
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);
}

// Only return romanized names, hide Japanese text
function getRomanizedName(name: string | null): string | null {
  if (!name) return null;
  if (isJapanese(name)) return null;
  return name;
}

const CERT_LABELS: Record<string, { label: string; tier: 'tokuju' | 'juyo' | 'tokuho' | 'hozon' }> = {
  // Tokubetsu Juyo - highest tier (purple)
  Tokuju: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
  tokuju: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
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

export function ListingCard({
  listing,
  currency,
  exchangeRates,
  priority = false,
  showFavoriteButton = true,
  isNearViewport = true // Default to true for backward compatibility
}: ListingCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const activity = useActivityOptional();
  const quickView = useQuickViewOptional();

  const imageUrl = listing.images?.[0] || null;
  const artisan = getRomanizedName(listing.smith) || getRomanizedName(listing.tosogu_maker);
  const school = getRomanizedName(listing.school) || getRomanizedName(listing.tosogu_school);
  const itemType = normalizeItemType(listing.item_type);
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const cleanedTitle = cleanTitle(listing.title, listing.smith, listing.tosogu_maker);
  const certInfo = listing.cert_type ? CERT_LABELS[listing.cert_type] : null;
  const isAskPrice = listing.price_value === null;
  const marketTime = getMarketTimeDisplay(listing as Parameters<typeof getMarketTimeDisplay>[0]);

  // Handle card click - open quick view or track activity
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't handle if clicking on the favorite button
    if ((e.target as HTMLElement).closest('[data-favorite-button]')) {
      return;
    }

    // Track click activity
    if (activity) {
      activity.trackExternalLinkClick(
        listing.url,
        Number(listing.id),
        listing.dealers?.name
      );
    }

    // Open quick view if available
    if (quickView) {
      // Convert local Listing type to the imported Listing type for context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.openQuickView(listing as any);
    }
  }, [activity, quickView, listing]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="listing-card"
      data-listing-id={listing.id}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className="group block bg-paper border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer"
    >
      {/* Dealer Domain - Elegant centered header */}
      <div className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-gradient-to-b from-linen/80 to-transparent text-center">
        <span className="text-[10px] lg:text-[12px] font-medium tracking-[0.12em] text-charcoal lowercase">
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
        {(hasError || !imageUrl) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-linen">
            <svg className="w-12 h-12 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : isNearViewport ? (
          <Image
            src={imageUrl}
            alt={listing.title || 'Listing image'}
            fill
            className={`object-cover group-hover:scale-105 transition-all duration-500 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
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

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">Sold</span>
          </div>
        )}

        {/* Favorite button */}
        {showFavoriteButton && !isSold && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <FavoriteButton listingId={Number(listing.id)} size="sm" />
          </div>
        )}
      </div>

      {/* Content - Fixed height with flex layout for consistent card sizes */}
      <div className="p-2.5 lg:p-4 flex flex-col h-[120px] lg:h-[130px]">
        {/* Top section - cert badge and item type */}
        <div className="flex-1 min-h-0">
          {/* Certification badge - fixed height slot */}
          <div className="h-[22px] lg:h-[26px] mb-1">
            {certInfo && (
              <span className={`text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold px-1.5 lg:px-2 py-0.5 lg:py-1 ${
                certInfo.tier === 'tokuju'
                  ? 'bg-tokuju-bg text-tokuju'
                  : certInfo.tier === 'juyo'
                  ? 'bg-juyo-bg text-juyo'
                  : certInfo.tier === 'tokuho'
                  ? 'bg-toku-hozon-bg text-toku-hozon'
                  : 'bg-hozon-bg text-hozon'
              }`}>
                {certInfo.label}
              </span>
            )}
          </div>

          {/* Item Type - Primary identifier (always English), fallback to cleaned title */}
          <h3 className="text-[15px] lg:text-base font-semibold leading-snug text-ink group-hover:text-gold transition-colors mb-1">
            {itemType || cleanedTitle}
          </h3>

          {/* Smith/School - Key attribution - fixed height slot */}
          <div className="h-[18px] lg:h-[20px]">
            {(artisan || school) && (
              <p className="text-[12px] lg:text-[13px] text-charcoal truncate">
                {artisan || school}
              </p>
            )}
          </div>
        </div>

        {/* Price + Time on Market - always at bottom */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 mt-auto">
          <span className={`text-[15px] lg:text-base tabular-nums ${
            isAskPrice
              ? 'text-charcoal'
              : 'text-ink font-semibold'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates)}
          </span>
          {marketTime && (
            <span className="text-[11px] lg:text-[12px] text-muted tabular-nums flex items-center gap-1">
              <span className="text-muted/60">&#x25F7;</span>
              {marketTime.shortLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
