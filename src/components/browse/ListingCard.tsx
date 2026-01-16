'use client';

import Image from 'next/image';
import Link from 'next/link';

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
}

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
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  armor: 'Armor',
  kabuto: 'Kabuto',
  other: 'Other',
};

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

export function ListingCard({ listing, currency, exchangeRates }: ListingCardProps) {
  const imageUrl = listing.images?.[0] || '/placeholder-sword.jpg';
  const artisan = listing.smith || listing.tosogu_maker;
  const school = listing.school || listing.tosogu_school;
  const itemType = listing.item_type
    ? ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || ITEM_TYPE_LABELS[listing.item_type] || listing.item_type
    : null;
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const cleanedTitle = cleanTitle(listing.title, listing.smith, listing.tosogu_maker);
  const certInfo = listing.cert_type ? CERT_LABELS[listing.cert_type] : null;
  const isAskPrice = listing.price_value === null;

  return (
    <Link
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white dark:bg-gray-800/50 border border-border dark:border-gray-700/50 hover:border-gold/40 dark:hover:border-gold/40 transition-all duration-300"
    >
      {/* Dealer Name - Prominent at top */}
      <div className="px-3 py-2 border-b border-border/50 dark:border-gray-700/30">
        <span className="text-[10px] font-medium tracking-wide text-charcoal/80 dark:text-gray-400 uppercase">
          {listing.dealers?.name}
        </span>
      </div>

      {/* Image Container - Compact */}
      <div className="relative aspect-[4/3] overflow-hidden bg-linen dark:bg-gray-900">
        <Image
          src={imageUrl}
          alt={listing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">Sold</span>
          </div>
        )}
      </div>

      {/* Content - Compact */}
      <div className="p-3">
        {/* Certification (top) then Item Type */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {certInfo && (
            <span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 ${
              certInfo.tier === 'premier'
                ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-red-300'
                : certInfo.tier === 'high'
                ? 'bg-toku-hozon/10 text-toku-hozon dark:bg-teal-900/30 dark:text-teal-300'
                : 'bg-hozon/10 text-hozon dark:bg-gray-700/50 dark:text-gray-400'
            }`}>
              {certInfo.label}
            </span>
          )}
          {itemType && (
            <span className="text-[9px] uppercase tracking-wider text-muted dark:text-gray-500">
              {itemType}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-serif text-sm leading-snug text-ink dark:text-gray-100 group-hover:text-gold transition-colors line-clamp-2 mb-1">
          {cleanedTitle}
        </h3>

        {/* School or Artisan - subtle */}
        {(school || artisan) && (
          <p className="text-[11px] text-muted dark:text-gray-500 truncate mb-2">
            {school || artisan}
          </p>
        )}

        {/* Price */}
        <div className="pt-2 border-t border-border/50 dark:border-gray-700/30">
          <span className={`font-serif text-sm ${
            isAskPrice
              ? 'text-muted italic dark:text-gray-500'
              : 'text-ink dark:text-white font-medium'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates)}
          </span>
        </div>
      </div>
    </Link>
  );
}
