'use client';

import { ShareButton } from '@/components/share/ShareButton';
import type { Listing } from '@/types';

interface CollectionMobileHeaderActionsProps {
  listing: Listing;
  onEditCollection?: () => void;
}

export function CollectionMobileHeaderActions({ listing, onEditCollection }: CollectionMobileHeaderActionsProps) {
  return (
    <>
      {/* Collection: Edit button */}
      {onEditCollection && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditCollection();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
          aria-label="Edit"
          title="Edit item"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <ShareButton
          listingId={listing.id}
          title={listing.title}
          size="sm"
          ogImageUrl={listing.og_image_url}
        />
      </div>
    </>
  );
}
