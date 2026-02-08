'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Listing } from '@/types';

/**
 * ArtisanListings — Displays currently available listings matched to this artisan.
 * Fetches from /api/artisan/[code]/listings client-side.
 */

interface ArtisanListingsProps {
  code: string;
  artisanName: string | null;
  /** Pre-fetched listings to avoid duplicate API call */
  initialListings?: Listing[] | null;
}

export function ArtisanListings({ code, artisanName, initialListings }: ArtisanListingsProps) {
  const [listings, setListings] = useState<Listing[]>(initialListings || []);
  const [loading, setLoading] = useState(!initialListings);

  useEffect(() => {
    // Skip fetch if we already have data from parent
    if (initialListings) return;

    let cancelled = false;

    async function fetchListings() {
      try {
        const res = await fetch(`/api/artisan/${encodeURIComponent(code)}/listings`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setListings(data.listings || []);
        }
      } catch {
        // Silently fail — section just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchListings();
    return () => { cancelled = true; };
  }, [code, initialListings]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-elevated border border-border rounded-lg animate-pulse">
            <div className="aspect-[4/3] bg-border/50 rounded-t-lg" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-border/50 rounded w-3/4" />
              <div className="h-3 bg-border/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {listings.map((listing) => {
          const imageUrl = listing.images?.[0] ?? null;
          const dealer = listing.dealer || listing.dealers;
          const price = listing.price_value
            ? `¥${listing.price_value.toLocaleString()}`
            : listing.price_raw || 'Ask';

          return (
            <Link
              key={listing.id}
              href={`/browse?artisan=${encodeURIComponent(code)}&listing=${listing.id}`}
              className="group bg-surface-elevated border border-border rounded-lg overflow-hidden hover:border-gold/40 transition-colors"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-border/30 overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                    No image
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <h4 className="text-xs font-medium text-ink line-clamp-2 leading-snug">
                  {listing.title}
                </h4>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-xs font-medium text-gold">{price}</span>
                  {dealer && (
                    <span className="text-[10px] text-muted truncate">
                      {dealer.name}
                    </span>
                  )}
                </div>
                {listing.cert_type && (
                  <span className="mt-1 inline-block text-[10px] text-muted bg-border/50 px-1.5 py-0.5 rounded">
                    {listing.cert_type}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Link to full browse filtered by artisan */}
      <div className="mt-4 text-center">
        <Link
          href={`/browse?artisan=${encodeURIComponent(code)}`}
          className="text-sm text-gold hover:text-gold-light"
        >
          View all listings by {artisanName || code} &rarr;
        </Link>
      </div>
    </div>
  );
}
