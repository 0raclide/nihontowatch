import type { DisplayItem } from '@/types/displayItem';
import { listingToDisplayItem } from './fromListing';

/**
 * Map a dealer's own listing to a DisplayItem.
 * Delegates 95% of mapping to listingToDisplayItem, then overrides source
 * and adds the dealer extension.
 */
export function dealerListingToDisplayItem(
  listing: Parameters<typeof listingToDisplayItem>[0],
  locale: string,
  isOwnListing: boolean
): DisplayItem {
  const base = listingToDisplayItem(listing, locale);
  return {
    ...base,
    source: 'dealer',
    dealer: { isOwnListing },
  };
}
