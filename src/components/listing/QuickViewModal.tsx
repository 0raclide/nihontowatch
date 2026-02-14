'use client';

import {
  useRef,
  useState,
  useEffect,
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

// Edge swipe constants
const EDGE_ZONE = 30; // px from left edge to activate
const DIRECTION_LOCK_PX = 10; // movement before locking horizontal vs vertical
const DISMISS_RATIO = 0.35; // 35% of viewport width to commit
const SWIPE_VELOCITY = 0.5; // px/ms — fast flick threshold

export function QuickViewModal({
  isOpen,
  onClose,
  children,
}: QuickViewModalProps) {
  // Animation state
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Refs for edge swipe gesture
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Lock body scroll when modal is open - uses position:fixed to preserve visual position
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

  // ─── Edge swipe to dismiss (mobile only) ───────────────────────────
  // Swipe from left edge slides QuickView off-screen to the right.
  // Uses native listeners + direct DOM manipulation for 60 fps.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !isOpen) return;

    let active = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tx = 0;
    let locked = false;
    let horizontal = false;

    // The touchmove handler uses { passive: false } so it can call
    // preventDefault(). To avoid blocking the compositor during normal
    // scrolling we only attach it while an edge-zone touch is active.
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Lock direction after enough movement
      if (!locked) {
        if (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX) {
          locked = true;
          horizontal = Math.abs(dx) > Math.abs(dy);
          if (!horizontal) {
            active = false;
            content.removeEventListener('touchmove', onTouchMove);
            return;
          }
        } else {
          return; // wait for more movement
        }
      }

      if (!horizontal) return;
      e.preventDefault();

      tx = Math.max(0, dx);
      content.style.transform = `translateX(${tx}px)`;
      content.style.transition = 'none';

      const bd = backdropRef.current;
      if (bd) {
        bd.style.opacity = String(Math.max(0, 1 - tx / window.innerWidth));
        bd.style.transition = 'none';
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024) return;
      const x = e.touches[0].clientX;
      if (x > EDGE_ZONE) return;

      active = true;
      startX = x;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      tx = 0;
      locked = false;
      horizontal = false;

      // Attach non-passive touchmove only while edge gesture is live
      content.addEventListener('touchmove', onTouchMove, { passive: false });
    };

    const onTouchEnd = () => {
      // Always detach the non-passive touchmove so scroll is never blocked
      content.removeEventListener('touchmove', onTouchMove);

      if (!active || !horizontal) { active = false; return; }

      const elapsed = Math.max(1, Date.now() - startTime);
      const vel = tx / elapsed;
      const dismiss = tx > window.innerWidth * DISMISS_RATIO || vel > SWIPE_VELOCITY;

      const bd = backdropRef.current;

      if (dismiss) {
        content.style.transition = 'transform 200ms ease-out';
        content.style.transform = `translateX(${window.innerWidth}px)`;
        if (bd) {
          bd.style.transition = 'opacity 200ms ease-out';
          bd.style.opacity = '0';
        }
        setTimeout(() => {
          // Clean up inline styles before unmount
          content.style.transform = '';
          content.style.transition = '';
          if (bd) { bd.style.opacity = ''; bd.style.transition = ''; }
          onCloseRef.current();
        }, 200);
      } else {
        // Spring back
        content.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateX(0)';
        if (bd) {
          bd.style.transition = 'opacity 250ms ease-out';
          bd.style.opacity = '';
        }
      }
      active = false;
    };

    content.addEventListener('touchstart', onTouchStart, { passive: true });
    content.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      content.removeEventListener('touchstart', onTouchStart);
      content.removeEventListener('touchmove', onTouchMove); // in case gesture is mid-flight
      content.removeEventListener('touchend', onTouchEnd);
      // Clean up any lingering inline styles on teardown
      content.style.transform = '';
      content.style.transition = '';
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '';
        backdropRef.current.style.transition = '';
      }
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      data-testid="quickview-modal"
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
    >
      {/* Backdrop overlay - clickable to close */}
      <div
        ref={backdropRef}
        className={`absolute inset-0 bg-black/80 ${
          isAnimatingOut ? 'animate-fadeOut' : 'animate-fadeIn'
        }`}
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isAnimatingOut) {
            handleClose();
          }
        }}
      />

      {/* Close button - outside content for better z-index handling */}
      <button
        type="button"
        data-testid="quickview-close-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }}
        className="absolute top-4 right-4 z-[60] hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-cream/95 hover:bg-cream text-ink shadow-lg transition-colors"
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
          data-testid="quickview-content"
          onClick={(e) => e.stopPropagation()}
          className={`
            relative w-full bg-cream shadow-xl pointer-events-auto
            rounded-t-2xl lg:rounded-lg
            h-[92vh] lg:h-[90vh]
            max-w-4xl overflow-hidden flex flex-col
            ${isAnimatingOut ? 'animate-slideDown' : 'animate-slideUp'}
          `}
        >
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
