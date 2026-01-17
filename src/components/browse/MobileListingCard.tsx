'use client';

import Image from 'next/image';
import { useState, useCallback } from 'react';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { getMarketTimeDisplay } from '@/lib/freshness';

// Fixed height for virtual scrolling - must match useVirtualScroll itemHeight
export const MOBILE_CARD_HEIGHT = 320;

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

interface MobileListingCardProps {
  listing: Listing;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
}

// Item type display labels
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

// Normalize item types (handles Japanese characters and variants)
const ITEM_TYPE_NORMALIZE: Record<string, string> = {
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
  'fuchi_kashira': 'fuchi-kashira',
  'Katana': 'katana',
  'Wakizashi': 'wakizashi',
  'Tanto': 'tanto',
  'Tachi': 'tachi',
  'Tsuba': 'tsuba',
};

// Certification tier styling
const CERT_LABELS: Record<string, { label: string; tier: 'tokuju' | 'juyo' | 'tokuho' | 'hozon' }> = {
  Tokuju: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
  tokuju: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokubetsu Jūyō', tier: 'tokuju' },
  Juyo: { label: 'Jūyō', tier: 'juyo' },
  juyo: { label: 'Jūyō', tier: 'juyo' },
  TokuHozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
  TokuKicho: { label: 'Tokubetsu Kichō', tier: 'tokuho' },
  Hozon: { label: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', tier: 'hozon' },
  nbthk: { label: 'NBTHK', tier: 'hozon' },
  nthk: { label: 'NTHK', tier: 'hozon' },
};

// Tiny placeholder for blur effect
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

function normalizeItemType(rawType: string | null): string | null {
  if (!rawType) return null;
  const normalized = ITEM_TYPE_NORMALIZE[rawType] || rawType.toLowerCase();
  return ITEM_TYPE_LABELS[normalized] || ITEM_TYPE_LABELS[rawType.toLowerCase()] || null;
}

function isJapanese(str: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);
}

function getRomanizedName(name: string | null): string | null {
  if (!name) return null;
  if (isJapanese(name)) return null;
  return name;
}

function convertPrice(
  value: number,
  sourceCurrency: string,
  targetCurrency: Currency,
  rates: ExchangeRates | null
): number {
  if (!rates || sourceCurrency === targetCurrency) return value;
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

export function MobileListingCard({
  listing,
  currency,
  exchangeRates,
}: MobileListingCardProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const quickView = useQuickViewOptional();

  const imageUrl = listing.images?.[0] || null;
  const artisan = getRomanizedName(listing.smith) || getRomanizedName(listing.tosogu_maker);
  const school = getRomanizedName(listing.school) || getRomanizedName(listing.tosogu_school);
  const itemType = normalizeItemType(listing.item_type);
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const certInfo = listing.cert_type ? CERT_LABELS[listing.cert_type] : null;
  const isAskPrice = listing.price_value === null;
  const marketTime = getMarketTimeDisplay(listing as Parameters<typeof getMarketTimeDisplay>[0]);

  const handleClick = useCallback(() => {
    if (quickView) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.openQuickView(listing as any);
    }
  }, [quickView, listing]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="mobile-listing-card"
      data-listing-id={listing.id}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className="mobile-listing-card bg-paper border-b border-border active:bg-linen/50 transition-colors"
      style={{ height: MOBILE_CARD_HEIGHT }}
    >
      {/* Image Container - Fixed 4:3 aspect ratio with object-cover */}
      <div className="relative aspect-[4/3] overflow-hidden bg-linen">
        {/* Skeleton loader - shows until image loads */}
        {!isLoaded && !hasError && imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />
        )}

        {/* Fallback for missing/broken images */}
        {(hasError || !imageUrl) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-linen">
            <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt={listing.title || 'Listing image'}
            fill
            className={`object-cover ${isLoaded ? 'visible' : 'invisible'}`}
            sizes="100vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setIsLoaded(true);
              setHasError(true);
            }}
          />
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-sm uppercase tracking-widest text-white/90 font-medium">Sold</span>
          </div>
        )}

        {/* Dealer badge - top left */}
        <div className="absolute top-3 left-3">
          <span className="text-[11px] font-medium tracking-wide text-white bg-black/50 px-2 py-1 rounded">
            {listing.dealers?.domain}
          </span>
        </div>
      </div>

      {/* Content - Fixed height for consistent card sizing */}
      <div className="p-4 h-[140px] flex flex-col">
        {/* Top row: Certification + Price */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-shrink-0">
            {certInfo && (
              <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 ${
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
          <span className={`text-lg tabular-nums flex-shrink-0 ${
            isAskPrice ? 'text-charcoal' : 'text-ink font-semibold'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates)}
          </span>
        </div>

        {/* Item Type - Primary identifier */}
        <h3 className="text-base font-semibold leading-snug text-ink mb-1 line-clamp-1">
          {itemType || listing.title || 'Untitled'}
        </h3>

        {/* Artisan/School */}
        {(artisan || school) && (
          <p className="text-sm text-charcoal truncate mb-auto">
            {artisan || school}
          </p>
        )}

        {/* Market time - bottom */}
        {marketTime && (
          <div className="pt-2 mt-auto border-t border-border/50">
            <span className="text-xs text-charcoal flex items-center gap-1.5">
              <span className="text-charcoal/50 uppercase tracking-wide">Listed</span>
              <span className="tabular-nums font-medium">{marketTime.shortLabel}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
