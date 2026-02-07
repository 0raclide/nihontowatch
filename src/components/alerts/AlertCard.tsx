'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Alert } from '@/types';
import { getImageUrl, isSupabaseStorageUrl } from '@/lib/images';

interface AlertCardProps {
  alert: Alert;
  onToggle: (id: number, isActive: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// Format relative time
function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return 'Never';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// Get alert type label
function getAlertTypeLabel(type: Alert['alert_type']): string {
  switch (type) {
    case 'price_drop':
      return 'Price Drop';
    case 'new_listing':
      return 'New Listing';
    case 'back_in_stock':
      return 'Back in Stock';
  }
}

// Format search criteria for display
function formatSearchCriteria(criteria: Alert['search_criteria']): string {
  if (!criteria) return 'All items';

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
      parts.push(`Up to ¥${criteria.max_price.toLocaleString()}`);
    }
  }

  return parts.length > 0 ? parts.join(' / ') : 'All items';
}

export function AlertCard({ alert, onToggle, onDelete }: AlertCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
            {getAlertTypeLabel(alert.alert_type)}
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className="relative flex-shrink-0"
            aria-label={alert.is_active ? 'Disable alert' : 'Enable alert'}
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
                  alt={listing.title || 'Listing'}
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized={isSupabaseStorageUrl(imageUrl)}
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
                {listing.title || 'Untitled'}
              </h3>
              {alert.alert_type === 'price_drop' && alert.target_price && (
                <p className="text-[12px] text-muted mt-1">
                  Target: {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: listing.price_currency || 'JPY',
                    maximumFractionDigits: 0,
                  }).format(alert.target_price)}
                </p>
              )}
              {listing.price_value && (
                <p className="text-[12px] text-charcoal mt-1">
                  Current: {new Intl.NumberFormat('en-US', {
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
              {formatSearchCriteria(alert.search_criteria)}
            </p>
            {alert.search_criteria?.dealer_id && (
              <p className="text-[12px] text-muted mt-1">
                From specific dealer
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="text-[11px] text-muted">
            {alert.last_triggered_at ? (
              <span>Last triggered: {formatRelativeTime(alert.last_triggered_at)}</span>
            ) : (
              <span>Created {formatRelativeTime(alert.created_at)}</span>
            )}
          </div>

          {/* Delete Button */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] text-muted hover:text-error transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[11px] text-error font-medium hover:underline disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
