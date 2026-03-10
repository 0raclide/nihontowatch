'use client';

import { ShareButton } from '@/components/share/ShareButton';
import { SocialShareButtons } from '@/components/share/SocialShareButtons';
import type { Listing } from '@/types';
import type { ShowcaseExtension } from '@/types/displayItem';

interface ShowcaseActionBarProps {
  listing: Listing;
  showcase?: ShowcaseExtension | null;
}

export function ShowcaseActionBar({ listing, showcase }: ShowcaseActionBarProps) {
  return (
    <>
      {/* Owner badge */}
      {showcase?.owner_display_name && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-border/30 text-[11px] text-muted">
          {showcase.owner_avatar_url ? (
            <img
              src={showcase.owner_avatar_url}
              alt=""
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
          <span className="truncate max-w-[120px]">{showcase.owner_display_name}</span>
        </div>
      )}
      <SocialShareButtons
        path={`/listing/${listing.id}`}
        title={listing.title || 'NihontoWatch'}
        size="sm"
      />
      <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
    </>
  );
}
