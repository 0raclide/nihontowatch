'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Alert } from '@/types';
import { getImageUrl } from '@/lib/images';
import { useLocale } from '@/i18n/LocaleContext';

interface AlertCardProps {
  alert: Alert;
  onToggle: (id: number, isActive: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// Format relative time using i18n
function formatAlertRelativeTime(
  isoDate: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: string,
): string {
  if (!isoDate) return t('alerts.never');

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('alerts.justNow');
  if (diffMins < 60) return t('alerts.minutesAgo', { n: diffMins });
  if (diffHours < 24) return t('alerts.hoursAgo', { n: diffHours });
  if (diffDays === 1) return t('alerts.yesterdayLabel');
  if (diffDays < 7) return t('alerts.daysAgo', { n: diffDays });
  return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
}

// Get alert type icon
function AlertTypeIcon({ type }: { type: Alert['alert_type'] }) {
  switch (type) {
    case 'price_drop':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      );
    case 'new_listing':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    case 'back_in_stock':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

// Get alert type label key
const ALERT_TYPE_KEYS: Record<Alert['alert_type'], string> = {
  price_drop: 'alerts.typePriceDrop',
  new_listing: 'alerts.typeNewListing',
  back_in_stock: 'alerts.typeBackInStock',
};

// Format search criteria for display
function formatSearchCriteria(
  criteria: Alert['search_criteria'],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!criteria) return t('alerts.allItems');

  const parts: string[] = [];

  if (criteria.item_type) {
    parts.push(criteria.item_type.charAt(0).toUpperCase() + criteria.item_type.slice(1));
  }
  if (criteria.cert_type) {
    parts.push(criteria.cert_type);
  }
  if (criteria.min_price || criteria.max_price) {
    if (criteria.min_price && criteria.max_price) {
      parts.push(`¥${criteria.min_price.toLocaleString()} - ¥${criteria.max_price.toLocaleString()}`);
    } else if (criteria.min_price) {
      parts.push(`¥${criteria.min_price.toLocaleString()}+`);
    } else if (criteria.max_price) {
      parts.push(t('alerts.upTo', { price: criteria.max_price.toLocaleString() }));
    }
  }

  return parts.length > 0 ? parts.join(' / ') : t('alerts.allItems');
}

export function AlertCard({ alert, onToggle, onDelete }: AlertCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t, locale } = useLocale();

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle(alert.id, !alert.is_active);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(alert.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const listing = alert.listing;
  const imageUrl = getImageUrl(listing);

  return (
    <div
      className={`bg-paper border border-border rounded-lg overflow-hidden transition-all ${
        !alert.is_active ? 'opacity-60' : ''
      }`}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Alert Type Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
            alert.alert_type === 'price_drop'
              ? 'bg-juyo-bg text-juyo'
              : alert.alert_type === 'new_listing'
              ? 'bg-sage/10 text-sage'
              : 'bg-gold/10 text-gold'
          }`}>
            <AlertTypeIcon type={alert.alert_type} />
            {t(ALERT_TYPE_KEYS[alert.alert_type])}
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className="relative flex-shrink-0"
            aria-label={alert.is_active ? t('alerts.disable') : t('alerts.enable')}
          >
            <div className={`w-11 h-6 rounded-full transition-colors ${
              alert.is_active
                ? 'bg-gold'
                : 'bg-border-dark'
            }`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                alert.is_active ? 'translate-x-6' : 'translate-x-1'
              } ${isToggling ? 'opacity-50' : ''}`} />
            </div>
          </button>
        </div>

        {/* Content */}
        {(alert.alert_type === 'price_drop' || alert.alert_type === 'back_in_stock') && listing ? (
          <div className="flex gap-3">
            {/* Listing Image */}
            <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-linen">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={listing.title || t('alerts.untitled')}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Listing Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-medium text-ink line-clamp-2">
                {listing.title || t('alerts.untitled')}
              </h3>
              {alert.alert_type === 'price_drop' && alert.target_price && (
                <p className="text-[12px] text-muted mt-1">
                  Target: {new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
                    style: 'currency',
                    currency: listing.price_currency || 'JPY',
                    maximumFractionDigits: 0,
                  }).format(alert.target_price)}
                </p>
              )}
              {listing.price_value && (
                <p className="text-[12px] text-charcoal mt-1">
                  Current: {new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
                    style: 'currency',
                    currency: listing.price_currency || 'JPY',
                    maximumFractionDigits: 0,
                  }).format(listing.price_value)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[14px] text-ink font-medium">
              {formatSearchCriteria(alert.search_criteria, t)}
            </p>
            {alert.search_criteria?.dealer_id && (
              <p className="text-[12px] text-muted mt-1">
                {t('alerts.fromDealer')}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="text-[11px] text-muted">
            {alert.last_triggered_at ? (
              <span>{t('alerts.lastTriggered', { time: formatAlertRelativeTime(alert.last_triggered_at, t, locale) })}</span>
            ) : (
              <span>{t('alerts.created', { time: formatAlertRelativeTime(alert.created_at, t, locale) })}</span>
            )}
          </div>

          {/* Delete Button */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] text-muted hover:text-error transition-colors"
            >
              {t('alerts.delete')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] text-muted hover:text-ink transition-colors"
              >
                {t('alerts.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[11px] text-error font-medium hover:underline disabled:opacity-50"
              >
                {isDeleting ? t('alerts.deleting') : t('alerts.confirm')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
