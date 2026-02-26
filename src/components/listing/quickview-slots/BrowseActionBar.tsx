'use client';

import { useCallback } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ShareButton } from '@/components/share/ShareButton';
import { SocialShareButtons } from '@/components/share/SocialShareButtons';
import { useAuth } from '@/lib/auth/AuthContext';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing, ListingWithEnrichment } from '@/types';
import { hasSetsumeiData } from '@/types';

interface BrowseActionBarProps {
  listing: Listing;
  isStudyMode?: boolean;
  onToggleStudyMode?: () => void;
  onToggleAdminEditMode?: () => void;
}

export function BrowseActionBar({ listing, isStudyMode, onToggleStudyMode, onToggleAdminEditMode }: BrowseActionBarProps) {
  const { isAdmin } = useAuth();
  const quickView = useQuickViewOptional();
  const { t, locale } = useLocale();

  const handleToggleSold = useCallback(async () => {
    const markAsSold = listing.is_available;
    try {
      const res = await fetch(`/api/listing/${listing.id}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: markAsSold }),
      });
      if (res.ok) {
        quickView?.refreshCurrentListing({
          status: markAsSold ? 'sold' : 'available',
          is_available: !markAsSold,
          is_sold: markAsSold,
          status_admin_locked: true,
        } as Partial<Listing>);
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.is_available, quickView]);

  const handleToggleHidden = useCallback(async () => {
    const newHidden = !listing.admin_hidden;
    try {
      const res = await fetch(`/api/listing/${listing.id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHidden }),
      });
      if (res.ok) {
        quickView?.refreshCurrentListing({ admin_hidden: newHidden } as Partial<Listing>);
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.admin_hidden, quickView]);

  return (
    <>
      {/* Admin: Toggle sold/available status */}
      {isAdmin && (
        <button
          onClick={handleToggleSold}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
            listing.is_sold
              ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
              : 'text-muted hover:text-ink hover:bg-border/50'
          }`}
          aria-label={listing.is_sold ? t('quickview.markAvailable') : t('quickview.markSold')}
          title={listing.is_sold ? t('quickview.markAvailable') : t('quickview.markSold')}
        >
          {listing.is_sold ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
        </button>
      )}
      {/* Admin: Hide/unhide listing button */}
      {isAdmin && (
        <button
          onClick={handleToggleHidden}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
            listing.admin_hidden
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'text-muted hover:text-ink hover:bg-border/50'
          }`}
          aria-label={listing.admin_hidden ? t('quickview.unhide') : t('quickview.hide')}
          title={listing.admin_hidden ? t('quickview.unhide') : t('quickview.hide')}
        >
          {listing.admin_hidden ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      )}
      {/* Admin: Edit fields (pen icon) */}
      {isAdmin && onToggleAdminEditMode && (
        <button
          onClick={onToggleAdminEditMode}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
          aria-label="Edit fields"
          title="Edit fields"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      )}
      {/* Study Setsumei button - hidden for JA locale */}
      {locale !== 'ja' && hasSetsumeiData(listing as ListingWithEnrichment) && onToggleStudyMode && (
        <button
          onClick={onToggleStudyMode}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
            isStudyMode
              ? 'bg-gold text-white shadow-lg'
              : 'magical-book'
          }`}
          aria-label={isStudyMode ? t('quickview.viewPhotos') : t('quickview.studySetsumei')}
          title={isStudyMode ? t('quickview.viewPhotos') : t('quickview.studySetsumei')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </button>
      )}
      <SocialShareButtons
        path={`/listing/${listing.id}`}
        title={listing.title || 'NihontoWatch'}
        size="sm"
      />
      <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
      <FavoriteButton listingId={listing.id} size="sm" />
    </>
  );
}
