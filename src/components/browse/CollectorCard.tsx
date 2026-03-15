'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useViewportTrackingOptional } from '@/lib/viewport';
import { getAllImages, getCachedValidation, isRenderFailed, setRenderFailed, dealerDoesNotPublishImages, getPlaceholderKanji } from '@/lib/images';
import { getHeroImageIndex } from '@/lib/images/classification';
import { shouldShowNewBadge } from '@/lib/newListing';
import { isTrialModeActive } from '@/types/subscription';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import type { CertTier } from '@/lib/cert/validation';
import { useLocale } from '@/i18n/LocaleContext';
import type { DisplayItem } from '@/types/displayItem';

// Same interface as ListingCard — drop-in replacement
interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

interface CollectorCardProps {
  listing: DisplayItem;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
  priority?: boolean;
  showFavoriteButton?: boolean;
  searchId?: string;
  isAdmin?: boolean;
  mobileView?: 'grid' | 'gallery';
  fontSize?: 'compact' | 'standard' | 'large';
  imageAspect?: string;
  focalPosition?: string;
  gridPosition?: number;
  onClick?: (listing: DisplayItem) => void;
}

// ── Cert border color mapping ──────────────────────────────────────────
const CERT_BORDER_COLOR: Record<CertTier, string> = {
  tokuju: 'var(--tokuju)',
  jubi: 'var(--jubi)',
  juyo: 'var(--juyo)',
  tokuho: 'var(--toku-hozon)',
  hozon: 'var(--hozon)',
};

// ── Shared item type labels (subset of ListingCard) ────────────────────
const TYPE_NORMALIZE: Record<string, string> = {
  '刀': 'katana', '脇差': 'wakizashi', '短刀': 'tanto', '太刀': 'tachi',
  '槍': 'yari', '薙刀': 'naginata', '鍔': 'tsuba', '小柄': 'kozuka',
  '目貫': 'menuki', '甲冑': 'armor', '兜': 'kabuto', '拵': 'koshirae',
  '拵え': 'koshirae', 'fuchi_kashira': 'fuchi-kashira',
};
const TYPE_LABELS: Record<string, string> = {
  katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tanto', tachi: 'Tachi',
  naginata: 'Naginata', yari: 'Yari', kodachi: 'Kodachi', ken: 'Ken',
  daisho: 'Daisho', tsuba: 'Tsuba', 'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira', kozuka: 'Kozuka', kogai: 'Kogai',
  menuki: 'Menuki', fuchi: 'Fuchi', kashira: 'Kashira', koshirae: 'Koshirae',
  tosogu: 'Tosogu', armor: 'Armor', kabuto: 'Kabuto', helmet: 'Kabuto',
};

function normalizeItemType(rawType: string | null): string | null {
  if (!rawType) return null;
  const normalized = TYPE_NORMALIZE[rawType] || rawType.toLowerCase();
  return TYPE_LABELS[normalized] || TYPE_LABELS[rawType.toLowerCase()] || null;
}

// ── Price formatting (shared logic) ────────────────────────────────────
function convertPrice(value: number, sourceCurrency: string, targetCurrency: Currency, rates: ExchangeRates | null): number {
  if (!rates || sourceCurrency === targetCurrency) return value;
  const sourceRate = rates.rates[sourceCurrency.toUpperCase()] || 1;
  const targetRate = rates.rates[targetCurrency.toUpperCase()] || 1;
  return (value / sourceRate) * targetRate;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();
function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
}

function formatPrice(value: number | null, sourceCurrency: string | null, targetCurrency: Currency, rates: ExchangeRates | null): string {
  if (value === null) return '';
  const source = sourceCurrency || 'USD';
  return getCurrencyFormatter(targetCurrency).format(Math.round(convertPrice(value, source, targetCurrency, rates)));
}

// ── Title cleaning ─────────────────────────────────────────────────────
function cleanTitle(title: string | null, untitledLabel: string): string {
  if (!title) return untitledLabel;
  let cleaned = title;
  cleaned = cleaned.replace(/^(Katana|Wakizashi|Tanto|Tachi|Tsuba|Kozuka|Menuki|Koshirae|Naginata|Yari):\s*/i, '');
  cleaned = cleaned.replace(/\s*\(NBTHK [^)]+\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\([^)]*Hozon[^)]*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\([^)]*Juyo[^)]*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || title;
}

