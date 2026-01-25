'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useConsent } from '@/contexts/ConsentContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  type ConsentCategory,
  type ConsentPreferences as ConsentPreferencesType,
  CATEGORY_INFO,
  OPTIONAL_CATEGORIES,
} from '@/lib/consent/types';
import Link from 'next/link';

// Animation timing in ms
const ANIMATION_TIMING = {
  modalEnter: 200,
  modalExit: 150,
};

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

function ShieldIcon({ className }: { className?: string }) {
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
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// ============================================================================
// Toggle Switch Component
// ============================================================================

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-cream dark:focus:ring-offset-surface ${
        disabled
          ? 'bg-border cursor-not-allowed opacity-60'
          : checked
          ? 'bg-green-600 dark:bg-green-500'
          : 'bg-border hover:bg-muted/50'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ============================================================================
// Category Card Component
// ============================================================================

interface CategoryCardProps {
  category: ConsentCategory;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CategoryCard({ category, checked, onChange }: CategoryCardProps) {
  const info = CATEGORY_INFO[category];

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-ink">{info.name}</h3>
            {info.required && (
              <span className="text-xs text-muted bg-surface px-2 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-sm text-secondary mb-3">{info.description}</p>
          <ul className="space-y-1">
            {info.examples.map((example, idx) => (
              <li key={idx} className="text-xs text-muted flex items-start gap-2">
                <span className="text-muted/50">•</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-shrink-0">
          <ToggleSwitch
            checked={checked}
            onChange={onChange}
            disabled={info.required}
            label={`${info.name} cookies`}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modal Content Component
// ============================================================================

interface PreferencesContentProps {
  preferences: Record<ConsentCategory, boolean>;
  onPreferenceChange: (category: ConsentCategory, value: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

function PreferencesContent({
  preferences,
  onPreferenceChange,
  onSave,
  onCancel,
  onAcceptAll,
  onRejectAll,
}: PreferencesContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <ShieldIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-ink">Privacy Preferences</h2>
          <p className="text-sm text-muted">Manage your cookie settings</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <p className="text-sm text-secondary">
          We use different types of cookies to optimize your experience.
          Choose which cookies you want to allow. You can change these settings at any time.{' '}
          <Link href="/privacy" className="text-accent hover:underline">
            View our Privacy Policy
          </Link>
        </p>

        {/* Category toggles - Essential first */}
        <CategoryCard
          category="essential"
          checked={true}
          onChange={() => {}} // No-op, always required
        />

        {/* Optional categories */}
        {OPTIONAL_CATEGORIES.map((category) => (
          <CategoryCard
            key={category}
            category={category}
            checked={preferences[category]}
            onChange={(value) => onPreferenceChange(category, value)}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-border/50 bg-surface/50">
        {/* Quick actions */}
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={onRejectAll}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary hover:text-ink border border-border hover:border-ink/30 rounded-lg transition-colors"
          >
            Reject All Optional
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary hover:text-ink border border-border hover:border-ink/30 rounded-lg transition-colors"
          >
            Accept All
          </button>
        </div>

        {/* Primary actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-ink bg-surface hover:bg-border/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-cream bg-ink hover:bg-ink/90 rounded-lg transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Desktop Modal
// ============================================================================

interface DesktopModalProps {
  preferences: Record<ConsentCategory, boolean>;
  onPreferenceChange: (category: ConsentCategory, value: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  isClosing: boolean;
}

function DesktopModal({
  preferences,
  onPreferenceChange,
  onSave,
  onCancel,
  onAcceptAll,
  onRejectAll,
  isClosing,
}: DesktopModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-preferences-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg max-h-[85vh] bg-cream dark:bg-surface rounded-2xl shadow-xl flex flex-col overflow-hidden ${
          isClosing ? 'animate-fadeOut' : 'animate-fadeIn'
        }`}
        style={{
          animationDuration: isClosing
            ? `${ANIMATION_TIMING.modalExit}ms`
            : `${ANIMATION_TIMING.modalEnter}ms`,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 z-10 p-2 text-muted hover:text-ink transition-colors rounded-full hover:bg-surface dark:hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <PreferencesContent
          preferences={preferences}
          onPreferenceChange={onPreferenceChange}
          onSave={onSave}
          onCancel={onCancel}
          onAcceptAll={onAcceptAll}
          onRejectAll={onRejectAll}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Sheet
// ============================================================================

interface MobileSheetProps {
  preferences: Record<ConsentCategory, boolean>;
  onPreferenceChange: (category: ConsentCategory, value: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  isClosing: boolean;
}

function MobileSheet({
  preferences,
  onPreferenceChange,
  onSave,
  onCancel,
  onAcceptAll,
  onRejectAll,
  isClosing,
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

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
      onCancel();
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
      aria-labelledby="privacy-preferences-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-cream dark:bg-surface rounded-t-2xl max-h-[90vh] flex flex-col safe-area-bottom ${
          isClosing ? 'animate-slideDown' : 'animate-slideUp'
        }`}
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
          onClick={onCancel}
          className="absolute top-3 right-3 p-2 text-muted hover:text-ink transition-colors rounded-full"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <PreferencesContent
          preferences={preferences}
          onPreferenceChange={onPreferenceChange}
          onSave={onSave}
          onCancel={onCancel}
          onAcceptAll={onAcceptAll}
          onRejectAll={onRejectAll}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main ConsentPreferences Component
// ============================================================================

export function ConsentPreferences() {
  const {
    showPreferences,
    closePreferences,
    consent,
    updateConsent,
    acceptAll,
    rejectNonEssential,
  } = useConsent();

  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<Record<ConsentCategory, boolean>>({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync local state with consent context when modal opens
  useEffect(() => {
    if (showPreferences && consent) {
      setLocalPreferences({
        essential: true, // Always true
        functional: consent.preferences.functional,
        analytics: consent.preferences.analytics,
        marketing: consent.preferences.marketing,
      });
    } else if (showPreferences) {
      // Reset to defaults if no consent yet
      setLocalPreferences({
        essential: true,
        functional: false,
        analytics: false,
        marketing: false,
      });
    }
  }, [showPreferences, consent]);

  // Lock body scroll when modal is open
  useBodyScrollLock(showPreferences);

  // Handle escape key
  useEffect(() => {
    if (!showPreferences) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPreferences]);

  // Handle preference change
  const handlePreferenceChange = useCallback((category: ConsentCategory, value: boolean) => {
    if (category === 'essential') return; // Can't change essential

    setLocalPreferences((prev) => ({
      ...prev,
      [category]: value,
    }));
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const prefs: Partial<Omit<ConsentPreferencesType, 'essential'>> = {
      functional: localPreferences.functional,
      analytics: localPreferences.analytics,
      marketing: localPreferences.marketing,
    };
    updateConsent(prefs);
    handleClose();
  }, [localPreferences, updateConsent]);

  // Handle cancel (close without saving)
  const handleCancel = useCallback(() => {
    handleClose();
  }, []);

  // Handle accept all
  const handleAcceptAll = useCallback(() => {
    acceptAll();
    handleClose();
  }, [acceptAll]);

  // Handle reject all optional
  const handleRejectAll = useCallback(() => {
    rejectNonEssential();
    handleClose();
  }, [rejectNonEssential]);

  // Close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closePreferences();
      setIsClosing(false);
    }, ANIMATION_TIMING.modalExit);
  }, [closePreferences]);

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  // Don't render if not open and not in closing animation
  if (!showPreferences && !isClosing) return null;

  // Detect mobile vs desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const modal = isMobile ? (
    <MobileSheet
      preferences={localPreferences}
      onPreferenceChange={handlePreferenceChange}
      onSave={handleSave}
      onCancel={handleCancel}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      isClosing={isClosing}
    />
  ) : (
    <DesktopModal
      preferences={localPreferences}
      onPreferenceChange={handlePreferenceChange}
      onSave={handleSave}
      onCancel={handleCancel}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      isClosing={isClosing}
    />
  );

  return createPortal(modal, document.body);
}
