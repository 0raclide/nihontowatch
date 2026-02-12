'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { CollectionItem } from '@/types/collection';
import { getArtisanDisplayName } from '@/lib/artisan/displayName';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { CERT_LABELS, STATUS_LABELS, CONDITION_LABELS, getCertTierClass, getItemTypeLabel, formatPrice, formatDate } from '@/lib/collection/labels';
import { useCollectionQuickView } from '@/contexts/CollectionQuickViewContext';

// =============================================================================
// Component
// =============================================================================

interface CollectionItemContentProps {
  item: CollectionItem;
}

export function CollectionItemContent({ item }: CollectionItemContentProps) {
  const { openEditForm, closeQuickView, onSaved } = useCollectionQuickView();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset delete confirmation when navigating to a different item
  useEffect(() => {
    setConfirmDelete(false);
    setIsDeleting(false);
  }, [item.id]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/collection/items/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        onSaved();
        closeQuickView();
      }
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
    }
  }, [item.id, onSaved, closeQuickView]);

  const displayName = item.artisan_display_name || (item.smith ? getArtisanDisplayName(item.smith, item.school) : null);
  const certInfo = item.cert_type ? CERT_LABELS[item.cert_type] : null;
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const conditionLabel = item.condition ? (CONDITION_LABELS[item.condition] || item.condition) : null;
  const pricePaid = formatPrice(item.price_paid, item.price_paid_currency);
  const currentValue = formatPrice(item.current_value, item.current_value_currency);
  const acquiredDate = formatDate(item.acquired_date);
  const itemTypeLabel = getItemTypeLabel(item.item_type);

  // Price to display prominently (prefer current value, fallback to price paid)
  const heroPrice = currentValue || pricePaid;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section — mirroring browse QuickViewContent */}
        <div className="bg-linen/50 px-4 py-3">
          {/* Badges row: type + cert + condition + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted uppercase tracking-wide font-medium px-2 py-0.5 bg-cream rounded">
                {itemTypeLabel}
              </span>
              {certInfo && (
                <span className={`text-[10px] uppercase tracking-wider font-bold ${getCertTierClass(certInfo.tier)}`}>
                  {certInfo.shortLabel}
                </span>
              )}
              {conditionLabel && item.condition !== 'good' && (
                <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-ink/5 text-muted">
                  {conditionLabel}
                </span>
              )}
              {item.status !== 'owned' && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {statusLabel}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openEditForm(item)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                aria-label="Edit item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Delete item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? '...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-[10px] uppercase tracking-wider font-medium text-muted hover:text-ink transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="mt-2">
            <span className={`text-2xl lg:text-3xl font-semibold tabular-nums ${heroPrice ? 'text-ink' : 'text-muted'}`}>
              {heroPrice || 'No value set'}
            </span>
            {currentValue && pricePaid && currentValue !== pricePaid && (
              <span className="ml-2 text-[12px] text-muted">
                (paid {pricePaid})
              </span>
            )}
          </div>

          {/* Source */}
          <div className="flex items-center mt-1.5 text-[12px] text-muted">
            {item.acquired_from ? (
              <>
                <svg className="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="truncate">From {item.acquired_from}</span>
              </>
            ) : (
              <span className="text-muted/60">Personal collection</span>
            )}
          </div>
        </div>

        {/* Metadata Grid — mirroring MetadataGrid layout */}
        <div className="px-4 py-3 border-b border-border">
          {/* Attribution section */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Smith/Maker — full width */}
            {displayName && (
              <div className="col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
                  {item.item_type && ['tsuba', 'kozuka', 'kogai', 'menuki', 'fuchi-kashira', 'tosogu'].includes(item.item_type.toLowerCase()) ? 'Maker' : 'Smith'}
                </span>
                <span className="text-[13px] text-ink font-medium">
                  {item.artisan_id ? (
                    <Link
                      href={`/artists/${generateArtisanSlug(item.artisan_display_name || item.smith, item.artisan_id)}`}
                      className="text-gold hover:underline"
                    >
                      {displayName}
                    </Link>
                  ) : (
                    displayName
                  )}
                </span>
              </div>
            )}
            {item.era && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Era</span>
                <span className="text-[13px] text-ink font-medium">{item.era}</span>
              </div>
            )}
            {item.province && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Province</span>
                <span className="text-[13px] text-ink font-medium">{item.province}</span>
              </div>
            )}
            {item.school && !displayName && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">School</span>
                <span className="text-[13px] text-ink font-medium">{item.school}</span>
              </div>
            )}
            {item.mei_type && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Signature</span>
                <span className="text-[13px] text-ink font-medium capitalize">{item.mei_type}</span>
              </div>
            )}
            {certInfo && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Papers</span>
                <span className="text-[13px] text-ink font-medium">
                  {certInfo.label}
                  {item.cert_session ? ` ${item.cert_session}` : ''}
                  {item.cert_organization ? ` (${item.cert_organization})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Measurements — inline flex like browse */}
          {(item.nagasa_cm || item.sori_cm || item.motohaba_cm || item.sakihaba_cm) && (
            <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-x-4 gap-y-1">
              {item.nagasa_cm && (
                <span className="text-[12px]">
                  <span className="text-muted">Nagasa</span>{' '}
                  <span className="text-ink font-medium tabular-nums">{item.nagasa_cm}</span>
                  <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                </span>
              )}
              {item.sori_cm && (
                <span className="text-[12px]">
                  <span className="text-muted">Sori</span>{' '}
                  <span className="text-ink font-medium tabular-nums">{item.sori_cm}</span>
                  <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                </span>
              )}
              {item.motohaba_cm && (
                <span className="text-[12px]">
                  <span className="text-muted">Motohaba</span>{' '}
                  <span className="text-ink font-medium tabular-nums">{item.motohaba_cm}</span>
                  <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                </span>
              )}
              {item.sakihaba_cm && (
                <span className="text-[12px]">
                  <span className="text-muted">Sakihaba</span>{' '}
                  <span className="text-ink font-medium tabular-nums">{item.sakihaba_cm}</span>
                  <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[16px] lg:text-[18px] font-serif text-ink leading-snug">
            {item.title || itemTypeLabel}
          </h2>
          {displayName && (
            <p className="text-[13px] text-muted mt-0.5">
              By{' '}
              {item.artisan_id ? (
                <Link
                  href={`/artists/${generateArtisanSlug(item.artisan_display_name || item.smith, item.artisan_id)}`}
                  className="text-gold hover:underline"
                >
                  {displayName}
                </Link>
              ) : (
                <span>{displayName}</span>
              )}
            </p>
          )}
        </div>

        {/* Provenance Section */}
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted mb-2">Provenance</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {item.acquired_from && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Acquired From</span>
                <span className="text-ink font-medium">{item.acquired_from}</span>
              </div>
            )}
            {acquiredDate && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Date</span>
                <span className="text-ink font-medium">{acquiredDate}</span>
              </div>
            )}
            {pricePaid && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Price Paid</span>
                <span className="text-ink font-medium">{pricePaid}</span>
              </div>
            )}
            {currentValue && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Current Value</span>
                <span className="text-ink font-medium">{currentValue}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Status</span>
              <span className="text-ink font-medium">{statusLabel}</span>
            </div>
            {conditionLabel && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Condition</span>
                <span className="text-ink font-medium">{conditionLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted mb-2">Notes</h3>
            <p className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{item.notes}</p>
          </div>
        )}

        {/* Catalog Reference */}
        {item.catalog_reference && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted mb-2">Catalog Reference</h3>
            <p className="text-[13px] text-ink">
              {item.catalog_reference.collection} Vol. {item.catalog_reference.volume}, #{item.catalog_reference.item_number}
            </p>
          </div>
        )}
      </div>

      {/* Sticky CTA Footer */}
      <div className="px-4 py-3 bg-cream border-t border-border shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => openEditForm(item)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Item
          </button>
          {item.source_listing_id && (
            <Link
              href={`/listing/${item.source_listing_id}`}
              className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors active:scale-[0.98]"
            >
              View Original
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