// ── Flavor text (curator headline > description excerpt) ───────────────
function getFlavorText(listing: DisplayItem, locale: string): string | null {
  // Priority 1: AI curator headline
  const headline = locale === 'ja'
    ? (listing.ai_curator_headline_ja || listing.ai_curator_headline_en)
    : (listing.ai_curator_headline_en || listing.ai_curator_headline_ja);
  if (headline) return headline;

  // Priority 2: Description excerpt
  const desc = locale === 'ja'
    ? (listing.description_ja || listing.description_en || listing.description)
    : (listing.description_en || listing.description_ja || listing.description);
  if (desc && desc.length > 10) {
    return desc.length > 120 ? desc.slice(0, 120).trimEnd() + '...' : desc;
  }

  return null;
}

// ── Type line builder ──────────────────────────────────────────────────
function buildTypeLine(listing: DisplayItem, t: (key: string) => string): string {
  const parts: string[] = [];

  // Item type
  const rawType = listing.item_type;
  if (rawType) {
    const norm = TYPE_NORMALIZE[rawType] || rawType.toLowerCase();
    const key = `itemType.${norm}`;
    const translated = t(key);
    parts.push(translated !== key ? translated : (normalizeItemType(rawType) || rawType));
  }

  // School
  const school = listing.school || listing.tosogu_school;
  if (school) parts.push(school);

  // Era
  if (listing.era) {
    const eraKey = `era.${listing.era}`;
    const translated = t(eraKey);
    parts.push(translated !== eraKey ? translated : listing.era);
  }

  return parts.join(' \u00B7 '); // middle dot separator
}

// ── Blur placeholder ───────────────────────────────────────────────────
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

// 7 days — early access window
const EARLY_ACCESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function isEarlyAccessListing(firstSeenAt: string): boolean {
  return new Date(firstSeenAt).getTime() > Date.now() - EARLY_ACCESS_WINDOW_MS;
}

