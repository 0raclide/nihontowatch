/**
 * Collects all images from a listing into ordered, deduplicated groups.
 *
 * Used by QuickView to render a unified vertical scroller with group dividers.
 *
 * **Dealer listings** (isDealerSource=true):
 *   Hero → Videos → Remaining Photos → Koshirae → Sayagaki/Hakogaki →
 *   Kanto Hibisho → Provenance. No catalog filtering — dealer chose these images.
 *
 * **Browse listings** (isDealerSource=false):
 *   Flat image list + videos. No grouping, no catalog filtering, no dividers.
 */

import type { Listing } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface VideoMediaItem {
  streamUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'failed';
  videoId?: string;
}

export interface MediaGroup {
  /** i18n key for the group label */
  labelKey: string;
  /** Image URLs in this group */
  images: string[];
}

export interface FlatMediaItem {
  /** Image URL (empty string for video items) */
  src: string;
  /** Global index across all groups (for lazy-load visibility tracking) */
  globalIndex: number;
  /** i18n key for the group this item belongs to */
  groupLabelKey: string;
  /** True if this is the first item in its group (used for divider placement) */
  isFirstInGroup: boolean;
  /** True if this item belongs to the first group (primary) — no divider before first group */
  isFirstGroup: boolean;
  /** Media type — 'image' for photos, 'video' for inline video items */
  type: 'image' | 'video';
  /** Video stream URL (only when type === 'video') */
  streamUrl?: string;
  /** Video thumbnail URL (only when type === 'video') */
  thumbnailUrl?: string;
  /** Video duration in seconds (only when type === 'video') */
  duration?: number;
  /** Video processing status (only when type === 'video') */
  videoStatus?: 'processing' | 'ready' | 'failed';
  /** Video ID (only when type === 'video') */
  videoId?: string;
}

export interface GroupedMediaResult {
  /** Ordered groups of images, empty groups omitted */
  groups: MediaGroup[];
  /** Total count of all items (images + videos) across all groups */
  totalCount: number;
  /** Flat array of all image URLs across all groups (for indexing — excludes videos) */
  allImageUrls: string[];
  /** Pre-flattened items with computed indices and group membership (for pure render) */
  flatItems: FlatMediaItem[];
}

// ============================================================================
// Group definitions — reordered: koshirae, sayagaki, hakogaki, kanto hibisho, provenance
// ============================================================================

interface SectionDef {
  labelKey: string;
  getImages: (listing: Listing) => string[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    labelKey: 'dealer.koshirae',
    getImages: (l) => {
      if (!l.koshirae) return [];
      return l.koshirae.images || [];
    },
  },
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
    labelKey: 'dealer.kantoHibisho',
    getImages: (l) => {
      if (!l.kanto_hibisho) return [];
      return l.kanto_hibisho.images || [];
    },
  },
  {
    labelKey: 'dealer.provenance',
    getImages: (l) => {
      if (!l.provenance) return [];
      const urls: string[] = [];
      if (l.provenance.entries) {
        for (const entry of l.provenance.entries) {
          if (entry.portrait_image) urls.push(entry.portrait_image);
        }
      }
      if (l.provenance.documents) {
        urls.push(...l.provenance.documents);
      }
      return urls;
    },
  },
];

// ============================================================================
// Main function
// ============================================================================

/**
 * Collect all media from a listing into ordered, deduplicated groups.
 *
 * @param displayImages - Validated primary listing photos (already hero-reordered)
 * @param listing - The full listing object (may have section data)
 * @param detailLoaded - Whether the detail API has resolved (sections only available after detail load)
 * @param videoItems - Actual video data to integrate inline after hero image
 * @param isDealerSource - When true, enable section grouping for dealer listings. Browse stays flat.
 */
export function collectGroupedMedia(
  displayImages: string[],
  listing: Listing | null,
  detailLoaded: boolean,
  videoItems: VideoMediaItem[] = [],
  isDealerSource: boolean = false,
): GroupedMediaResult {
  const groups: MediaGroup[] = [];
  const allImageUrls: string[] = [];

  // Primary group: all photos (no catalog filtering — images stay where they were placed)
  groups.push({
    labelKey: 'quickview.sectionPhotos',
    images: displayImages,
  });
  allImageUrls.push(...displayImages);

  // Section groups only for dealer listings with detail data available
  if (isDealerSource && listing && detailLoaded) {
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

    // Insert video items after the hero image (first item of first group)
    if (isFirstGroup && videoItems.length > 0) {
      // Hero image (first regular photo, if any)
      if (group.images.length > 0) {
        flatItems.push({
          src: group.images[0],
          globalIndex: globalIndex++,
          groupLabelKey: group.labelKey,
          isFirstInGroup: true,
          isFirstGroup: true,
          type: 'image',
        });
      }

      // Videos inline after hero
      for (let v = 0; v < videoItems.length; v++) {
        const video = videoItems[v];
        flatItems.push({
          src: '',
          globalIndex: globalIndex++,
          groupLabelKey: group.labelKey,
          isFirstInGroup: group.images.length === 0 && v === 0,
          isFirstGroup: true,
          type: 'video',
          streamUrl: video.streamUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          videoStatus: video.status,
          videoId: video.videoId,
        });
      }

      // Remaining photos after videos
      for (let i = 1; i < group.images.length; i++) {
        flatItems.push({
          src: group.images[i],
          globalIndex: globalIndex++,
          groupLabelKey: group.labelKey,
          isFirstInGroup: false,
          isFirstGroup: true,
          type: 'image',
        });
      }
    } else {
      // Non-primary groups or primary group without videos
      for (let i = 0; i < group.images.length; i++) {
        flatItems.push({
          src: group.images[i],
          globalIndex: globalIndex++,
          groupLabelKey: group.labelKey,
          isFirstInGroup: i === 0,
          isFirstGroup,
          type: 'image',
        });
      }
    }
  }

  const totalCount = allImageUrls.length + videoItems.length;

  return { groups, totalCount, allImageUrls, flatItems };
}
