import type { EnrichedListingDetail } from './getListingDetail';
import { getAllImages } from '@/lib/images';

/**
 * Minimum richness thresholds for automatic showcase eligibility.
 * A listing must have at least MIN_IMAGES photos AND at least
 * MIN_RICH_SECTIONS rich data sections (provenance, sayagaki, etc.)
 */
const MIN_IMAGES = 3;
const MIN_RICH_SECTIONS = 2;

/**
 * Count how many "rich" content sections a listing has.
 * Each section that has meaningful data counts as 1.
 */
export function countRichSections(listing: EnrichedListingDetail): number {
  let count = 0;

  // Setsumei (either direct or via Yuhinkai enrichment)
  if (listing.setsumei_text_en || listing.setsumei_text_ja) count++;

  // Sayagaki
  if (listing.sayagaki && listing.sayagaki.length > 0) count++;

  // Hakogaki
  if (listing.hakogaki && listing.hakogaki.length > 0) count++;

  // Provenance
  if (listing.provenance && listing.provenance.length > 0) count++;

  // Kiwame
  if (listing.kiwame && listing.kiwame.length > 0) count++;

  // Koshirae (with meaningful data — not just an empty shell)
  if (listing.koshirae && (
    listing.koshirae.artisan_id ||
    listing.koshirae.components?.length > 0 ||
    listing.koshirae.cert_type ||
    listing.koshirae.images?.length > 0
  )) count++;

  // Kanto Hibisho
  if (listing.kanto_hibisho) count++;

  // Video
  if (listing.videos && listing.videos.length > 0) count++;

  return count;
}

/**
 * Determine if a listing qualifies for the immersive Showcase layout.
 *
 * Rules:
 * 1. If `showcase_override === true`, always show showcase
 * 2. If `showcase_override === false`, never show showcase
 * 3. If `showcase_override` is null/undefined (auto): check richness thresholds
 *    - Must have at least MIN_IMAGES validated images
 *    - Must have at least MIN_RICH_SECTIONS rich data sections
 */
export function isShowcaseEligible(listing: EnrichedListingDetail): boolean {
  // Manual override takes precedence
  const override = (listing as any).showcase_override;
  if (override === true) return true;
  if (override === false) return false;

  // Auto: check richness thresholds
  const imageCount = getAllImages(listing).length;
  if (imageCount < MIN_IMAGES) return false;

  const richSections = countRichSections(listing);
  if (richSections < MIN_RICH_SECTIONS) return false;

  return true;
}
