'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConsent } from '@/contexts/ConsentContext';
import Link from 'next/link';

// ============================================================================
// Icons
// ============================================================================

function CookieIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-.34-.02-.67-.05-1-.3.13-.63.2-.95.2-1.1 0-2-.9-2-2 0-.32.07-.63.2-.93-.33-.03-.67-.05-1-.05-.55 0-1 .45-1 1 0 .55-.45 1-1 1s-1-.45-1-1-.45-1-1-1-1 .45-1 1-.45 1-1 1c-.55 0-1-.45-1-1 0-.55-.45-1-1-1s-1 .45-1 1-.45 1-1 1c-.55 0-1-.45-1-1s-.45-1-1-1-.9.4-1 .9c-.03.35-.05.7-.05 1.05 0 5.52 4.48 10 10 10z"
      />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

// ============================================================================
// Cookie Banner Component
// ============================================================================

export function CookieBanner() {
  const { showBanner, acceptAll, rejectNonEssential, openPreferences } = useConsent();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Animate in after mount
  useEffect(() => {
    if (mounted && showBanner) {
      // Small delay for smooth animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [mounted, showBanner]);

  // Don't render until mounted (SSR safety)
  if (!mounted || !showBanner) return null;

  const banner = (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
    >
      {/* Subtle top shadow for depth */}
      <div className="absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />

      {/* Banner content */}
      <div className="bg-cream dark:bg-surface border-t border-border/50 safe-area-bottom">
        <div className="max-w-7xl mx-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Text content */}
            <div className="flex items-start gap-3 lg:gap-4 flex-1">
              <div className="hidden lg:flex w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 items-center justify-center flex-shrink-0">
                <CookieIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink leading-relaxed">
                  We use cookies to enhance your experience and analyze site usage.
                  You can customize your preferences or accept all cookies.{' '}
                  <Link
                    href="/cookies"
                    className="text-accent hover:underline focus:underline focus:outline-none"
                  >
                    Learn more
                  </Link>
                </p>
              </div>
            </div>

            {/* Buttons - equal visual weight (non-dark pattern) */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:flex-shrink-0">
              {/* Customize - tertiary style */}
              <button
                type="button"
                onClick={openPreferences}
                className="px-4 py-2.5 text-sm font-medium text-secondary hover:text-ink border border-border hover:border-ink/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 order-3 sm:order-1"
              >
                Customize
              </button>

              {/* Reject - secondary style */}
              <button
                type="button"
                onClick={rejectNonEssential}
                className="px-4 py-2.5 text-sm font-medium text-ink bg-surface hover:bg-border/50 dark:bg-border dark:hover:bg-border/70 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 order-2"
              >
                Reject Non-Essential
              </button>

              {/* Accept All - primary style */}
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2.5 text-sm font-medium text-cream bg-ink hover:bg-ink/90 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 order-1 sm:order-3"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(banner, document.body);
}
