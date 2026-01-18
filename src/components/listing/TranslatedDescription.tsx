'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Listing } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface TranslatedDescriptionProps {
  listing: Listing;
  className?: string;
  maxLines?: number;
}

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslatedDescription({
  listing,
  className = '',
  maxLines = 6,
}: TranslatedDescriptionProps) {
  const [translation, setTranslation] = useState<string | null>(listing.description_en || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Check if description has Japanese text
  const hasJapanese = listing.description ? JAPANESE_REGEX.test(listing.description) : false;

  // Fetch translation if needed
  const fetchTranslation = useCallback(async () => {
    if (!listing.description || translation || !hasJapanese) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });

      const data = await response.json();

      if (data.translation) {
        setTranslation(data.translation);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Translation fetch error:', err);
      setError('Failed to load translation');
    } finally {
      setIsLoading(false);
    }
  }, [listing.id, listing.description, translation, hasJapanese]);

  // Trigger translation on mount if needed
  useEffect(() => {
    if (listing.description && hasJapanese && !listing.description_en) {
      fetchTranslation();
    }
  }, [listing.description, listing.description_en, hasJapanese, fetchTranslation]);

  // Reset expanded state when listing changes or when toggling original/translation
  useEffect(() => {
    setIsExpanded(false);
    setIsTruncated(false);
  }, [listing.id, showOriginal]);

  // Detect if text is truncated (needs "Read more")
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current && !isExpanded) {
        // Compare scroll height vs client height to detect overflow
        const { scrollHeight, clientHeight } = textRef.current;
        setIsTruncated(scrollHeight > clientHeight + 1); // +1 for rounding
      }
    };

    // Check after render and on resize
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [translation, showOriginal, isLoading, isExpanded]);

  // No description to show
  if (!listing.description) {
    return null;
  }

  // Determine which text to display
  const displayText = showOriginal ? listing.description : (translation || listing.description);

  return (
    <div className={`px-4 py-3 lg:px-5 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted font-medium">
          Description
        </h3>
        {/* Show toggle only if we have both original and translation */}
        {hasJapanese && translation && translation !== listing.description && (
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-[10px] text-gold hover:text-gold-light transition-colors"
          >
            {showOriginal ? 'Show translation' : 'Show original'}
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-border rounded w-full" />
          <div className="h-3 bg-border rounded w-[90%]" />
          <div className="h-3 bg-border rounded w-[75%]" />
        </div>
      )}

      {/* Error state - show original */}
      {error && !isLoading && (
        <>
          <p
            ref={textRef}
            className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-line"
            style={isExpanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {listing.description}
          </p>
          <p className="text-[10px] text-muted mt-1">(Translation unavailable)</p>
          {(isTruncated || isExpanded) && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[12px] text-gold hover:text-gold-light transition-colors mt-2 font-medium"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}

      {/* Normal display */}
      {!isLoading && !error && (
        <>
          <p
            ref={textRef}
            className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-line"
            style={isExpanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {displayText}
          </p>
          {(isTruncated || isExpanded) && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[12px] text-gold hover:text-gold-light transition-colors mt-2 font-medium"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default TranslatedDescription;
