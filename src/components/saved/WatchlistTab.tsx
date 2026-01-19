'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFavorites } from '@/hooks/useFavorites';
import { useAlerts } from '@/hooks/useAlerts';
import { getImageUrl } from '@/lib/images';
import type { Listing, Alert } from '@/types';

interface WatchlistItemProps {
  listing: Listing;
  favoriteId: number;
  alerts: Alert[];
  onRemoveFavorite: (listingId: number) => Promise<boolean>;
  onToggleAlert: (
    listingId: number,
    alertType: 'price_drop' | 'back_in_stock',
    enabled: boolean
  ) => Promise<void>;
  isUpdating: boolean;
}

function WatchlistItem({
  listing,
  alerts,
  onRemoveFavorite,
  onToggleAlert,
  isUpdating,
}: WatchlistItemProps) {
  const imageUrl = getImageUrl(listing);
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';

  // Find existing alerts for this listing
  const priceDropAlert = alerts.find(
    (a) => a.listing_id === listing.id && a.alert_type === 'price_drop'
  );
  const backInStockAlert = alerts.find(
    (a) => a.listing_id === listing.id && a.alert_type === 'back_in_stock'
  );

  const handlePriceDropToggle = useCallback(async () => {
    await onToggleAlert(listing.id, 'price_drop', !priceDropAlert);
  }, [listing.id, priceDropAlert, onToggleAlert]);

  const handleBackInStockToggle = useCallback(async () => {
    await onToggleAlert(listing.id, 'back_in_stock', !backInStockAlert);
  }, [listing.id, backInStockAlert, onToggleAlert]);

  return (
    <div className="bg-paper rounded-lg border border-border p-4 hover:border-gold/30 transition-colors">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0 overflow-hidden bg-linen rounded"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </a>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h3 className="text-[14px] font-medium text-ink truncate hover:text-gold transition-colors">
                  {listing.title}
                </h3>
              </a>
              <p className="text-[12px] text-muted mt-0.5">
                {listing.dealer?.name || 'Unknown dealer'}
              </p>
            </div>

            {/* Remove button */}
            <button
              onClick={() => onRemoveFavorite(listing.id)}
              className="flex-shrink-0 p-1.5 text-muted hover:text-red-500 transition-colors"
              aria-label="Remove from watchlist"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Price and status */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[14px] font-medium ${isSold ? 'text-muted line-through' : 'text-ink'}`}>
              {listing.price_value
                ? new Intl.NumberFormat('ja-JP', {
                    style: 'currency',
                    currency: listing.price_currency || 'JPY',
                    maximumFractionDigits: 0,
                  }).format(listing.price_value)
                : 'Ask'}
            </span>
            {isSold && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
                SOLD
              </span>
            )}
          </div>

          {/* Alert toggles */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Price drop alert */}
            <label
              className={`inline-flex items-center gap-1.5 cursor-pointer ${
                isSold ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={!!priceDropAlert?.is_active}
                onChange={handlePriceDropToggle}
                disabled={isUpdating || isSold}
                className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 disabled:opacity-50"
              />
              <span className="text-[12px] text-muted">Price drop</span>
            </label>

            {/* Back in stock alert - only show if sold */}
            <label
              className={`inline-flex items-center gap-1.5 cursor-pointer ${
                !isSold ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={!!backInStockAlert?.is_active}
                onChange={handleBackInStockToggle}
                disabled={isUpdating || !isSold}
                className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 disabled:opacity-50"
              />
              <span className="text-[12px] text-muted">Back in stock</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </div>
      <h2 className="font-serif text-lg text-ink mb-2">No items in your watchlist</h2>
      <p className="text-[14px] text-muted text-center max-w-sm mb-6">
        Browse listings and click the heart icon to add items. You can then set up price
        drop and back-in-stock alerts.
      </p>
      <Link
        href="/"
        className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
      >
        Browse Listings
      </Link>
    </div>
  );
}

export function WatchlistTab() {
  const router = useRouter();
  const { favorites, isLoading: favoritesLoading, error: favoritesError, removeFavorite } = useFavorites();
  const { alerts, isLoading: alertsLoading, createAlert, deleteAlert, toggleAlert, isCreating, isUpdating } = useAlerts({ autoFetch: true });

  const handleRemoveFavorite = useCallback(
    async (listingId: number) => {
      return removeFavorite(listingId);
    },
    [removeFavorite]
  );

  const handleToggleAlert = useCallback(
    async (listingId: number, alertType: 'price_drop' | 'back_in_stock', enabled: boolean) => {
      // Find existing alert
      const existingAlert = alerts.find(
        (a) => a.listing_id === listingId && a.alert_type === alertType
      );

      if (enabled && !existingAlert) {
        // Create new alert
        await createAlert({
          alert_type: alertType,
          listing_id: listingId,
        });
      } else if (!enabled && existingAlert) {
        // Delete alert
        await deleteAlert(existingAlert.id);
      } else if (existingAlert && enabled !== existingAlert.is_active) {
        // Toggle alert active state
        await toggleAlert(existingAlert.id, enabled);
      }
    },
    [alerts, createAlert, deleteAlert, toggleAlert]
  );

  const isLoading = favoritesLoading || alertsLoading;
  const error = favoritesError;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (favorites.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      {/* Info banner */}
      <div className="bg-linen/50 rounded-lg p-3 mb-6 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-gold flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <p className="text-[13px] text-muted">
          <strong className="text-ink">Watch for changes:</strong> Enable &quot;Price drop&quot; to get
          notified when an item&apos;s price decreases. Enable &quot;Back in stock&quot; on sold items
          to know when they become available again.
        </p>
      </div>

      {/* Count */}
      <p className="text-sm text-muted mb-4">
        <span className="text-ink font-medium">{favorites.length}</span>{' '}
        {favorites.length === 1 ? 'item' : 'items'} in your watchlist
      </p>

      {/* Watchlist items */}
      <div className="space-y-3">
        {favorites.map((item) => (
          <WatchlistItem
            key={item.favoriteId}
            listing={item.listing as unknown as Listing}
            favoriteId={item.favoriteId}
            alerts={alerts}
            onRemoveFavorite={handleRemoveFavorite}
            onToggleAlert={handleToggleAlert}
            isUpdating={isCreating || isUpdating}
          />
        ))}
      </div>

      {/* Tip */}
      <div className="mt-8 p-4 bg-linen rounded-lg border border-border">
        <p className="text-[13px] text-muted">
          <strong className="text-ink">Tip:</strong> To add items to your watchlist, browse
          the{' '}
          <button onClick={() => router.push('/')} className="text-gold hover:underline">
            collection
          </button>{' '}
          and click the heart icon on any item.
        </p>
      </div>
    </div>
  );
}
