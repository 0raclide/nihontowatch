'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Listing } from '@/types';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useLocale } from '@/i18n/LocaleContext';
import { ListingCard } from '@/components/browse/ListingCard';

/**
 * ArtisanListings — Displays currently available listings matched to this artisan.
 * Reuses the shared ListingCard component for visual consistency with browse.
 * Fetches from /api/artisan/[code]/listings client-side.
 */

interface ArtisanListingsProps {
  code: string;
  artisanName: string | null;
  /** Pre-fetched listings to avoid duplicate API call */
  initialListings?: Listing[] | null;
  /** Which context this component is shown in — affects the "View all" link */
  status?: 'available' | 'sold';
}

export function ArtisanListings({ code, artisanName, initialListings, status = 'available' }: ArtisanListingsProps) {
  const [listings, setListings] = useState<Listing[]>(initialListings || []);
  const [loading, setLoading] = useState(!initialListings);
  const quickView = useQuickViewOptional();
  const { isAdmin } = useAuth();
  const { currency, exchangeRates } = useCurrency();
  const { t } = useLocale();

  // Sync local state when a listing is refreshed in QuickView (e.g. after artisan fix)
  // If the listing's artisan_id changed away from this artist, remove it from the grid
  useEffect(() => {
    const handler = (e: Event) => {
      const listing = (e as CustomEvent).detail as Listing;
      if (!listing?.id) return;
      setListings(prev => {
        if (listing.artisan_id !== code) {
          // Artisan changed — remove from this artist's listing grid
          return prev.filter(l => l.id !== listing.id);
        }
        return prev.map(l => l.id === listing.id ? listing : l);
      });
    };
    window.addEventListener('listing-refreshed', handler);
    return () => window.removeEventListener('listing-refreshed', handler);
  }, [code]);

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
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-elevated border border-border animate-pulse">
            <div className="aspect-[3/4] bg-border/50" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-border/50 rounded w-3/4" />
              <div className="h-3 bg-border/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Filter hidden listings for non-admin users (admins see them with indicator)
  const visibleListings = useMemo(
    () => isAdmin ? listings : listings.filter(l => !l.admin_hidden),
    [listings, isAdmin]
  );

  // Pass listings to QuickView context for prev/next navigation.
  // Only the "available" instance registers — if both available AND sold
  // instances call setListings with different arrays, they fight over the
  // context in an infinite re-render loop (each setListings changes the
  // context → triggers the other's effect → which calls setListings → …).
  // Skip when in alert carousel mode to prevent overwriting alert listings.
  useEffect(() => {
    if (quickView && visibleListings.length > 0 && !quickView.isAlertMode && status === 'available') {
      quickView.setListings(visibleListings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- quickView excluded: setListings changes the context identity, re-triggering this effect. visibleListings is the real trigger.
  }, [visibleListings, status]);

  if (visibleListings.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing as any}
            currency={currency}
            exchangeRates={exchangeRates}
            mobileView="grid"
            fontSize="standard"
            imageAspect="aspect-[4/3]"
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {/* Link to full browse filtered by artisan */}
      <div className="mt-4 text-center">
        <Link
          href={`/?artisan=${encodeURIComponent(code)}&tab=${status === 'sold' ? 'sold' : 'available'}`}
          className="text-sm text-gold hover:text-gold-light"
        >
          {status === 'sold'
            ? t('artist.browseSold', { name: artisanName || code })
            : t('artist.browseAll', { name: artisanName || code })} &rarr;
        </Link>
      </div>
    </div>
  );
}
