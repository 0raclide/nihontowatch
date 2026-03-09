/**
 * Centralized QuickView layout dimensions.
 *
 * Dealer listings get a wider modal on desktop so curated photography
 * and content streams have more breathing room. To make dealer even wider,
 * change `modal.dealer` to 'max-w-7xl' (1280px). One line.
 */
export const QUICKVIEW_LAYOUT = {
  modal: {
    default: 'max-w-4xl',     // 896px — browse / collection
    dealer: 'max-w-6xl',      // 1152px — dealer content stream
  },
  leftPanel: {
    default: 'w-3/5',         // 60% — browse / collection
    dealer: 'w-[65%]',        // 65% — dealer content stream
  },
  rightPanel: {
    default: { width: 'w-2/5', maxWidth: 'max-w-md' },    // browse / collection
    dealer:  { width: 'w-[35%]', maxWidth: 'max-w-sm' },   // dealer StatsCard
  },
} as const;
