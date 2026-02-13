'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';

// Blur placeholder (linen-colored SVG)
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

/**
 * Lazy-loaded image component with intersection observer, retry logic,
 * and Mobile Safari compatibility fixes.
 *
 * Shared between browse QuickView and collection QuickView.
 *
 * On error, retries once with unoptimized=true (bypasses Next.js image optimization).
 */
export function LazyImage({
  src,
  index,
  totalImages,
  isVisible,
  onVisible,
  isFirst,
  showScrollHint,
  title,
  itemType,
  certType,
  cachedDimensions,
  onLoadFailed,
}: {
  src: string;
  index: number;
  totalImages: number;
  isVisible: boolean;
  onVisible: (index: number) => void;
  isFirst: boolean;
  showScrollHint: boolean;
  title?: string;
  itemType?: string | null;
  certType?: string | null;
  cachedDimensions?: { width: number; height: number } | null;
  onLoadFailed?: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useUnoptimized, setUseUnoptimized] = useState(false);

  const hasKnownDimensions = !!cachedDimensions;

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setRetryCount(0);
    setUseUnoptimized(false);
  }, [src]);

  // Mobile Safari fix: onLoad doesn't always fire on initial page load from deep links.
  // See: https://bugs.webkit.org/show_bug.cgi?id=233419
  useEffect(() => {
    if (!isVisible || loaded || error) return;

    const checkComplete = () => {
      const container = ref.current;
      if (!container) return false;
      const img = container.querySelector('img');
      if (img && img.complete && img.naturalWidth > 0) {
        setLoaded(true);
        return true;
      }
      return false;
    };

    const immediateCheck = requestAnimationFrame(() => { checkComplete(); });

    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
    if (isFirst) {
      fallbackTimeout = setTimeout(() => {
        if (!loaded && !error) {
          if (checkComplete()) return;
          console.warn(`[LazyImage] Fallback: forcing loaded state for image ${index} after timeout`);
          setLoaded(true);
        }
      }, 3000);
    }

    return () => {
      cancelAnimationFrame(immediateCheck);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [isVisible, loaded, error, isFirst, index]);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onVisible(index);
        });
      },
      { rootMargin: '200px 0px', threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onVisible]);

  const handleError = () => {
    if (retryCount === 0) {
      setRetryCount(1);
      setUseUnoptimized(true);
      setLoaded(false);
    } else {
      setError(true);
      onLoadFailed?.(index);
    }
  };

  // Container style with dynamic aspect ratio when dimensions are known
  const containerStyle = hasKnownDimensions
    ? { aspectRatio: `${cachedDimensions!.width} / ${cachedDimensions!.height}` }
    : undefined;

  const containerClass = `relative bg-linen rounded overflow-hidden ${
    !hasKnownDimensions && !loaded && !error && isVisible ? 'min-h-[200px]' : ''
  }`;

  return (
    <div ref={ref} className={containerClass} style={containerStyle}>
      {isVisible ? (
        <>
          {!loaded && !error && (
            <div className={`absolute inset-0 img-loading ${!hasKnownDimensions ? 'min-h-[200px]' : ''}`} />
          )}

          {error && (
            <div className="aspect-[3/4] flex items-center justify-center bg-linen">
              <span className="text-muted text-sm">Failed to load</span>
            </div>
          )}

          {!error && (
            <Image
              key={`${src}-${retryCount}`}
              src={src}
              alt={[itemType, certType, title, `Photo ${index + 1} of ${totalImages}`].filter(Boolean).join(' - ')}
              {...(hasKnownDimensions
                ? { fill: true, className: `object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}` }
                : {
                    width: 800,
                    height: 600,
                    className: `w-full h-auto transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`,
                    style: { width: '100%', height: 'auto' },
                  }
              )}
              onLoad={() => setLoaded(true)}
              onError={handleError}
              loading={isFirst ? 'eager' : 'lazy'}
              fetchPriority={isFirst ? 'high' : undefined}
              placeholder="blur"
              blurDataURL={BLUR_PLACEHOLDER}
              sizes="(max-width: 1024px) 100vw, 60vw"
              unoptimized={useUnoptimized}
            />
          )}


          {/* Scroll hint on first image */}
          {showScrollHint && loaded && (
            <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none animate-pulse">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink/60 backdrop-blur-md">
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[12px] text-white/90 font-medium">
                  {totalImages - 1} more photos
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="bg-linen flex items-center justify-center"
          style={hasKnownDimensions
            ? { aspectRatio: `${cachedDimensions!.width} / ${cachedDimensions!.height}` }
            : { aspectRatio: '3 / 4' }
          }
        >
          <div className="w-8 h-8 border-2 border-border border-t-gold rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
