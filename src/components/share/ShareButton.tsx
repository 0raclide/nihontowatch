'use client';

import { useState, useCallback } from 'react';

interface ShareButtonProps {
  listingId: number;
  title?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** OG image URL from the listing - used to extract version for cache-busting */
  ogImageUrl?: string | null;
}

/**
 * Extract version from og_image_url for cache-busting
 * Filename format: dealer/LISTING_TIMESTAMP.png
 * Example: aoi-art/L00007_1768921557.png → returns "1768921557"
 */
function extractVersion(ogImageUrl: string | null | undefined): string {
  if (!ogImageUrl) return 'v1';

  // Try to extract timestamp from filename
  const match = ogImageUrl.match(/_(\d+)\.png/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: hash the URL for consistency
  let hash = 0;
  for (let i = 0; i < ogImageUrl.length; i++) {
    const char = ogImageUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Share button for copying listing URLs or using native share on mobile.
 * Shows a toast notification on successful copy.
 *
 * Uses the /s/[id]?v=[version] share proxy route to solve Discord's
 * OG image caching problem. Discord caches by page URL, so changing
 * the version creates a fresh cache entry.
 */
export function ShareButton({
  listingId,
  title = 'Check out this listing on NihontoWatch',
  className = '',
  size = 'md',
  ogImageUrl,
}: ShareButtonProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const buildShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';

    const baseUrl = window.location.origin;

    // Use the share proxy route with version for social sharing
    // This solves Discord's OG image caching problem
    const version = extractVersion(ogImageUrl);
    return `${baseUrl}/s/${listingId}?v=${version}`;
  }, [listingId, ogImageUrl]);

  const handleShare = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = buildShareUrl();

    // Detect mobile device (not just touch support, but actual mobile)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Only use native Web Share API on actual mobile devices
    // (macOS Safari has navigator.share but opens a sheet instead of sharing)
    if (isMobile && navigator.share) {
      const shareData = {
        title: 'NihontoWatch',
        text: title,
        url: shareUrl,
      };

      if (navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          return; // Native share handles its own feedback
        } catch (err) {
          // User cancelled or error - fall through to clipboard
          if ((err as Error).name === 'AbortError') return;
        }
      }
    }

    // Desktop and fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('Link copied!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setToastMessage('Failed to copy');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  }, [buildShareUrl, title]);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        data-share-button
        className={`
          ${sizeClasses[size]}
          flex items-center justify-center
          rounded-full
          transition-all duration-200
          bg-paper/80 text-muted hover:text-gold hover:bg-paper
          backdrop-blur-sm
          shadow-sm hover:shadow-md
          ${className}
        `}
        aria-label="Share listing"
        title="Share listing"
      >
        {/* Share icon - network/nodes style */}
        <svg
          className={iconSizes[size]}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
          />
        </svg>
      </button>

      {/* Inline toast notification */}
      {showToast && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 px-3 py-1.5 bg-ink text-cream text-[11px] font-medium rounded-full shadow-lg whitespace-nowrap animate-fadeIn">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
