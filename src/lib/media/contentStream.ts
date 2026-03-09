/**
 * Builds a typed content stream for dealer QuickView.
 *
 * Pure function — no React, no side effects. Takes listing data and returns
 * ordered ContentBlock[] that the renderer maps to React components.
 *
 * Used only for dealer listings (source === 'dealer'). Browse and collection
 * QuickViews are completely unchanged and use the existing grouped media path.
 */

import type {
  Listing,
  SayagakiEntry,
  HakogakiEntry,
  KoshiraeData,
  ProvenanceEntry,
  KiwameEntry,
  KantoHibishoData,
} from '@/types';
import type { VideoMediaItem } from './groupedMedia';

// ============================================================================
// Types
// ============================================================================

export type ContentBlock =
  | { type: 'hero_image'; src: string; globalIndex: 0 }
  | { type: 'curator_note'; noteEn: string | null; noteJa: string | null }
  | { type: 'video'; streamUrl: string; thumbnailUrl?: string; duration?: number; status?: string; videoId?: string; globalIndex: number }
  | { type: 'image'; src: string; globalIndex: number }
  | { type: 'section_divider'; labelKey: string; sectionId: string }
  | { type: 'setsumei'; textEn: string | null; textJa: string | null; imageUrl: string | null; metadata: Record<string, unknown> | null }
  | { type: 'sayagaki'; data: SayagakiEntry[] }
  | { type: 'hakogaki'; data: HakogakiEntry[] }
  | { type: 'provenance'; data: ProvenanceEntry[] }
  | { type: 'kiwame'; data: KiwameEntry[] }
  | { type: 'koshirae'; data: KoshiraeData; hideHeading: boolean }
  | { type: 'kanto_hibisho'; data: KantoHibishoData };

export interface SectionIndicator {
  /** DOM id for scroll-to, e.g. 'stream-setsumei' */
  id: string;
  /** i18n key for display label */
  labelKey: string;
}

export interface ContentStreamResult {
  blocks: ContentBlock[];
  /** Total number of image blocks (hero + photos + section images) — for progress bar */
  imageCount: number;
  /** All image URLs in stream order — for unified lightbox navigation */
  allImageUrls: string[];
  /** Section indicators present in this stream — for stats card navigation */
  sections: SectionIndicator[];
}

// ============================================================================
// Section image collectors — extract image URLs from section data
// ============================================================================

function getSectionImageUrls(listing: Listing): Set<string> {
  const urls = new Set<string>();

  if (listing.koshirae?.images) {
    for (const url of listing.koshirae.images) urls.add(url);
  }
  if (listing.sayagaki && Array.isArray(listing.sayagaki)) {
    for (const entry of listing.sayagaki) {
      if (entry.images) for (const url of entry.images) urls.add(url);
    }
  }
  if (listing.hakogaki && Array.isArray(listing.hakogaki)) {
    for (const entry of listing.hakogaki) {
      if (entry.images) for (const url of entry.images) urls.add(url);
    }
  }
  if (listing.provenance && Array.isArray(listing.provenance)) {
    for (const entry of listing.provenance) {
      if (entry.images) for (const url of entry.images) urls.add(url);
    }
  }
  if (listing.kanto_hibisho?.images) {
    for (const url of listing.kanto_hibisho.images) urls.add(url);
  }

  return urls;
}

// ============================================================================
// Section definitions — order determines stream order
// ============================================================================

