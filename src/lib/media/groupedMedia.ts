/**
 * Collects all images from a listing into ordered, deduplicated groups.
 *
 * Used by QuickView to render a unified vertical scroller with group dividers
 * for section images (sayagaki, hakogaki, koshirae, provenance, kanto hibisho).
 *
 * Scraped listings (no section data) return only the primary photos group.
 * When detailLoaded=false, returns only the photos group (section data not yet available).
 */

import type { Listing } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface MediaGroup {
  /** i18n key for the group label */
  labelKey: string;
  /** Image URLs in this group */
  images: string[];
}

export interface FlatMediaItem {
  /** Image URL */
  src: string;
  /** Global index across all groups (for lazy-load visibility tracking) */
  globalIndex: number;
  /** i18n key for the group this item belongs to */
  groupLabelKey: string;
  /** True if this is the first image in its group (used for divider placement) */
  isFirstInGroup: boolean;
  /** True if this item belongs to the first group (photos) — no divider before first group */
  isFirstGroup: boolean;
}

export interface GroupedMediaResult {
  /** Ordered groups of images, empty groups omitted */
  groups: MediaGroup[];
  /** Total count of all images + videos across all groups */
  totalCount: number;
  /** Flat array of all image URLs across all groups (for indexing) */
  allImageUrls: string[];
  /** Pre-flattened items with computed indices and group membership (for pure render) */
  flatItems: FlatMediaItem[];
}

// ============================================================================
// Group definitions (order matters)
// ============================================================================

interface SectionDef {
  labelKey: string;
  getImages: (listing: Listing) => string[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    labelKey: 'dealer.sayagaki',
    getImages: (l) => {
      if (!l.sayagaki || !Array.isArray(l.sayagaki)) return [];
      return l.sayagaki.flatMap(entry => entry.images || []);
    },
  },
  {
    labelKey: 'dealer.hakogaki',
    getImages: (l) => {
      if (!l.hakogaki || !Array.isArray(l.hakogaki)) return [];
      return l.hakogaki.flatMap(entry => entry.images || []);
    },
  },
  {
    labelKey: 'dealer.koshirae',
    getImages: (l) => {
      if (!l.koshirae) return [];
      return l.koshirae.images || [];
    },
  },
  {
    labelKey: 'dealer.provenance',
    getImages: (l) => {
      if (!l.provenance || !Array.isArray(l.provenance)) return [];
      return l.provenance.flatMap(entry => entry.images || []);
    },
  },
  {
    labelKey: 'dealer.kantoHibisho',
    getImages: (l) => {
      if (!l.kanto_hibisho) return [];
      return l.kanto_hibisho.images || [];
    },
  },
];

// ============================================================================
// Main function
// ============================================================================

/**
 * Collect all images from a listing into ordered, deduplicated groups.
 *
 * @param displayImages - Validated primary listing photos (already hero-reordered)
 * @param listing - The full listing object (may have section data)
 * @param detailLoaded - Whether the detail API has resolved (sections only available after detail load)
 * @param videoCount - Number of ready videos to include in totalCount
 */
export function collectGroupedMedia(
  displayImages: string[],
  listing: Listing | null,
  detailLoaded: boolean,
  videoCount: number = 0,
): GroupedMediaResult {
  const groups: MediaGroup[] = [];
  const allImageUrls: string[] = [];

  // Always include the photos group (even if empty — QuickView handles empty state)
  groups.push({
    labelKey: 'quickview.sectionPhotos',
    images: displayImages,
  });
  allImageUrls.push(...displayImages);

  // Section groups only when detail data is available
  if (listing && detailLoaded) {
    const seen = new Set<string>(displayImages);

    for (const def of SECTION_DEFS) {
      const raw = def.getImages(listing);
      // Deduplicate: skip images already in primary set or earlier sections
      const unique = raw.filter(url => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });

      if (unique.length > 0) {
        groups.push({ labelKey: def.labelKey, images: unique });
        allImageUrls.push(...unique);
      }
    }
  }

  // Build pre-flattened items for pure render (no mutable counter in JSX)
  const flatItems: FlatMediaItem[] = [];
  let globalIndex = 0;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const isFirstGroup = g === 0;
    for (let i = 0; i < group.images.length; i++) {
      flatItems.push({
        src: group.images[i],
        globalIndex: globalIndex++,
        groupLabelKey: group.labelKey,
        isFirstInGroup: i === 0,
        isFirstGroup,
      });
    }
  }

  const totalCount = allImageUrls.length + videoCount;

  return { groups, totalCount, allImageUrls, flatItems };
}
