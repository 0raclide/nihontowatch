'use client';

import { memo, useState, useCallback } from 'react';
import Image from 'next/image';
import type { CollectionItem } from '@/types/collection';
import { getPlaceholderKanji } from '@/lib/images';
import { getArtisanDisplayName } from '@/lib/artisan/displayName';

// Cert label mapping (same as ListingCard)
const CERT_LABELS: Record<string, { label: string; tier: 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon' }> = {
  Tokuju: { label: 'Tokuju', tier: 'tokuju' },
  tokuju: { label: 'Tokuju', tier: 'tokuju' },
  'Tokubetsu Juyo': { label: 'Tokuju', tier: 'tokuju' },
  'Juyo Bijutsuhin': { label: 'Jubi', tier: 'jubi' },
  'Juyo Bunkazai': { label: 'JuBun', tier: 'jubi' },
  Juyo: { label: 'Juyo', tier: 'juyo' },
  juyo: { label: 'Juyo', tier: 'juyo' },
  TokuHozon: { label: 'Tokuho', tier: 'tokuho' },
  'Tokubetsu Hozon': { label: 'Tokuho', tier: 'tokuho' },
  Hozon: { label: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', tier: 'hozon' },
  Kokuho: { label: 'Kokuho', tier: 'tokuju' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  owned: { label: 'Owned', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  sold: { label: 'Sold', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  lent: { label: 'Lent', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  consignment: { label: 'Consignment', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  project: 'Project',
};

// Item type display labels
function getItemTypeLabel(itemType: string | null): string {
  if (!itemType) return 'Item';
  const labels: Record<string, string> = {
    katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tanto', tachi: 'Tachi',
    naginata: 'Naginata', yari: 'Yari', ken: 'Ken', kodachi: 'Kodachi',
    tsuba: 'Tsuba', kozuka: 'Kozuka', kogai: 'Kogai', menuki: 'Menuki',
    'fuchi-kashira': 'Fuchi-Kashira', fuchi_kashira: 'Fuchi-Kashira',
    koshirae: 'Koshirae', armor: 'Armor', helmet: 'Kabuto', tosogu: 'Tosogu',
  };
  return labels[itemType.toLowerCase()] || itemType.charAt(0).toUpperCase() + itemType.slice(1);
}

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return '';
  const curr = currency || 'JPY';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${curr} ${value.toLocaleString()}`;
  }
}

interface CollectionCardProps {
  item: CollectionItem;
  onClick: (item: CollectionItem) => void;
  onEdit?: (item: CollectionItem) => void;
}

export const CollectionCard = memo(function CollectionCard({ item, onClick, onEdit }: CollectionCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const certInfo = item.cert_type ? CERT_LABELS[item.cert_type] : null;
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.owned;
  const itemTypeLabel = getItemTypeLabel(item.item_type);
  const displayName = item.artisan_display_name || (item.smith ? getArtisanDisplayName(item.smith, item.school) : null);
  const priceDisplay = formatPrice(item.current_value || item.price_paid, item.current_value_currency || item.price_paid_currency);
  const conditionLabel = item.condition ? CONDITION_LABELS[item.condition] : null;

  // First image URL (collection images are Supabase Storage paths or external URLs)
  const imageUrl = item.images?.[0] || null;
  const hasImage = imageUrl && !imageError;

  const handleImageError = useCallback(() => setImageError(true), []);
  const handleImageLoad = useCallback(() => setImageLoaded(true), []);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(item);
  }, [item, onEdit]);

  const certTextColor = certInfo
    ? certInfo.tier === 'tokuju' ? 'text-tokuju'
      : certInfo.tier === 'jubi' ? 'text-jubi'
      : certInfo.tier === 'juyo' ? 'text-juyo'
      : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
      : 'text-hozon'
    : '';

  return (
    <div
      className="group block bg-cream border border-border hover:border-gold/40 transition-all duration-300 cursor-pointer rounded overflow-hidden shadow-sm hover:shadow-md"
      onClick={() => onClick(item)}
    >
      {/* Header: Source + Cert */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {item.acquired_from ? (
            <span className="text-[10px] font-medium tracking-[0.14em] text-muted capitalize truncate">
              {item.acquired_from}
            </span>
          ) : (
            <span className="text-[10px] font-medium tracking-[0.14em] text-muted/50 italic">
              No source
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {certInfo && (
            <span className={`text-[9px] uppercase tracking-wider font-bold ${certTextColor}`}>
              {certInfo.label}
            </span>
          )}
          {/* Edit button */}
          {onEdit && (
            <button
              onClick={handleEdit}
              className="w-6 h-6 flex items-center justify-center rounded-full text-muted/40 hover:text-gold hover:bg-gold/10 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Edit item"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-linen">
        {hasImage ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-linen via-paper to-linen animate-shimmer" />
            )}
            <Image
              src={imageUrl}
              alt={item.title || itemTypeLabel}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover group-hover:scale-105 transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[72px] leading-none text-muted/10 select-none">
              {getPlaceholderKanji(item.item_type)}
            </span>
          </div>
        )}
        {/* Status badge overlay */}
        {item.status !== 'owned' && (
          <div className="absolute top-2 left-2">
            <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        )}
        {/* Condition badge */}
        {conditionLabel && item.condition !== 'good' && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-black/40 text-white/90 backdrop-blur-sm">
              {conditionLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pt-3 pb-3 flex flex-col gap-0.5">
        {/* Item Type */}
        <div className="text-[15px] font-semibold leading-snug text-ink group-hover:text-gold transition-colors truncate">
          {item.title || itemTypeLabel}
        </div>

        {/* Attribution */}
        <div className="h-[20px] flex items-baseline overflow-hidden">
          {displayName ? (
            <>
              <span className="text-[11px] text-muted font-normal mr-1 shrink-0">By</span>
              <span className="text-[11px] font-medium text-ink truncate">
                {displayName}
              </span>
            </>
          ) : item.school ? (
            <span className="text-[11px] text-muted truncate">{item.school}</span>
          ) : (
            <span className="text-[11px] text-muted/50 italic">Unknown maker</span>
          )}
        </div>

        {/* Price row */}
        <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
          <span className={`text-[14px] tabular-nums ${priceDisplay ? 'text-ink font-medium' : 'text-muted/50'}`}>
            {priceDisplay || 'No value set'}
          </span>
          {item.acquired_date && (
            <span className="text-[9px] text-muted tabular-nums">
              {new Date(item.acquired_date).getFullYear()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.updated_at === next.item.updated_at &&
    prev.item.images?.[0] === next.item.images?.[0]
  );
});
