'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useIsMobile } from '@/hooks/useIsMobile';

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  children: ReactNode;
}

// Threshold for dismissing the modal (pixels)
const DISMISS_THRESHOLD = 100;
// Velocity threshold for quick swipes (pixels per ms)
const VELOCITY_THRESHOLD = 0.5;
// Spring animation duration
const SPRING_DURATION = 300;

export function QuickViewModal({
  isOpen,
  onClose,
  listingId,
  children,
}: QuickViewModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile(768);

  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Animation state
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Swipe tracking
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const lastVelocity = useRef(0);

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
  }, [pathname, searchParams, onClose]);

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

  // ========================================
  // Swipe-to-dismiss handling
  // ========================================

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;

    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    currentY.current = startY.current;
    isDragging.current = true;
    lastVelocity.current = 0;

    // Remove transition during drag for immediate response
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
    }
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging.current) return;

    const newY = e.touches[0].clientY;
    const diff = newY - startY.current;
    const timeDelta = Date.now() - startTime.current;

    // Calculate velocity (pixels per ms)
    if (timeDelta > 0) {
      lastVelocity.current = (newY - currentY.current) / Math.max(timeDelta - (Date.now() - startTime.current - 16), 1);
    }

    currentY.current = newY;

    // Only allow downward drag
    if (diff > 0 && contentRef.current) {
      // Apply slight resistance as user drags further
      const resistance = 0.6;
      const resistedDiff = diff * resistance;

      contentRef.current.style.transform = `translateY(${resistedDiff}px)`;

      // Fade backdrop based on drag distance
      if (backdropRef.current) {
        const opacity = Math.max(0.2, 1 - (resistedDiff / 400));
        backdropRef.current.style.opacity = String(opacity);
      }
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging.current) return;

    isDragging.current = false;
    const diff = currentY.current - startY.current;
    const timeDelta = Date.now() - startTime.current;

    // Calculate final velocity
    const velocity = timeDelta > 0 ? diff / timeDelta : 0;

    // Determine if we should dismiss
    const shouldDismiss =
      diff > DISMISS_THRESHOLD ||
      (velocity > VELOCITY_THRESHOLD && diff > 50);

    if (contentRef.current) {
      contentRef.current.style.transition = `transform ${SPRING_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    }

    if (backdropRef.current) {
      backdropRef.current.style.transition = `opacity ${SPRING_DURATION}ms ease-out`;
    }

    if (shouldDismiss) {
      // Animate out
      if (contentRef.current) {
        contentRef.current.style.transform = 'translateY(100%)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '0';
      }

      setTimeout(() => {
        // Reset styles
        if (contentRef.current) {
          contentRef.current.style.transform = '';
          contentRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.opacity = '';
          backdropRef.current.style.transition = '';
        }

        // Close modal
        const params = new URLSearchParams(searchParams.toString());
        params.delete('listing');
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        window.history.replaceState(null, '', newUrl);
        onClose();
      }, SPRING_DURATION);
    } else {
      // Spring back
      if (contentRef.current) {
        contentRef.current.style.transform = 'translateY(0)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '1';
      }

      // Clean up transition after animation
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
        }
      }, SPRING_DURATION);
    }

    // Reset tracking values
    startY.current = 0;
    startTime.current = 0;
    currentY.current = 0;
    lastVelocity.current = 0;
  }, [isMobile, pathname, searchParams, onClose]);

  // Mouse drag support for desktop (optional)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;

    startY.current = e.clientY;
    startTime.current = Date.now();
    currentY.current = startY.current;
    isDragging.current = true;

    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
    }

    // Add global mouse listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [isMobile]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;

    const diff = e.clientY - startY.current;
    currentY.current = e.clientY;

    if (diff > 0 && contentRef.current) {
      const resistance = 0.6;
      const resistedDiff = diff * resistance;
      contentRef.current.style.transform = `translateY(${resistedDiff}px)`;

      if (backdropRef.current) {
        const opacity = Math.max(0.2, 1 - (resistedDiff / 400));
        backdropRef.current.style.opacity = String(opacity);
      }
    }
  }, []);

  const handleGlobalMouseUp = useCallback(() => {
    if (!isDragging.current) return;

    isDragging.current = false;
    const diff = currentY.current - startY.current;
    const timeDelta = Date.now() - startTime.current;
    const velocity = timeDelta > 0 ? diff / timeDelta : 0;

    const shouldDismiss =
      diff > DISMISS_THRESHOLD ||
      (velocity > VELOCITY_THRESHOLD && diff > 50);

    if (contentRef.current) {
      contentRef.current.style.transition = `transform ${SPRING_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    }

    if (backdropRef.current) {
      backdropRef.current.style.transition = `opacity ${SPRING_DURATION}ms ease-out`;
    }

    if (shouldDismiss) {
      if (contentRef.current) {
        contentRef.current.style.transform = 'translateY(100%)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '0';
      }

      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.transform = '';
          contentRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.opacity = '';
          backdropRef.current.style.transition = '';
        }

        const params = new URLSearchParams(searchParams.toString());
        params.delete('listing');
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        window.history.replaceState(null, '', newUrl);
        onClose();
      }, SPRING_DURATION);
    } else {
      if (contentRef.current) {
        contentRef.current.style.transform = 'translateY(0)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '1';
      }

      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
        }
      }, SPRING_DURATION);
    }

    // Remove global listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);

    startY.current = 0;
    startTime.current = 0;
    currentY.current = 0;
  }, [pathname, searchParams, onClose, handleGlobalMouseMove]);

  // Cleanup global listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

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
      <div className="absolute inset-0 flex items-end md:items-center justify-center md:p-4">
        <div
          ref={contentRef}
          className={`
            relative w-full bg-cream rounded-t-2xl md:rounded-lg shadow-xl
            h-full md:h-auto md:max-h-[90vh]
            max-w-4xl overflow-hidden flex flex-col
            ${isAnimatingOut ? 'animate-slideDown' : 'animate-slideUp'}
          `}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle - mobile only */}
          <div
            className="md:hidden flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={handleMouseDown}
          >
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Close button - desktop */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-surface/80 backdrop-blur-sm text-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Close quick view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal
  return createPortal(modalContent, document.body);
}
