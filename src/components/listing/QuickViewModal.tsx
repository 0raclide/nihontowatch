'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, usePathname } from 'next/navigation';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  children: ReactNode;
}

// Spring animation duration
const SPRING_DURATION = 250;

export function QuickViewModal({
  isOpen,
  onClose,
  listingId,
  children,
}: QuickViewModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
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

  // Update URL when modal opens/closes
  useEffect(() => {
    if (!mounted) return;

    if (isOpen && listingId) {
      // Add listing param to URL
      const params = new URLSearchParams(searchParams.toString());
      params.set('listing', String(listingId));
      const newUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [isOpen, listingId, pathname, searchParams, mounted]);

  // Restore URL on close
  const handleClose = useCallback(() => {
    if (isAnimatingOut) return; // Prevent double-close

    // Remove listing param from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('listing');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, '', newUrl);

    setIsAnimatingOut(true);

    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      setIsAnimatingOut(false);
      onClose();
    }, SPRING_DURATION);
  }, [pathname, searchParams, onClose, isAnimatingOut]);

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

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !isAnimatingOut) {
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
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`absolute inset-0 bg-black/80 ${
          isAnimatingOut ? 'animate-fadeOut' : 'animate-fadeIn'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="absolute inset-0 flex items-end lg:items-center justify-center lg:p-4 pointer-events-none">
        <div
          ref={contentRef}
          className={`
            relative w-full bg-cream shadow-xl pointer-events-auto
            rounded-t-2xl lg:rounded-lg
            h-[92vh] lg:h-auto lg:max-h-[90vh]
            max-w-4xl overflow-hidden flex flex-col
            ${isAnimatingOut ? 'animate-slideDown' : 'animate-slideUp'}
          `}
        >
          {/* Mobile header with close button */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-cream">
            <span className="text-[13px] font-medium text-ink">Quick View</span>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-linen text-ink hover:bg-border transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop close button */}
          <button
            onClick={handleClose}
            className="hidden lg:flex absolute top-3 right-3 z-30 items-center justify-center w-9 h-9 rounded-full bg-ink/10 hover:bg-ink/20 text-ink transition-colors"
            aria-label="Close quick view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal
  return createPortal(modalContent, document.body);
}
