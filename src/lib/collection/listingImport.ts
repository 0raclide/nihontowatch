/**
 * Maps a browse Listing → CollectionItem fields for "I Own This" import.
 *
 * Copies all metadata from the dealer listing into collection item fields.
 * Images are referenced by URL (not re-uploaded).
 * The dealer name is set as acquired_from.
 */

import type { Listing } from '@/types';
import type { CreateCollectionItemInput } from '@/types/collection';

/**
 * Convert a browse listing into pre-filled collection item fields.
 * User still needs to add: price_paid, acquired_date, condition, notes.
 */
export function mapListingToCollectionItem(
  listing: Listing
): Partial<CreateCollectionItemInput> {
  // Collect image URLs (stored_images preferred, fallback to original)
  const images: string[] = [];
  if (listing.stored_images?.length) {
    images.push(...listing.stored_images);
  } else if (listing.images?.length) {
    images.push(...listing.images);
  }

  // Use smith or tosogu_maker depending on item type
  const smithName = listing.smith || listing.tosogu_maker || undefined;
  const schoolName = listing.school || listing.tosogu_school || undefined;

  // Dealer name for acquired_from
  const dealerName = listing.dealers?.name || listing.dealer?.name || undefined;

  return {
    source_listing_id: listing.id,
    item_type: listing.item_type || undefined,
    title: listing.title || listing.title_en || undefined,
    artisan_id: listing.artisan_id || undefined,
    artisan_display_name: listing.artisan_display_name || undefined,
    cert_type: listing.cert_type || undefined,
    cert_session: listing.cert_session || undefined,
    cert_organization: listing.cert_organization || undefined,
    smith: smithName,
    school: schoolName,
    province: listing.province || undefined,
    era: listing.era || undefined,
    mei_type: listing.mei_type || undefined,
    nagasa_cm: listing.nagasa_cm || undefined,
    sori_cm: listing.sori_cm || undefined,
    motohaba_cm: listing.motohaba_cm || undefined,
    sakihaba_cm: listing.sakihaba_cm || undefined,
    price_paid: listing.price_value || undefined,
    price_paid_currency: listing.price_currency || undefined,
    acquired_from: dealerName,
    images,
  };
}
