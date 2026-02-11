'use client';

import { useEffect, useCallback } from 'react';
import { useCollectionQuickView } from '@/contexts/CollectionQuickViewContext';
import { CollectionViewContent } from './CollectionViewContent';
import { CollectionFormContent } from './CollectionFormContent';

export function CollectionQuickView() {
  const {
    isOpen,
    mode,
    currentItem,
    prefillData,
    items,
    currentIndex,
    closeQuickView,
    goToNext,
    goToPrevious,
    hasNext,
    hasPrevious,
    onSaved,
  } = useCollectionQuickView();

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeQuickView();
    }
  }, [closeQuickView]);

  if (!isOpen) return null;

  const isFormMode = mode === 'add' || mode === 'edit';

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full lg:w-[720px] xl:w-[840px] bg-cream shadow-2xl flex flex-col animate-slide-in-right overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-cream shrink-0">
          <div className="flex items-center gap-3">
            {/* Navigation in view mode */}
            {mode === 'view' && items.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  disabled={!hasPrevious}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-border/60 text-muted hover:text-gold hover:border-gold/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[11px] text-muted tabular-nums">
                  {currentIndex + 1} of {items.length}
                </span>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-border/60 text-muted hover:text-gold hover:border-gold/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            {/* Mode label */}
            <span className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted">
              {mode === 'add' ? 'Add to Collection' : mode === 'edit' ? 'Edit Item' : 'Collection Item'}
            </span>
          </div>

          {/* Close */}
          <button
            onClick={closeQuickView}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isFormMode ? (
            <CollectionFormContent
              mode={mode as 'add' | 'edit'}
              item={currentItem}
              prefillData={prefillData}
              onSaved={() => {
                onSaved();
                closeQuickView();
              }}
              onCancel={closeQuickView}
            />
          ) : currentItem ? (
            <CollectionViewContent item={currentItem} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
