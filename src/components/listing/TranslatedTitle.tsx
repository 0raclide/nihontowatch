'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Listing } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface TranslatedTitleProps {
  listing: Listing;
  className?: string;
}

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * TranslatedTitle displays the listing title with automatic Japanese translation.
 *
 * Behavior:
 * - Shows original title immediately
 * - If Japanese detected and no cached translation, fetches translation
 * - Seamlessly swaps to translated text when ready (no loading state)
 * - Uses cached title_en if available
 */
export function TranslatedTitle({
  listing,
  className = '',
}: TranslatedTitleProps) {
  // Use cached translation if available, otherwise original title
  const [displayTitle, setDisplayTitle] = useState<string>(
    listing.title_en || listing.title || 'Untitled'
  );
  const [isTranslating, setIsTranslating] = useState(false);

  // Check if title has Japanese text that needs translation
  const hasJapanese = listing.title ? JAPANESE_REGEX.test(listing.title) : false;
  const needsTranslation = hasJapanese && !listing.title_en;

  // Fetch translation if needed
  const fetchTranslation = useCallback(async () => {
    if (!listing.title || !needsTranslation || isTranslating) return;

    setIsTranslating(true);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          type: 'title',
        }),
      });

      const data = await response.json();

      if (data.translation) {
        setDisplayTitle(data.translation);
      }
    } catch (err) {
      console.error('Title translation fetch error:', err);
      // Keep original title on error
    } finally {
      setIsTranslating(false);
    }
  }, [listing.id, listing.title, needsTranslation, isTranslating]);

  // Trigger translation on mount if needed
  useEffect(() => {
    if (needsTranslation) {
      fetchTranslation();
    }
  }, [needsTranslation, fetchTranslation]);

  // Update display title if listing changes
  useEffect(() => {
    setDisplayTitle(listing.title_en || listing.title || 'Untitled');
  }, [listing.title, listing.title_en]);

  // No title to show
  if (!listing.title) {
    return null;
  }

  return (
    <h2 className={`font-serif text-lg text-ink leading-snug ${className}`}>
      {displayTitle}
    </h2>
  );
}

export default TranslatedTitle;
