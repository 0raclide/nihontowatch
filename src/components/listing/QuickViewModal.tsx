'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Spring animation duration
const SPRING_DURATION = 250;

export function QuickViewModal({
  isOpen,
  onClose,
  children,
}: QuickViewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Animation state
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock(isOpen);

  // Handle portal mounting
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isAnimatingOut) return; // Prevent double-close

    setIsAnimatingOut(true);

    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      setIsAnimatingOut(false);
      onClose();
    }, SPRING_DURATION);
  }, [onClose, isAnimatingOut]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isAnimatingOut) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isAnimatingOut, handleClose]);

  // Handle backdrop click with mousedown to prevent event issues
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle direct clicks on the backdrop itself
    if (e.target === e.currentTarget && !isAnimatingOut) {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }, [isAnimatingOut, handleClose]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      // Capture clicks on the modal container (backdrop area)
      onMouseDown={handleBackdropMouseDown}
    >
      {/* Backdrop overlay - visual only, clicks handled by parent */}
      <div
        className={`absolute inset-0 bg-black/80 pointer-events-none ${
          isAnimatingOut ? 'animate-fadeOut' : 'animate-fadeIn'
        }`}
        aria-hidden="true"
      />

      {/* Close button - outside content for better z-index handling */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }}
        className="absolute top-4 right-4 z-[60] flex items-center justify-center w-10 h-10 rounded-full bg-cream/95 hover:bg-cream text-ink shadow-lg transition-colors"
        aria-label="Close quick view"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Modal Content Container */}
      <div
        className="absolute inset-0 flex items-end lg:items-center justify-center lg:p-4 pointer-events-none"
      >
        <div
          ref={contentRef}
          onMouseDown={(e) => e.stopPropagation()}
          className={`
            relative w-full bg-cream shadow-xl pointer-events-auto
            rounded-t-2xl lg:rounded-lg
            h-[92vh] lg:h-[90vh]
            max-w-4xl overflow-hidden flex flex-col
            ${isAnimatingOut ? 'animate-slideDown' : 'animate-slideUp'}
          `}
        >
          {/* Mobile header with close button */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-cream shrink-0">
            <span className="text-[13px] font-medium text-ink">Quick View</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-linen text-ink active:bg-border transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal
  return createPortal(modalContent, document.body);
}
