'use client';

import { useRouter } from 'next/navigation';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';
import { getDealerDisplayName } from '@/lib/dealers/displayName';
import { useLocale } from '@/i18n/LocaleContext';

interface BrowseDealerRowProps {
  listing: Listing;
}

export function BrowseDealerRow({ listing }: BrowseDealerRowProps) {
  const router = useRouter();
  const quickView = useQuickViewOptional();
  const { locale } = useLocale();

  const dealerObj = listing.dealers || listing.dealer;
  const dealerName = dealerObj ? getDealerDisplayName(dealerObj as { name: string; name_ja?: string | null }, locale) : 'Dealer';

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      {listing.dealer_id && listing.dealer_id !== -1 ? (
        <a
          href={`/?dealer=${listing.dealer_id}`}
          data-testid="dealer-name"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            quickView?.dismissForNavigation?.();
            router.push(`/?dealer=${listing.dealer_id}`);
          }}
          className="hover:text-accent hover:underline transition-colors"
        >
          {dealerName}
        </a>
      ) : (
        <span data-testid="dealer-name">{dealerName}</span>
      )}
    </div>
  );
}
