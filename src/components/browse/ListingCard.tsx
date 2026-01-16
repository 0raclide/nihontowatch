'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface Listing {
  id: string;
  url: string;
  title: string;
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

const CERT_LABELS: Record<string, { label: string; tier: 'premier' | 'high' | 'standard' }> = {
  Juyo: { label: 'Jūyō', tier: 'premier' },
  juyo: { label: 'Jūyō', tier: 'premier' },
  Tokuju: { label: 'Tokubetsu Jūyō', tier: 'premier' },
  tokuju: { label: 'Tokubetsu Jūyō', tier: 'premier' },
  tokubetsu_juyo: { label: 'Tokubetsu Jūyō', tier: 'premier' },
  TokuHozon: { label: 'Tokubetsu Hozon', tier: 'high' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', tier: 'high' },
  Hozon: { label: 'Hozon', tier: 'standard' },
  hozon: { label: 'Hozon', tier: 'standard' },
  TokuKicho: { label: 'Tokubetsu Kichō', tier: 'high' },
  nbthk: { label: 'NBTHK', tier: 'standard' },
  nthk: { label: 'NTHK', tier: 'standard' },
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

function cleanTitle(title: string, smith: string | null, maker: string | null): string {
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

export function ListingCard({ listing, currency, exchangeRates, priority = false }: ListingCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageUrl = listing.images?.[0] || null;
  const artisan = getRomanizedName(listing.smith) || getRomanizedName(listing.tosogu_maker);
  const school = getRomanizedName(listing.school) || getRomanizedName(listing.tosogu_school);
  const itemType = normalizeItemType(listing.item_type);
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const cleanedTitle = cleanTitle(listing.title, listing.smith, listing.tosogu_maker);
  const certInfo = listing.cert_type ? CERT_LABELS[listing.cert_type] : null;
  const isAskPrice = listing.price_value === null;

  return (
    <Link
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white theme-dark:bg-gray-800/50 border border-border theme-dark:border-gray-700/50 hover:border-gold/40 theme-dark:hover:border-gold/40 transition-all duration-300"
    >
      {/* Dealer Domain - Elegant centered header */}
      <div className="px-2.5 py-2 lg:px-3 lg:py-2.5 bg-gradient-to-b from-linen/80 to-transparent theme-dark:from-gray-800/60 theme-dark:to-transparent text-center">
        <span className="text-[9px] lg:text-[10px] font-medium tracking-[0.15em] text-charcoal/70 theme-dark:text-gray-400 lowercase">
          {listing.dealers?.domain}
        </span>
      </div>

      {/* Image Container with skeleton loader */}
      <div className="relative aspect-[4/3] overflow-hidden bg-linen theme-dark:bg-gray-900">
        {/* Skeleton loader - shows while loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-linen via-white to-linen theme-dark:from-gray-800 theme-dark:via-gray-700 theme-dark:to-gray-800 animate-shimmer" />
        )}

        {/* Fallback for missing/broken images */}
        {(hasError || !imageUrl) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-linen theme-dark:bg-gray-800">
            <svg className="w-12 h-12 text-muted/30 theme-dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            className={`object-cover group-hover:scale-105 transition-all duration-500 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">Sold</span>
          </div>
        )}
      </div>

      {/* Content - Compact */}
      <div className="p-2.5 lg:p-3">
        {/* Certification badge */}
        {certInfo && (
          <div className="mb-1.5">
            <span className={`text-[8px] lg:text-[9px] uppercase tracking-wider font-medium px-1 lg:px-1.5 py-0.5 ${
              certInfo.tier === 'premier'
                ? 'bg-burgundy/10 text-burgundy theme-dark:bg-burgundy/20 theme-dark:text-red-300'
                : certInfo.tier === 'high'
                ? 'bg-toku-hozon/10 text-toku-hozon theme-dark:bg-teal-900/30 theme-dark:text-teal-300'
                : 'bg-hozon/10 text-hozon theme-dark:bg-gray-700/50 theme-dark:text-gray-400'
            }`}>
              {certInfo.label}
            </span>
          </div>
        )}

        {/* Item Type - Primary identifier (always English), fallback to cleaned title */}
        <h3 className="text-sm lg:text-[15px] font-semibold leading-tight text-ink theme-dark:text-white group-hover:text-gold transition-colors mb-1">
          {itemType || cleanedTitle}
        </h3>

        {/* Smith/School - Key attribution */}
        {(artisan || school) && (
          <p className="text-[11px] lg:text-[12px] text-charcoal theme-dark:text-gray-300 truncate mb-1">
            {artisan || school}
          </p>
        )}

        {/* Price - highly legible */}
        <div className="pt-2 border-t border-border/50 theme-dark:border-gray-700/30">
          <span className={`text-sm lg:text-[15px] tabular-nums ${
            isAskPrice
              ? 'text-muted theme-dark:text-gray-500'
              : 'text-ink theme-dark:text-white font-semibold'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates)}
          </span>
        </div>
      </div>
    </Link>
  );
}
