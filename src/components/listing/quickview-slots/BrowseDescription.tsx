'use client';

import type { Listing } from '@/types';
import { TranslatedDescription } from '../TranslatedDescription';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';

interface BrowseDescriptionProps {
  listing: Listing;
  maxLines?: number;
}

export function BrowseDescription({ listing, maxLines = 6 }: BrowseDescriptionProps) {
  const quickView = useQuickViewOptional();
  const detailLoaded = quickView?.detailLoaded ?? true;

  if (!detailLoaded) {
    return (
      <div className="px-4 py-3 lg:px-5 space-y-2 animate-pulse">
        <div className="h-4 bg-muted/20 rounded w-full" />
        <div className="h-4 bg-muted/20 rounded w-5/6" />
        <div className="h-4 bg-muted/20 rounded w-4/6" />
      </div>
    );
  }

  return <TranslatedDescription listing={listing} maxLines={maxLines} />;
}
