'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CollectionItem } from '@/types/collection';
import { getPlaceholderKanji } from '@/lib/images';
import { getArtisanDisplayName } from '@/lib/artisan/displayName';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { useCollectionQuickView } from '@/contexts/CollectionQuickViewContext';

const CERT_LABELS: Record<string, string> = {
  Tokuju: 'Tokubetsu Juyo', tokuju: 'Tokubetsu Juyo',
  'Tokubetsu Juyo': 'Tokubetsu Juyo',
  Juyo: 'Juyo', juyo: 'Juyo',
  'Juyo Bijutsuhin': 'Juyo Bijutsuhin', 'Juyo Bunkazai': 'Juyo Bunkazai',
  TokuHozon: 'Tokubetsu Hozon', 'Tokubetsu Hozon': 'Tokubetsu Hozon',
  Hozon: 'Hozon', hozon: 'Hozon',
  Kokuho: 'Kokuho',
};

const STATUS_LABELS: Record<string, string> = {
  owned: 'Owned', sold: 'Sold', lent: 'Lent', consignment: 'On Consignment',
};

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint', excellent: 'Excellent', good: 'Good', fair: 'Fair', project: 'Project',
};

function getItemTypeLabel(t: string | null): string {
  if (!t) return 'Item';
  const map: Record<string, string> = {
    katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tanto', tachi: 'Tachi',
    naginata: 'Naginata', yari: 'Yari', ken: 'Ken', tsuba: 'Tsuba',
    kozuka: 'Kozuka', kogai: 'Kogai', menuki: 'Menuki',
    'fuchi-kashira': 'Fuchi-Kashira', koshirae: 'Koshirae',
    armor: 'Armor', tosogu: 'Tosogu',
  };
  return map[t.toLowerCase()] || t.charAt(0).toUpperCase() + t.slice(1);
}

function formatPrice(value: number | null, currency: string | null): string | null {
  if (!value) return null;
  const curr = currency || 'JPY';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${curr} ${value.toLocaleString()}`;
  }
}

function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return date;
  }
}

interface CollectionViewContentProps {
  item: CollectionItem;
}

export function CollectionViewContent({ item }: CollectionViewContentProps) {
  const { openEditForm } = useCollectionQuickView();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const images = item.images || [];
  const activeImage = images[activeImageIndex] || null;
  const displayName = item.artisan_display_name || (item.smith ? getArtisanDisplayName(item.smith, item.school) : null);
  const certLabel = item.cert_type ? (CERT_LABELS[item.cert_type] || item.cert_type) : null;
  const pricePaid = formatPrice(item.price_paid, item.price_paid_currency);
  const currentValue = formatPrice(item.current_value, item.current_value_currency);
  const acquiredDate = formatDate(item.acquired_date);
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const conditionLabel = item.condition ? (CONDITION_LABELS[item.condition] || item.condition) : null;

  const handleImageError = useCallback(() => setImageError(true), []);

  return (
    <div className="flex flex-col">
      {/* Image Gallery */}
      <div className="relative bg-linen">
        <div className="aspect-[4/3] relative">
          {activeImage && !imageError ? (
            <Image
              src={activeImage}
              alt={item.title || getItemTypeLabel(item.item_type)}
              fill
              className="object-contain"
              onError={handleImageError}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-[96px] text-muted/10 select-none">
                {getPlaceholderKanji(item.item_type)}
              </span>
            </div>
          )}
        </div>
        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setActiveImageIndex(i); setImageError(false); }}
                className={`relative w-14 h-14 rounded overflow-hidden shrink-0 border-2 transition-colors ${
                  i === activeImageIndex ? 'border-gold' : 'border-transparent hover:border-gold/30'
                }`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-4 lg:px-5 py-4 lg:py-5 space-y-4">
        {/* Title + Edit */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] lg:text-[20px] font-serif text-ink leading-snug">
              {item.title || getItemTypeLabel(item.item_type)}
            </h2>
            {displayName && (
              <p className="text-[13px] text-muted mt-0.5">
                By{' '}
                {item.artisan_id ? (
                  <Link href={`/artists/${generateArtisanSlug(item.artisan_display_name || item.smith, item.artisan_id)}`} className="text-gold hover:underline">
                    {displayName}
                  </Link>
                ) : (
                  <span>{displayName}</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => openEditForm(item)}
            className="shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-medium text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors"
          >
            Edit
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          {item.item_type && (
            <MetadataRow label="Type" value={getItemTypeLabel(item.item_type)} />
          )}
          {certLabel && (
            <MetadataRow label="Certification" value={`${certLabel}${item.cert_session ? ` ${item.cert_session}` : ''}`} />
          )}
          {item.cert_organization && (
            <MetadataRow label="Organization" value={item.cert_organization} />
          )}
          {item.school && <MetadataRow label="School" value={item.school} />}
          {item.province && <MetadataRow label="Province" value={item.province} />}
          {item.era && <MetadataRow label="Era" value={item.era} />}
          {item.mei_type && <MetadataRow label="Mei" value={item.mei_type} />}
        </div>

        {/* Measurements */}
        {(item.nagasa_cm || item.sori_cm || item.motohaba_cm || item.sakihaba_cm) && (
          <div className="pt-2 border-t border-border/30">
            <h3 className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted mb-2">Measurements</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
              {item.nagasa_cm && <MetadataRow label="Nagasa" value={`${item.nagasa_cm} cm`} />}
              {item.sori_cm && <MetadataRow label="Sori" value={`${item.sori_cm} cm`} />}
              {item.motohaba_cm && <MetadataRow label="Motohaba" value={`${item.motohaba_cm} cm`} />}
              {item.sakihaba_cm && <MetadataRow label="Sakihaba" value={`${item.sakihaba_cm} cm`} />}
            </div>
          </div>
        )}

        {/* Provenance */}
        <div className="pt-2 border-t border-border/30">
          <h3 className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted mb-2">Provenance</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            {item.acquired_from && <MetadataRow label="Acquired From" value={item.acquired_from} />}
            {acquiredDate && <MetadataRow label="Acquired Date" value={acquiredDate} />}
            {pricePaid && <MetadataRow label="Price Paid" value={pricePaid} />}
            {currentValue && <MetadataRow label="Current Value" value={currentValue} />}
            <MetadataRow label="Status" value={statusLabel} />
            {conditionLabel && <MetadataRow label="Condition" value={conditionLabel} />}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="pt-2 border-t border-border/30">
            <h3 className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted mb-2">Notes</h3>
            <p className="text-[13px] text-ink whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        {/* Catalog Reference */}
        {item.catalog_reference && (
          <div className="pt-2 border-t border-border/30">
            <h3 className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted mb-2">Catalog Reference</h3>
            <p className="text-[13px] text-ink">
              {item.catalog_reference.collection} Vol. {item.catalog_reference.volume}, #{item.catalog_reference.item_number}
            </p>
          </div>
        )}

        {/* Source listing link */}
        {item.source_listing_id && (
          <div className="pt-2 border-t border-border/30">
            <Link
              href={`/listing/${item.source_listing_id}`}
              className="text-[12px] text-gold hover:underline"
            >
              View original listing &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium truncate">{value}</span>
    </div>
  );
}
