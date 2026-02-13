/**
 * Shared card height calculations.
 *
 * Single source of truth for:
 *  - Responsive breakpoints (matching Tailwind defaults)
 *  - Column count at a given viewport width
 *  - Card height from first principles (header + image + content + border)
 *  - Row height (card + gap) for JS virtual scroll
 *  - Pre-computed mobile heights for CSS content-visibility
 */

// ---------------------------------------------------------------------------
// Breakpoints & column count
// ---------------------------------------------------------------------------

export const BREAKPOINTS = {
  sm: 640,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Column count at a given viewport width.
 * Matches CSS grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5
 */
export function getColumnCount(width: number): number {
  if (width >= BREAKPOINTS['2xl']) return 5;
  if (width >= BREAKPOINTS.xl) return 4;
  if (width >= BREAKPOINTS.lg) return 3;
  if (width >= BREAKPOINTS.sm) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Card height (no gap)
// ---------------------------------------------------------------------------

/**
 * Compute card height from first principles.
 *
 * Card structure (Refined layout):
 *   Header:  px-3 py-2  (lg: px-4 py-2.5) — dealer + cert text
 *   Image:   aspect-[3/4] — height = cardWidth * 4/3
 *   Content: px-3 pt-3 pb-3 (lg: px-4 pt-3.5 pb-4) — type + attribution + price
 *   Border:  1px top + 1px bottom
 */
export function getCardHeight(columns: number, viewportWidth?: number): number {
  const vw = viewportWidth || (columns >= 3 ? 1280 : 768);

  // Container: max-w-[1600px] with px-4 (lg: px-6)
  const px = vw >= 1024 ? 24 : 16;
  const containerWidth = Math.min(vw - px * 2, 1600 - px * 2);

  // Sidebar: w-[264px] + lg:gap-10 (40px), only on lg+
  const sidebarSpace = vw >= 1024 ? 264 + 40 : 0;
  const gridWidth = containerWidth - sidebarSpace;

  // Grid gap: gap-2.5 (10px) for 2-col grid mobile, gap-10 (40px) gallery, sm:gap-4 (16px) tablet+
  const gap = columns === 1 ? 40 : columns === 2 && vw < BREAKPOINTS.sm ? 10 : 16;
  const cardWidth = (gridWidth - (columns - 1) * gap) / columns;

  const isLg = vw >= 1024;
  const headerH = isLg ? 34 : 28;
  const imageH = Math.round(cardWidth * 4 / 3);
  const contentH = isLg ? 115 : 106;
  const borderH = 2;

  return headerH + imageH + contentH + borderH;
}

// ---------------------------------------------------------------------------
// Row height (card + gap) — used by JS virtual scroll
// ---------------------------------------------------------------------------

/**
 * Estimate row height = card + grid gap.
 */
export function getRowHeight(columns: number, viewportWidth?: number): number {
  const vw = viewportWidth || (columns >= 3 ? 1280 : 768);
  const gap = columns === 1 ? 40 : columns === 2 && vw < BREAKPOINTS.sm ? 10 : 16;
  return getCardHeight(columns, vw) + gap;
}

// ---------------------------------------------------------------------------
// Pre-computed mobile card heights for CSS content-visibility
// ---------------------------------------------------------------------------

/**
 * Heights for a typical 375px mobile viewport (iPhone SE / standard).
 * Used as the CSS `contain-intrinsic-block-size` value via
 * `--card-intrinsic-height` custom property.
 */
export const MOBILE_CARD_HEIGHTS = {
  grid: getCardHeight(2, 375),
  gallery: getCardHeight(1, 375),
} as const;
