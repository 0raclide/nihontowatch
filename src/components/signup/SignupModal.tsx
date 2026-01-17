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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
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

  const handleOAuthClick = (provider: 'google' | 'apple') => {
    // TODO: Implement OAuth flow
    console.log(`OAuth with ${provider}`);
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

      {/* OAuth divider */}
      <div className="flex items-center gap-4 w-full max-w-sm my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-muted text-xs uppercase tracking-wider">
          or continue with
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* OAuth buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => handleOAuthClick('google')}
          className="flex items-center justify-center w-14 h-14 rounded-full border border-border bg-surface hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Continue with Google"
        >
          <GoogleIcon className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => handleOAuthClick('apple')}
          className="flex items-center justify-center w-14 h-14 rounded-full border border-border bg-surface hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Continue with Apple"
        >
          <AppleIcon className="w-6 h-6" />
        </button>
      </div>

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