// ════════════════════════════════════════════════════════════════════════
// CollectorCard — MTG-inspired museum placard card
// ════════════════════════════════════════════════════════════════════════
export const CollectorCard = memo(function CollectorCard({
  listing,
  currency,
  exchangeRates,
  priority = false,
  showFavoriteButton = true,
  searchId,
  isAdmin = false,
  focalPosition,
  gridPosition,
  onClick,
}: CollectorCardProps) {
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

  // ── Viewport tracking ────────────────────────────────────────────────
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !viewportTracking) return;
    viewportTracking.trackElement(element, Number(listing.id), {
      position: gridPosition,
      dealerId: listing.dealer_id ?? undefined,
    });
    return () => { viewportTracking.untrackElement(element); };
  }, [listing.id, listing.dealer_id, gridPosition, viewportTracking]);

  // ── Memoized derivations ─────────────────────────────────────────────
  const { allImages, certInfo, cardTitle, typeLine, flavorText, itemType } = useMemo(() => {
    const ci = getValidatedCertInfo(listing);
    const rawTitle = locale === 'en' && listing.title_en ? listing.title_en
      : locale === 'ja' && listing.title_ja ? listing.title_ja
      : listing.title;
    return {
      allImages: getAllImages(listing),
      certInfo: ci,
      cardTitle: cleanTitle(rawTitle, t('listing.untitled')),
      typeLine: buildTypeLine(listing, t),
      flavorText: getFlavorText(listing, locale),
      itemType: normalizeItemType(listing.item_type),
    };
  }, [listing, locale, t]);

  // ── Hero image selection ─────────────────────────────────────────────
  const imageUrl = useMemo(() => {
    if (listing.thumbnail_url) return listing.thumbnail_url;
    const heroIdx = getHeroImageIndex(listing);
    if (heroIdx < allImages.length) {
      const heroUrl = allImages[heroIdx];
      if (heroUrl && getCachedValidation(heroUrl) !== 'invalid' && !isRenderFailed(heroUrl)) return heroUrl;
    }
    for (const url of allImages) {
      if (getCachedValidation(url) === 'invalid' || isRenderFailed(url)) continue;
      return url;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.thumbnail_url, listing.hero_image_index, allImages, fallbackIndex]);

  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const isUnavailable = !listing.is_available;

  // ── Border color: gold default, cert color on hover ──────────────────
  const certColor = certInfo ? CERT_BORDER_COLOR[certInfo.tier] : null;

  // ── Click handling ───────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-favorite-button]')) return;
    if (onClick) { onClick(listing); return; }
    if (searchId && activity) activity.trackSearchClickThrough(searchId, Number(listing.id));
    if (activity) activity.trackQuickViewOpen(Number(listing.id), listing.dealer_display_name, 'listing_card');
    if (quickView) quickView.openQuickView(listing as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [activity, quickView, listing, searchId, onClick]);

  const handleMouseEnter = useCallback(() => {
    if (!quickView) return;
    hoverTimerRef.current = setTimeout(() => preloadListing(listing), 150);
  }, [quickView, preloadListing, listing]);

  const handleTouchStart = useCallback(() => {
    if (!quickView) return;
    preloadListing(listing);
  }, [quickView, preloadListing, listing]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    cancelPreloads();
  }, [cancelPreloads]);

  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  // ── New badge ────────────────────────────────────────────────────────
  const isNew = shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import);

  // ── Stat bar content ─────────────────────────────────────────────────
  // Left: nagasa (vault/showcase) or price (browse/dealer)
  // Right: dealer name (browse) or visibility badge (vault/showcase) or status (dealer)
  const isVaultOrShowcase = listing.source === 'collection' || listing.source === 'showcase';
  const statLeft = isVaultOrShowcase
    ? (listing.nagasa_cm ? `${listing.nagasa_cm} cm` : (itemType || ''))
    : (isSold ? t('listing.sold') : formatPrice(listing.price_value, listing.price_currency, currency, exchangeRates) || t('listing.ask'));
  const statRight = isVaultOrShowcase
    ? null // visibility handled separately
    : (listing.source === 'dealer'
        ? (listing.is_sold ? t('dealer.statusSold') : listing.is_available ? t('dealer.tabForSale') : t('dealer.tabInventory'))
        : (listing.dealer_display_name || ''));

  // ── Placeholder kanji ────────────────────────────────────────────────
  const placeholderKanji = getPlaceholderKanji(listing.item_type);

  // ── Image element ────────────────────────────────────────────────────
  const altText = [itemType, certInfo?.label, cardTitle].filter(Boolean).join(' - ') || 'Japanese sword listing';

  const imageElement = dealerDoesNotPublishImages(listing.dealer_domain) ? (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linen text-center">
      <span className="font-serif text-[60px] leading-none text-muted/10 select-none" aria-hidden="true">{placeholderKanji}</span>
      <span className="text-[9px] text-muted/40 tracking-widest uppercase mt-3">{t('listing.photosNotPublished')}</span>
    </div>
  ) : (hasError || !imageUrl) ? (
    <div className="absolute inset-0 flex items-center justify-center bg-linen">
      <span className="font-serif text-[60px] leading-none text-muted/10 select-none" aria-hidden="true">{placeholderKanji}</span>
    </div>
  ) : (
    <Image
      key={imageUrl}
      src={imageUrl}
      alt={altText}
      fill
      className={`object-cover transition-[opacity,transform] duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      style={{ objectPosition: focalPosition || 'top' }}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      priority={priority}
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? undefined : 'lazy'}
      placeholder="blur"
      blurDataURL={BLUR_PLACEHOLDER}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        if (imageUrl) setRenderFailed(imageUrl);
        const hasRemaining = allImages.some(url => getCachedValidation(url) !== 'invalid' && !isRenderFailed(url));
        if (hasRemaining) setFallbackIndex(prev => prev + 1);
        else { setIsLoading(false); setHasError(true); }
      }}
    />
  );

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — Museum placard / MTG-inspired frame
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      data-testid="collector-card"
      data-listing-id={listing.id}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e as unknown as React.MouseEvent); }
      }}
      className="group block cursor-pointer h-full"
    >
      {/* Outer frame — layered shadow + cert color border on hover */}
      <div
        className="rounded-lg overflow-hidden transition-[border-color] duration-300 border border-border/60 collector-card-frame h-full"
        onMouseEnter={(e) => {
          if (certColor) (e.currentTarget as HTMLElement).style.borderColor = certColor;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = '';
        }}
      >
        {/* Inner mat padding — noise texture overlay */}
        <div className="p-[3px] bg-cream collector-card-texture h-full flex flex-col">

          {/* ── Name Bar ──────────────────────────────────────── */}
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <h3 className="font-serif text-[14px] sm:text-[15px] leading-snug text-ink truncate">
              {cardTitle}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {isNew && (
                <span
                  data-testid="new-listing-badge"
                  className="text-[8px] uppercase tracking-wider font-semibold px-1 py-0.5 bg-new-listing-bg text-new-listing rounded-sm"
                >
                  {isEarlyAccessListing(listing.first_seen_at) && !isTrialModeActive() ? t('badge.earlyAccess') : t('badge.new')}
                </span>
              )}
              {certInfo && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CERT_BORDER_COLOR[certInfo.tier] }}
                  title={certInfo.label}
                />
              )}
            </div>
          </div>

          {/* Hairline separator */}
          <div className="h-px bg-border/40 mx-2" />

          {/* ── Image Window (recessed well) ─────────────────── */}
          <div className="relative aspect-[4/5] overflow-hidden bg-linen mx-[1px] collector-card-image-well">
            {isLoading && imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />}
            {imageElement}
            {/* Sold overlay */}
            {isUnavailable && listing.source === 'browse' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-white/90 font-medium">
                  {isSold ? t('badge.sold') : t('listing.unavailable')}
                </span>
              </div>
            )}
            {/* Favorite button */}
            {showFavoriteButton && !isUnavailable && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <FavoriteButton listingId={Number(listing.id)} size="sm" />
              </div>
            )}
          </div>

          {/* ── Flexible middle (absorbs height differences) ── */}
          <div className="flex-1">
            {/* ── Type Line ─────────────────────────────────────── */}
            {typeLine && (
              <>
                <div className="h-px bg-border/40 mx-2" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-muted truncate">
                    {typeLine}
                  </p>
                </div>
              </>
            )}

            {/* ── Text Box (curator headline / description) ───── */}
            {flavorText && (
              <>
                <div className="h-px bg-border/40 mx-2" />
                <div className="px-3 py-2">
                  <p className="text-[11px] sm:text-[12px] leading-relaxed text-charcoal italic line-clamp-3 font-serif">
                    {flavorText}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Stat Bar ──────────────────────────────────────── */}
          <div className="h-px bg-border/40 mx-2" />
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[12px] sm:text-[13px] tabular-nums text-ink font-medium">
              {statLeft}
            </span>
            {statRight && (
              <span className="text-[10px] sm:text-[11px] text-muted tracking-wide truncate max-w-[50%] text-right">
                {statRight}
              </span>
            )}
          </div>

        </div>{/* end inner mat */}
      </div>{/* end outer frame */}
    </div>
  );

}, (prevProps, nextProps) => {
  return (
    prevProps.listing.id === nextProps.listing.id &&
    prevProps.currency === nextProps.currency &&
    prevProps.priority === nextProps.priority &&
    prevProps.showFavoriteButton === nextProps.showFavoriteButton &&
    prevProps.exchangeRates?.timestamp === nextProps.exchangeRates?.timestamp &&
    prevProps.listing.artisan_id === nextProps.listing.artisan_id &&
    prevProps.listing.artisan_display_name === nextProps.listing.artisan_display_name &&
    prevProps.listing.cert_type === nextProps.listing.cert_type &&
    prevProps.listing.status === nextProps.listing.status &&
    prevProps.listing.is_sold === nextProps.listing.is_sold &&
    prevProps.listing.is_available === nextProps.listing.is_available &&
    prevProps.listing.ai_curator_headline_en === nextProps.listing.ai_curator_headline_en &&
    prevProps.listing.ai_curator_headline_ja === nextProps.listing.ai_curator_headline_ja &&
    prevProps.listing.thumbnail_url === nextProps.listing.thumbnail_url
  );
});
