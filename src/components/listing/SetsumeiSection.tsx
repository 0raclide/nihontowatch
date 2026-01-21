'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Listing, CertificationType } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface SetsumeiSectionProps {
  listing: Listing;
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

  // Only show for Juyo/Tokubetsu Juyo items
  if (!hasSetsumeiCertification(listing.cert_type)) {
    return null;
  }

  const hasSetsumei = !!listing.setsumei_text_en;
  const hasOriginal = !!listing.setsumei_text_ja;

  // Default padding classes (can be overridden via className)
  const baseClasses = className.includes('px-0') ? 'py-3' : 'px-4 py-3 lg:px-5';

  // "Coming soon" state for items without setsumei yet
  if (!hasSetsumei) {
    return (
      <div className={`${baseClasses} ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            Official NBTHK Evaluation
          </h3>
        </div>
        <div className="bg-surface-elevated/50 border border-border rounded-lg p-4 text-center">
          <p className="text-sm text-muted">
            Official evaluation translation coming soon
          </p>
          <p className="text-[10px] text-muted/70 mt-1">
            This {listing.cert_type} designation includes an official commentary that will be translated.
          </p>
        </div>
      </div>
    );
  }

  // Determine what text to display
  const displayText = showOriginal
    ? listing.setsumei_text_ja || listing.setsumei_text_en
    : listing.setsumei_text_en;

  // For preview mode, truncate the text
  const isPreview = variant === 'preview';
  const needsTruncation = isPreview && displayText && displayText.length > previewLength;
  const visibleText = needsTruncation && !isExpanded
    ? truncateText(displayText || '', previewLength)
    : displayText;

  return (
    <div className={`${baseClasses} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            Official NBTHK Evaluation
          </h3>
          <span className="text-[9px] px-1.5 py-0.5 bg-gold/10 text-gold rounded">
            {listing.cert_type}
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

      {/* Content */}
      <div className="bg-surface-elevated/30 border border-gold/20 rounded-lg p-4">
        {showOriginal ? (
          // Japanese text - preserve whitespace
          <p className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-line font-jp">
            {visibleText}
          </p>
        ) : (
          // English markdown
          <div className="prose prose-sm prose-invert max-w-none text-ink/80
            prose-headings:text-ink prose-headings:font-medium prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0
            prose-h2:text-[15px] prose-h3:text-[13px]
            prose-p:text-[13px] prose-p:leading-relaxed prose-p:mb-3
            prose-li:text-[13px] prose-li:my-0.5
            prose-strong:text-ink prose-strong:font-medium
            prose-table:text-[12px]
            [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-surface
            [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
          ">
            <ReactMarkdown>{visibleText || ''}</ReactMarkdown>
          </div>
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
    </div>
  );
}

export default SetsumeiSection;
