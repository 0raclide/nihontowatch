'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSignupPressure } from '@/contexts/SignupPressureContext';
import { SIGNUP_MODAL_COPY, ANIMATION_TIMING } from '@/lib/signup/config';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// ============================================================================
// Icons
// ============================================================================

function CloseIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}


// ============================================================================
// Modal Content Component
// ============================================================================

interface SignupModalContentProps {
  onDismiss: () => void;
  onClose: () => void;
}

function SignupModalContent({ onDismiss, onClose }: SignupModalContentProps) {
  const { triggerContext } = useSignupPressure();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get copy based on trigger context
  const copy = SIGNUP_MODAL_COPY[triggerContext || 'engagement'];

  // Focus email input on mount (desktop only)
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop && inputRef.current) {
      // Slight delay to ensure animation has started
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // TODO: Implement actual signup logic
    // For now, simulate a delay and close
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="flex flex-col items-center text-center px-6 py-8 lg:px-10 lg:py-10">
      {/* Headline */}
      <h2 className="font-serif text-2xl lg:text-3xl text-ink mb-4">
        {copy.headline}
      </h2>

      {/* Body */}
      <p className="text-secondary text-sm lg:text-base leading-relaxed max-w-sm mb-8">
        {copy.body}
      </p>

      {/* Email form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="signup-email" className="sr-only">
            Email address
          </label>
          <input
            ref={inputRef}
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="email"
            className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={!email.trim() || isSubmitting}
          className="w-full px-4 py-3 rounded-lg bg-ink text-cream font-medium tracking-wide hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {isSubmitting ? 'Creating account...' : copy.cta}
        </button>
      </form>

      {/* Dismiss link */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-8 text-muted text-sm hover:text-secondary transition-colors focus:outline-none focus:underline"
      >
        {copy.dismiss} →
      </button>

      {/* Social proof */}
      <p className="mt-6 text-muted text-xs">
        {copy.socialProof}
      </p>
    </div>
  );
}

// ============================================================================
// Desktop Modal
// ============================================================================

interface DesktopModalProps {
  onDismiss: () => void;
  onClose: () => void;
  isClosing: boolean;
}

function DesktopModal({ onDismiss, onClose, isClosing }: DesktopModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-cream rounded-2xl shadow-xl ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        style={{
          animationDuration: isClosing
            ? `${ANIMATION_TIMING.modalExit}ms`
            : `${ANIMATION_TIMING.modalEnter}ms`,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink transition-colors rounded-full hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <SignupModalContent onDismiss={onDismiss} onClose={onClose} />
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Sheet
// ============================================================================

interface MobileSheetProps {
  onDismiss: () => void;
  onClose: () => void;
  isClosing: boolean;
}

function MobileSheet({ onDismiss, onClose, isClosing }: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  // Handle drag to close
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;

    if (diff > 100) {
      onDismiss();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }

    startY.current = 0;
    currentY.current = 0;
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-cream rounded-t-2xl max-h-[90vh] flex flex-col safe-area-bottom ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}
        style={{
          animationDuration: isClosing
            ? `${ANIMATION_TIMING.modalExit}ms`
            : `${ANIMATION_TIMING.modalEnter}ms`,
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-2 text-muted hover:text-ink transition-colors rounded-full"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <SignupModalContent onDismiss={onDismiss} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main SignupModal Component
// ============================================================================

export function SignupModal() {
  const { isModalOpen, dismissModal, closeModal } = useSignupPressure();
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useBodyScrollLock(isModalOpen);

  // Handle escape key
  useEffect(() => {
    if (!isModalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  // Dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      dismissModal();
      setIsClosing(false);
    }, ANIMATION_TIMING.modalExit);
  }, [dismissModal]);

  // Close without dismiss tracking (successful signup)
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeModal();
      setIsClosing(false);
    }, ANIMATION_TIMING.modalExit);
  }, [closeModal]);

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  // Don't render if not open and not in closing animation
  if (!isModalOpen && !isClosing) return null;

  // Detect mobile vs desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const modal = isMobile ? (
    <MobileSheet
      onDismiss={handleDismiss}
      onClose={handleClose}
      isClosing={isClosing}
    />
  ) : (
    <DesktopModal
      onDismiss={handleDismiss}
      onClose={handleClose}
      isClosing={isClosing}
    />
  );

  return createPortal(modal, document.body);
}
