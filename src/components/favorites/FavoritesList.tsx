'use client';

import Link from 'next/link';
import { useFavorites } from '@/hooks/useFavorites';
import { ListingCard } from '@/components/browse/ListingCard';
import { FavoriteButton } from './FavoriteButton';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

interface FavoritesListProps {
  currency: Currency;
  exchangeRates: ExchangeRates | null;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white theme-dark:bg-gray-800 border border-border theme-dark:border-gray-700">
          <div className="aspect-[4/3] img-loading" />
          <div className="p-3 space-y-2">
            <div className="h-2.5 w-16 img-loading rounded" />
            <div className="h-4 w-full img-loading rounded" />
            <div className="h-3 w-20 img-loading rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-block p-8 bg-white theme-dark:bg-gray-800 border border-border theme-dark:border-gray-700 max-w-md">
        <svg
          className="w-16 h-16 text-muted/30 mx-auto mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <h3 className="font-serif text-xl text-charcoal theme-dark:text-gray-200 mb-3">
          No favorites yet
        </h3>
        <p className="text-sm text-muted theme-dark:text-gray-400 mb-6">
          Browse the collection and click the heart icon on items you&apos;re interested in.
          They&apos;ll appear here for easy access.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink theme-dark:bg-gold text-white theme-dark:text-ink text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Browse Collection
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export function FavoritesList({ currency, exchangeRates }: FavoritesListProps) {
  const { favorites, isLoading, error } = useFavorites();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="inline-block p-6 bg-white theme-dark:bg-gray-800 border border-red-200 theme-dark:border-red-900">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="font-serif text-lg text-charcoal theme-dark:text-gray-200 mb-2">
            Error loading favorites
          </h3>
          <p className="text-sm text-muted">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          <span className="text-ink theme-dark:text-white font-medium">{favorites.length}</span>{' '}
          {favorites.length === 1 ? 'item' : 'items'} saved
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {favorites.map((item, index) => (
          <div key={item.favoriteId} className="relative group">
            <ListingCard
              listing={item.listing}
              currency={currency}
              exchangeRates={exchangeRates}
              priority={index < 10}
            />
            {/* Remove button overlay */}
            <div className="absolute top-2 right-2 z-10">
              <FavoriteButton
                listingId={Number(item.listing.id)}
                initialFavorited={true}
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact list view for favorites (alternative to grid)
 */
export function FavoritesListCompact({ currency }: Omit<FavoritesListProps, 'exchangeRates'>) {
  const { favorites, isLoading, removeFavorite } = useFavorites();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 p-3 bg-white theme-dark:bg-gray-800 border border-border theme-dark:border-gray-700">
            <div className="w-20 h-20 img-loading rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 img-loading rounded" />
              <div className="h-3 w-1/2 img-loading rounded" />
              <div className="h-3 w-1/4 img-loading rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (favorites.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {favorites.map((item) => (
        <div
          key={item.favoriteId}
          className="flex gap-4 p-3 bg-white theme-dark:bg-gray-800 border border-border theme-dark:border-gray-700 hover:border-gold/40 transition-colors"
        >
          {/* Thumbnail */}
          <a
            href={item.listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-20 h-20 flex-shrink-0 overflow-hidden bg-linen theme-dark:bg-gray-900"
          >
            {item.listing.images?.[0] ? (
              <img
                src={item.listing.images[0]}
                alt={item.listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </a>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <a
              href={item.listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <h3 className="text-sm font-medium text-ink theme-dark:text-white truncate hover:text-gold transition-colors">
                {item.listing.title}
              </h3>
              <p className="text-xs text-muted mt-1">
                {item.listing.dealers?.name}
              </p>
              <p className="text-sm font-medium text-ink theme-dark:text-white mt-2">
                {item.listing.price_value
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    }).format(item.listing.price_value)
                  : 'Ask'}
              </p>
            </a>
          </div>

          {/* Remove button */}
          <button
            onClick={() => removeFavorite(Number(item.listing.id))}
            className="flex-shrink-0 p-2 text-muted hover:text-burgundy transition-colors"
            aria-label="Remove from favorites"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
