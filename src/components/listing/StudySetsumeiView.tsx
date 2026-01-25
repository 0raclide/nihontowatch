'use client';

import { useState } from 'react';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import type { ListingWithEnrichment } from '@/types';
import { getSetsumeiContent } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface StudySetsumeiViewProps {
  listing: ListingWithEnrichment;
  onBackToPhotos: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Premium setsumei reading view for QuickView study mode.
 * Displays the NBTHK/Yuhinkai setsumei in a beautifully formatted layout.
 */
export function StudySetsumeiView({ listing, onBackToPhotos }: StudySetsumeiViewProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const setsumei = getSetsumeiContent(listing);

  if (!setsumei) {
    return null;
  }

  const displayText = showOriginal && setsumei.text_ja
    ? setsumei.text_ja
    : setsumei.text_en;

  const hasOriginal = !!setsumei.text_ja;

  return (
    <div className="h-full flex flex-col bg-linen" data-testid="study-setsumei-view">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gold/20 bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] uppercase tracking-wider text-gold font-semibold">
              NBTHK Setsumei
            </h2>
            {setsumei.cert_type && (
              <span className="text-[10px] px-2 py-0.5 bg-gold/10 text-gold rounded-full border border-gold/30 font-medium">
                {setsumei.cert_type}
                {setsumei.cert_session && ` #${setsumei.cert_session}`}
              </span>
            )}
          </div>
          <button
            onClick={onBackToPhotos}
            className="flex items-center gap-1.5 text-[12px] text-gold hover:text-gold-light transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Photos
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Content section */}
        <div className="px-4 py-5 lg:px-6">
          {/* Language toggle */}
          {hasOriginal && (
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gold hover:text-gold-light border border-gold/30 hover:border-gold/50 rounded-full transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {showOriginal ? 'Show English' : 'Show Japanese'}
              </button>
            </div>
          )}

          {/* AI translation disclaimer - only show for OCR when viewing English */}
          {setsumei.source === 'ocr' && !showOriginal && (
            <p className="text-[10px] text-muted/70 mb-3 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>AI translation — may contain errors</span>
            </p>
          )}

          {/* Main setsumei text */}
          <div className="bg-cream/50 border border-gold/15 rounded-xl p-5 shadow-sm">
            {showOriginal ? (
              // Japanese text
              <p className="text-[15px] lg:text-[16px] text-ink/85 leading-[1.9] whitespace-pre-line font-jp">
                {displayText}
              </p>
            ) : (
              // English markdown with scholarly typography
              <article className="prose-translation text-[15px] lg:text-[16px]">
                {setsumei.format === 'markdown' ? (
                  <HighlightedMarkdown content={displayText} variant="translation" />
                ) : (
                  <p className="whitespace-pre-line">{displayText}</p>
                )}
              </article>
            )}
          </div>

          {/* Source attribution */}
          <div className="mt-4 flex items-center justify-between text-[10px] text-muted">
            <span>
              Source: {setsumei.source === 'yuhinkai' ? 'Yuhinkai Catalog' : 'NBTHK Zufu'}
            </span>
            {setsumei.source === 'yuhinkai' && (
              <span className="text-gold font-medium">Official Translation</span>
            )}
          </div>
        </div>

        {/* Bottom padding for mobile safe area */}
        <div className="h-4 lg:h-8" />
      </div>
    </div>
  );
}

export default StudySetsumeiView;
