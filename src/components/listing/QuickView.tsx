'use client';

import { Suspense } from 'react';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
import ImageCarousel from '@/components/ui/ImageCarousel';
import { useQuickView } from '@/contexts/QuickViewContext';

/**
 * Main QuickView component that renders the complete quick view experience.
 * This should be rendered once at the app level (e.g., in layout.tsx).
 * It listens to the QuickViewContext and renders the modal when a listing is selected.
 */
export function QuickView() {
  const {
    isOpen,
    currentListing,
    closeQuickView,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    currentIndex,
    listings,
  } = useQuickView();

  if (!currentListing) return null;

  const images = currentListing.images || [];
  const showNavigation = listings.length > 1 && currentIndex !== -1;

  return (
    <Suspense fallback={null}>
      <QuickViewModal
        isOpen={isOpen}
        onClose={closeQuickView}
        listingId={currentListing.id}
      >
        <div className="flex flex-col lg:flex-row lg:gap-0 h-full">
          {/* Image Section */}
          <div className="relative lg:w-1/2 xl:w-3/5 flex-shrink-0">
            {/* Mobile: Compact carousel */}
            <div className="lg:hidden">
              <ImageCarousel
                images={images}
                showDots={true}
                enableZoom={true}
                className="rounded-none"
              />
            </div>

            {/* Desktop: Larger carousel with navigation arrows */}
            <div className="hidden lg:block h-full p-4 pb-0">
              <ImageCarousel
                images={images}
                showDots={true}
                enableZoom={true}
                className="h-full"
              />
            </div>

            {/* Sold overlay */}
            {(currentListing.is_sold || currentListing.status === 'sold' || currentListing.status === 'presumed_sold') && (
              <div className="absolute inset-0 bg-ink/40 flex items-center justify-center pointer-events-none lg:m-4 lg:rounded-lg">
                <span className="text-white text-lg font-medium tracking-wider uppercase">
                  Sold
                </span>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 lg:w-1/2 xl:w-2/5 lg:border-l lg:border-border overflow-hidden">
            <div className="h-full pt-4 lg:pt-6">
              <QuickViewContent listing={currentListing} onClose={closeQuickView} />
            </div>
          </div>

          {/* Listing Navigation (Desktop - Previous/Next buttons) */}
          {showNavigation && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                disabled={!hasPrevious}
                className={`hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                  hasPrevious
                    ? 'hover:bg-cream hover:border-gold hover:scale-105'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                aria-label="Previous listing"
              >
                <svg className="w-6 h-6 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                disabled={!hasNext}
                className={`hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                  hasNext
                    ? 'hover:bg-cream hover:border-gold hover:scale-105'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                aria-label="Next listing"
              >
                <svg className="w-6 h-6 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Listing counter */}
              <div className="hidden lg:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-ink/60 backdrop-blur-sm">
                <span className="text-[12px] text-white font-medium tabular-nums">
                  {currentIndex + 1} of {listings.length}
                </span>
              </div>
            </>
          )}
        </div>
      </QuickViewModal>
    </Suspense>
  );
}

export default QuickView;