interface SectionDef {
  id: string;
  labelKey: string;
  hasData: (listing: Listing) => boolean;
  buildBlock: (listing: Listing) => ContentBlock;
  getImageUrls: (listing: Listing) => string[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    id: 'stream-setsumei',
    labelKey: 'dealer.setsumei',
    hasData: (l) => !!(l.setsumei_text_en || l.setsumei_text_ja),
    buildBlock: (l) => ({
      type: 'setsumei',
      textEn: l.setsumei_text_en || null,
      textJa: l.setsumei_text_ja || null,
      imageUrl: l.setsumei_image_url || null,
      metadata: (l.setsumei_metadata as Record<string, unknown>) || null,
    }),
    getImageUrls: (l) => l.setsumei_image_url ? [l.setsumei_image_url] : [],
  },
  {
    id: 'stream-sayagaki',
    labelKey: 'dealer.sayagaki',
    hasData: (l) => !!(l.sayagaki && l.sayagaki.length > 0),
    buildBlock: (l) => ({ type: 'sayagaki', data: l.sayagaki! }),
    getImageUrls: (l) => (l.sayagaki || []).flatMap(e => e.images || []),
  },
  {
    id: 'stream-hakogaki',
    labelKey: 'dealer.hakogaki',
    hasData: (l) => !!(l.hakogaki && l.hakogaki.length > 0),
    buildBlock: (l) => ({ type: 'hakogaki', data: l.hakogaki! }),
    getImageUrls: (l) => (l.hakogaki || []).flatMap(e => e.images || []),
  },
  {
    id: 'stream-provenance',
    labelKey: 'dealer.provenance',
    hasData: (l) => !!(l.provenance && l.provenance.length > 0),
    buildBlock: (l) => ({ type: 'provenance', data: l.provenance! }),
    getImageUrls: (l) => (l.provenance || []).flatMap(e => e.images || []),
  },
  {
    id: 'stream-kiwame',
    labelKey: 'dealer.kiwame',
    hasData: (l) => !!(l.kiwame && l.kiwame.length > 0),
    buildBlock: (l) => ({ type: 'kiwame', data: l.kiwame! }),
    getImageUrls: () => [],
  },
  {
    id: 'stream-koshirae',
    labelKey: 'dealer.koshirae',
    hasData: (l) => !!l.koshirae,
    buildBlock: (l) => ({
      type: 'koshirae',
      data: l.koshirae!,
      hideHeading: l.item_type?.toLowerCase() === 'koshirae',
    }),
    getImageUrls: (l) => l.koshirae?.images || [],
  },
  {
    id: 'stream-kanto-hibisho',
    labelKey: 'dealer.kantoHibisho',
    hasData: (l) => !!l.kanto_hibisho,
    buildBlock: (l) => ({ type: 'kanto_hibisho', data: l.kanto_hibisho! }),
    getImageUrls: (l) => l.kanto_hibisho?.images || [],
  },
];

// ============================================================================
// Main function
// ============================================================================

export function buildContentStream(
  displayImages: string[],
  listing: Listing | null,
  detailLoaded: boolean,
  videoItems: VideoMediaItem[] = [],
): ContentStreamResult {
  const EMPTY: ContentStreamResult = {
    blocks: [],
    imageCount: 0,
    allImageUrls: [],
    sections: [],
  };

  if (!listing) return EMPTY;

  const blocks: ContentBlock[] = [];
  const allImageUrls: string[] = [];
  const sections: SectionIndicator[] = [];
  let globalIndex = 0;

  // Collect all section image URLs for dedup against primary photos
  const sectionImageUrls = detailLoaded ? getSectionImageUrls(listing) : new Set<string>();

  // 1. Hero image
  if (displayImages.length > 0) {
    blocks.push({ type: 'hero_image', src: displayImages[0], globalIndex: 0 as const });
    allImageUrls.push(displayImages[0]);
    globalIndex = 1;
  }

  // 2. Curator note
  if (listing.ai_curator_note_en || listing.ai_curator_note_ja) {
    blocks.push({
      type: 'curator_note',
      noteEn: listing.ai_curator_note_en || null,
      noteJa: listing.ai_curator_note_ja || null,
    });
  }

  // 3. Videos
  for (const video of videoItems) {
    blocks.push({
      type: 'video',
      streamUrl: video.streamUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      status: video.status,
      videoId: video.videoId,
      globalIndex: globalIndex++,
    });
  }

  // 4. Remaining photos — deduplicated against section images
  for (let i = 1; i < displayImages.length; i++) {
    const url = displayImages[i];
    if (sectionImageUrls.has(url)) continue; // Will appear in its section instead
    blocks.push({ type: 'image', src: url, globalIndex: globalIndex++ });
    allImageUrls.push(url);
  }

  // 5. Section blocks — only when detail data is loaded
  if (detailLoaded) {
    for (const def of SECTION_DEFS) {
      if (!def.hasData(listing)) continue;

      // Divider before section
      blocks.push({
        type: 'section_divider',
        labelKey: def.labelKey,
        sectionId: def.id,
      });

      // Section content block
      blocks.push(def.buildBlock(listing));

      // Track section images in allImageUrls (for lightbox navigation)
      const sectionImgs = def.getImageUrls(listing);
      for (const url of sectionImgs) {
        allImageUrls.push(url);
      }

      // Record section indicator
      sections.push({ id: def.id, labelKey: def.labelKey });
    }
  }

  const imageCount = allImageUrls.length;

  return { blocks, imageCount, allImageUrls, sections };
}
