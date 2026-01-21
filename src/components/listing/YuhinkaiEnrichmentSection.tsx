'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { YuhinkaiEnrichment, ListingWithEnrichment } from '@/types';
import { hasVerifiedEnrichment } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface YuhinkaiEnrichmentSectionProps {
  listing: ListingWithEnrichment;
  className?: string;
  /** Preview mode shows truncated content */
  variant?: 'preview' | 'full';
  /** Maximum characters to show in preview mode */
  previewLength?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
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

/**
 * Displays Yuhinkai catalog enrichment data for a listing.
 *
 * Shows professional English translation from the official catalog,
 * along with verified artisan and certification information.
 *
 * Only renders for listings with DEFINITIVE confidence matches.
 */
export function YuhinkaiEnrichmentSection({
  listing,
  className = '',
  variant = 'full',
  previewLength = 400,
}: YuhinkaiEnrichmentSectionProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show for verified enrichments
  if (!hasVerifiedEnrichment(listing)) {
    return null;
  }

  const enrichment = listing.yuhinkai_enrichment!;
  const hasSetsumeiEn = !!enrichment.setsumei_en;
  const hasSetsumeiJa = !!enrichment.setsumei_ja;

  // Default padding classes
  const baseClasses = className.includes('px-0') ? 'py-3' : 'px-4 py-3 lg:px-5';

  // If no setsumei translation, show minimal enrichment info
  if (!hasSetsumeiEn) {
    // Still show enriched metadata if available
    if (!enrichment.enriched_maker && !enrichment.enriched_school) {
      return null;
    }

    return (
      <div className={`${baseClasses} ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            Catalog Data
          </h3>
          <span className="text-[9px] px-1.5 py-0.5 bg-gold/10 text-gold rounded border border-gold/30">
            Verified
          </span>
        </div>
        <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
          {enrichment.enriched_maker && (
            <div className="mb-2">
              <span className="text-[10px] text-muted uppercase tracking-wider">Artisan</span>
              <p className="text-sm text-ink font-medium">{enrichment.enriched_maker}</p>
            </div>
          )}
          {enrichment.enriched_school && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">School</span>
              <p className="text-sm text-ink">{enrichment.enriched_school}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine display text
  const displayText = showOriginal
    ? enrichment.setsumei_ja || enrichment.setsumei_en
    : enrichment.setsumei_en;

  // Truncation for preview mode
  const isPreview = variant === 'preview';
  const needsTruncation = isPreview && displayText && displayText.length > previewLength;
  const visibleText = needsTruncation && !isExpanded
    ? truncateText(displayText || '', previewLength)
    : displayText;

  return (
    <div className={`${baseClasses} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] uppercase tracking-wider text-gold font-medium">
            Official Catalog Translation
          </h3>
          {enrichment.enriched_cert_type && (
            <span className="text-[9px] px-1.5 py-0.5 bg-gold/10 text-gold rounded border border-gold/30">
              {enrichment.enriched_cert_type}
              {enrichment.enriched_cert_session && ` #${enrichment.enriched_cert_session}`}
            </span>
          )}
        </div>
        {/* Toggle for original Japanese */}
        {variant === 'full' && hasSetsumeiJa && (
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-[10px] text-gold hover:text-gold-light transition-colors"
          >
            {showOriginal ? 'Show translation' : 'Show original'}
          </button>
        )}
      </div>

      {/* Enriched metadata row */}
      {(enrichment.enriched_maker || enrichment.enriched_school || enrichment.enriched_period) && (
        <div className="flex flex-wrap gap-4 mb-3 text-[11px]">
          {enrichment.enriched_maker && (
            <div>
              <span className="text-muted">Artisan: </span>
              <span className="text-ink font-medium">{enrichment.enriched_maker}</span>
            </div>
          )}
          {enrichment.enriched_school && (
            <div>
              <span className="text-muted">School: </span>
              <span className="text-ink">{enrichment.enriched_school}</span>
            </div>
          )}
          {enrichment.enriched_period && (
            <div>
              <span className="text-muted">Period: </span>
              <span className="text-ink">{enrichment.enriched_period}</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
        {showOriginal ? (
          // Japanese text
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
            {enrichment.setsumei_en_format === 'markdown' ? (
              <ReactMarkdown>{visibleText || ''}</ReactMarkdown>
            ) : (
              <p className="whitespace-pre-line">{visibleText}</p>
            )}
          </div>
        )}

        {/* Expand/collapse for preview mode */}
        {isPreview && needsTruncation && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-[11px] text-gold hover:text-gold-light transition-colors"
          >
            {isExpanded ? 'Show less' : 'Read full translation'}
          </button>
        )}
      </div>

      {/* Footer with source info */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
        <span>
          Source: Yuhinkai Catalog
          {enrichment.yuhinkai_collection && ` (${enrichment.yuhinkai_collection})`}
        </span>
        <span>
          Match: {(enrichment.match_score * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
