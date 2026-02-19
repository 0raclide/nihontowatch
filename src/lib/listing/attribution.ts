/**
 * Artisan attribution name — tries smith first, falls back to tosogu_maker.
 * Works with any object shape (full Listing, raw Supabase row, etc.)
 */
export function getAttributionName(
  listing: { smith?: string | null; tosogu_maker?: string | null }
): string | null {
  return listing.smith || listing.tosogu_maker || null;
}

/**
 * Attribution school — tries school first, falls back to tosogu_school.
 */
export function getAttributionSchool(
  listing: { school?: string | null; tosogu_school?: string | null }
): string | null {
  return listing.school || listing.tosogu_school || null;
}
