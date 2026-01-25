'use client';

import { useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import type { Listing, ListingWithEnrichment, CertificationType } from '@/types';
import { getSetsumeiContent } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface SetsumeiSectionProps {
  listing: Listing | ListingWithEnrichment;
  className?: string;
  /** Preview mode shows truncated content with "Read more" link */
  variant?: 'preview' | 'full';
  /** Maximum characters to show in preview mode */
  previewLength?: number;
  /** Callback when user clicks "Read full evaluation" in preview mode */
  onReadMore?: () => void;
}

// Certification types that have setsumei
const SETSUMEI_CERT_TYPES: CertificationType[] = ['Juyo', 'Tokubetsu Juyo'];

// =============================================================================
// HELPERS
// =============================================================================

function hasSetsumeiCertification(certType?: CertificationType | string): boolean {
  if (!certType) return false;
  return SETSUMEI_CERT_TYPES.includes(certType as CertificationType);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  // Find a good break point (end of sentence or paragraph)
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);
  if (breakPoint > maxLength * 0.7) {
    return truncated.slice(0, breakPoint + 1);
  }
  return truncated + '...';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SetsumeiSection({
  listing,
  className = '',
  variant = 'full',
  previewLength = 300,
  onReadMore,
}: SetsumeiSectionProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { canAccess, showPaywall } = useSubscription();

  // Only show for Juyo/Tokubetsu Juyo items
  if (!hasSetsumeiCertification(listing.cert_type)) {
    return null;
  }

  // Get best available setsumei (prefers Yuhinkai over OCR)
  const setsumei = getSetsumeiContent(listing as ListingWithEnrichment);
  const hasSetsumei = !!setsumei?.text_en;
  const hasOriginal = !!setsumei?.text_ja;
  const hasAccess = canAccess('setsumei_translation');
  const isYuhinkai = setsumei?.source === 'yuhinkai';

  // Default padding classes (can be overridden via className)
  const baseClasses = className.includes('px-0') ? 'py-3' : 'px-4 py-3 lg:px-5';

  // "Coming soon" state for items without setsumei yet
  if (!hasSetsumei) {
    return (
      <div className={`${baseClasses} ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            NBTHK Zufu Commentary
          </h3>
        </div>
        <div className="bg-surface-elevated/50 border border-border rounded-lg p-4 text-center">
          <p className="text-sm text-muted">
            Translation coming soon
          </p>
          <p className="text-[10px] text-muted/70 mt-1">
            This {listing.cert_type} designation includes Zufu commentary that will be translated.
          </p>
        </div>
      </div>
    );
  }

  // Gated state - show preview for users without access
  if (!hasAccess) {
    const fullText = setsumei?.text_en || '';
    // Show ~1/3 of content as readable preview
    const gatedPreviewLength = Math.min(Math.floor(fullText.length / 3), 400);
    const previewText = fullText.slice(0, gatedPreviewLength);
    // Find a good break point (end of sentence or word)
    const lastPeriod = previewText.lastIndexOf('.');
    const lastSpace = previewText.lastIndexOf(' ');
    const breakPoint = lastPeriod > gatedPreviewLength * 0.7 ? lastPeriod + 1 : lastSpace;
    const cleanPreview = breakPoint > 0 ? previewText.slice(0, breakPoint) : previewText;
    const certLabel = setsumei?.cert_type || listing.cert_type;

    return (
      <div className={`${baseClasses} ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
              {isYuhinkai ? 'Official Catalog Translation' : 'NBTHK Zufu Commentary'}
            </h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-gold/10 text-gold rounded">
              {certLabel}
              {setsumei?.cert_session && ` #${setsumei.cert_session}`}
            </span>
          </div>
        </div>

        {/* Only show AI disclaimer for OCR translations */}
        {!isYuhinkai && (
          <p className="text-[10px] text-muted/70 mb-2 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>AI translation — may contain errors</span>
          </p>
        )}

        {/* Gated Content - readable preview that fades */}
        <div className={`${isYuhinkai ? 'bg-gold/5 border-gold/20' : 'bg-surface-elevated/30 border-gold/20'} border rounded-lg p-4 relative overflow-hidden`}>
          {/* Readable preview text */}
          <article className="prose-translation">
            <HighlightedMarkdown content={cleanPreview} variant="translation" />
          </article>

          {/* Fade overlay with CTA - pointer-events-none allows clicking glossary terms through the gradient */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface via-surface/95 to-transparent flex flex-col items-center justify-end pb-4 pointer-events-none">
            <p className="text-[11px] text-muted mb-2 text-center">
              Continue reading the full NBTHK evaluation...
            </p>
            <button
              type="button"
              onClick={() => showPaywall('setsumei_translation')}
              className="px-4 py-2 text-[12px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors flex items-center gap-1.5 shadow-lg pointer-events-auto"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Unlock Full Translation
            </button>
          </div>
        </div>

        {/* Source attribution for Yuhinkai */}
        {isYuhinkai && (
          <div className="mt-2 text-[10px] text-muted">
            Source: Yuhinkai Catalog
          </div>
        )}
      </div>
    );
  }

  // Determine what text to display
  const displayText = showOriginal
    ? setsumei?.text_ja || setsumei?.text_en
    : setsumei?.text_en;
  const certLabel = setsumei?.cert_type || listing.cert_type;

  // For preview mode, truncate the text
  const isPreview = variant === 'preview';
  const needsTruncation = isPreview && displayText && displayText.length > previewLength;
  const visibleText = needsTruncation && !isExpanded
    ? truncateText(displayText || '', previewLength)
    : displayText;

  return (
    <div className={`${baseClasses} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            {isYuhinkai ? 'Official Catalog Translation' : 'NBTHK Zufu Commentary'}
          </h3>
          <span className="text-[9px] px-1.5 py-0.5 bg-gold/10 text-gold rounded">
            {certLabel}
            {setsumei?.cert_session && ` #${setsumei.cert_session}`}
          </span>
        </div>
        {/* Toggle for original Japanese - only in full mode with original available */}
        {variant === 'full' && hasOriginal && (
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-[10px] text-gold hover:text-gold-light transition-colors"
          >
            {showOriginal ? 'Show translation' : 'Show original'}
          </button>
        )}
      </div>

      {/* AI translation disclaimer - only show for OCR when viewing English translation */}
      {!showOriginal && !isYuhinkai && (
        <p className="text-[10px] text-muted/70 mb-2 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>AI translation — may contain errors</span>
        </p>
      )}

      {/* Content */}
      <div className={`${isYuhinkai ? 'bg-gold/5 border-gold/20' : 'bg-surface-elevated/30 border-gold/20'} border rounded-lg p-4`}>
        {showOriginal ? (
          // Japanese text - preserve whitespace
          <p className="text-[14.5px] text-ink/80 leading-[1.85] whitespace-pre-line font-jp">
            {visibleText}
          </p>
        ) : (
          // English markdown with scholarly typography
          <article className="prose-translation">
            <HighlightedMarkdown content={visibleText || ''} variant="translation" />
          </article>
        )}

        {/* Read more / Show less buttons - works in both preview and full modes */}
        {needsTruncation && (
          <button
            type="button"
            onClick={() => {
              if (onReadMore && !isExpanded) {
                // If callback provided and not yet expanded, use callback
                onReadMore();
              } else {
                // Otherwise toggle in-place expansion
                setIsExpanded(!isExpanded);
              }
            }}
            className="text-[12px] text-gold hover:text-gold-light transition-colors mt-3 font-medium"
          >
            {isExpanded ? 'Show less' : 'Read full evaluation'}
          </button>
        )}

        {/* Full mode: also show expand for long text even if not truncated by previewLength */}
        {variant === 'full' && !needsTruncation && displayText && displayText.length > 1000 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[12px] text-gold hover:text-gold-light transition-colors mt-3 font-medium"
          >
            {isExpanded ? 'Show less' : 'Read full evaluation'}
          </button>
        )}
      </div>

      {/* Source attribution for Yuhinkai */}
      {isYuhinkai && (
        <div className="mt-2 text-[10px] text-muted">
          Source: Yuhinkai Catalog
        </div>
      )}
    </div>
  );
}

export default SetsumeiSection;
