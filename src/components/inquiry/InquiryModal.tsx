'use client';

/**
 * InquiryModal Component
 *
 * A two-step modal for generating AI-powered inquiry emails to Japanese dealers.
 *
 * Step 1: Form input (intent, buyer info, questions)
 * Step 2: Generated email display with copy functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInquiry } from '@/hooks/useInquiry';
import { CopyButton } from './CopyButton';
import type { Listing } from '@/types';

// Extended listing type that includes dealer info
interface ListingWithDealer extends Listing {
  dealers?: {
    id: number;
    name: string;
    domain: string;
  };
  dealer_name?: string;
  dealer_domain?: string;
}
import type { GeneratedEmail } from '@/lib/inquiry/types';

// =============================================================================
// Types
// =============================================================================

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ListingWithDealer;
}

type Step = 'form' | 'result';

// =============================================================================
// Component
// =============================================================================

export function InquiryModal({ isOpen, onClose, listing }: InquiryModalProps) {
  // Form state
  const [step, setStep] = useState<Step>('form');
  const [buyerName, setBuyerName] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [message, setMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Generated email state
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);

  // Hook
  const { generateEmail, isGenerating, error, clearError } = useInquiry();

  // Body scroll lock
  useBodyScrollLock(isOpen);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setBuyerName('');
      setBuyerCountry('');
      setMessage('');
      setValidationErrors([]);
      setGeneratedEmail(null);
      clearError();
    }
  }, [isOpen, clearError]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: string[] = [];

    if (!buyerName.trim()) {
      errors.push('Name is required');
    }
    if (!buyerCountry.trim()) {
      errors.push('Country is required');
    }
    if (!message.trim()) {
      errors.push('Message is required');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [buyerName, buyerCountry, message]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      clearError();

      const result = await generateEmail({
        listingId: listing.id,
        buyerName: buyerName.trim(),
        buyerCountry: buyerCountry.trim(),
        message: message.trim(),
      });

      if (result) {
        setGeneratedEmail(result);
        setStep('result');
      }
    },
    [
      validateForm,
      clearError,
      generateEmail,
      listing.id,
      buyerName,
      buyerCountry,
      message,
    ]
  );

  // Handle start over
  const handleStartOver = useCallback(() => {
    setStep('form');
    setGeneratedEmail(null);
    clearError();
  }, [clearError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg bg-cream rounded-lg shadow-xl animate-slideUp max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 id="inquiry-modal-title" className="font-serif text-lg text-ink">
              {step === 'form' ? 'Contact Dealer' : 'Generated Email'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 'form' ? (
              <FormStep
                listing={listing}
                buyerName={buyerName}
                setBuyerName={setBuyerName}
                buyerCountry={buyerCountry}
                setBuyerCountry={setBuyerCountry}
                message={message}
                setMessage={setMessage}
                validationErrors={validationErrors}
                apiError={error}
                isGenerating={isGenerating}
                onSubmit={handleSubmit}
                onCancel={onClose}
              />
            ) : (
              <ResultStep
                generatedEmail={generatedEmail!}
                onStartOver={handleStartOver}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Form Step Component
// =============================================================================

interface FormStepProps {
  listing: ListingWithDealer;
  buyerName: string;
  setBuyerName: (name: string) => void;
  buyerCountry: string;
  setBuyerCountry: (country: string) => void;
  message: string;
  setMessage: (message: string) => void;
  validationErrors: string[];
  apiError: string | null;
  isGenerating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function FormStep({
  listing,
  buyerName,
  setBuyerName,
  buyerCountry,
  setBuyerCountry,
  message,
  setMessage,
  validationErrors,
  apiError,
  isGenerating,
  onSubmit,
  onCancel,
}: FormStepProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="p-5 space-y-5">
        {/* Listing Info */}
        <div className="bg-linen rounded-lg p-4">
          <p className="text-[13px] text-charcoal font-medium line-clamp-2">{listing.title}</p>
          <p className="text-[12px] text-muted mt-1">
            {listing.dealers?.name || listing.dealer_name} • {listing.dealers?.domain || listing.dealer_domain}
          </p>
        </div>

        {/* Buyer Name */}
        <div>
          <label htmlFor="buyerName" className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Your Name
          </label>
          <input
            id="buyerName"
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="John Smith"
            className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
          />
        </div>

        {/* Buyer Country */}
        <div>
          <label htmlFor="buyerCountry" className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Your Country
          </label>
          <input
            id="buyerCountry"
            type="text"
            value={buyerCountry}
            onChange={(e) => setBuyerCountry(e.target.value)}
            placeholder="United States"
            className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
          />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Your Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I'm interested in this item and would like to know more about..."
            rows={5}
            className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold resize-none"
          />
          <p className="mt-2 text-[11px] text-muted">
            Write in English — we'll draft a polite Japanese business email for you.
          </p>
        </div>

        {/* Errors */}
        {(validationErrors.length > 0 || apiError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            {validationErrors.map((err, i) => (
              <p key={i} className="text-[13px] text-red-600">
                {err}
              </p>
            ))}
            {apiError && <p className="text-[13px] text-red-600">{apiError}</p>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-linen/50">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isGenerating}
            className="flex-1 px-4 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Email'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

// =============================================================================
// Result Step Component
// =============================================================================

interface ResultStepProps {
  generatedEmail: GeneratedEmail;
  onStartOver: () => void;
  onClose: () => void;
}

function ResultStep({ generatedEmail, onStartOver, onClose }: ResultStepProps) {
  const [showEnglish, setShowEnglish] = useState(false);

  return (
    <div>
      <div className="p-5 space-y-5">
        {/* Dealer Email */}
        <div>
          <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Dealer Email
          </label>
          {generatedEmail.dealer_email ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-paper border border-border rounded-lg text-[14px] text-ink font-mono">
                {generatedEmail.dealer_email}
              </code>
              <CopyButton text={generatedEmail.dealer_email} variant="icon" ariaLabel="Copy email address" testId="copy-dealer-email" />
            </div>
          ) : (
            <p className="text-[13px] text-muted italic">
              Contact email not available. Please find the contact information on the dealer&apos;s website.
            </p>
          )}
        </div>

        {/* Subject Line */}
        <div>
          <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Subject
          </label>
          <div className="flex items-start gap-2">
            <div className="flex-1 px-3 py-2 bg-paper border border-border rounded-lg text-[14px] text-ink">
              {generatedEmail.subject_ja}
            </div>
            <CopyButton text={generatedEmail.subject_ja} variant="icon" ariaLabel="Copy subject" testId="copy-subject" />
          </div>
        </div>

        {/* Email Body (Japanese) */}
        <div>
          <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            Email Body (Japanese)
          </label>
          <div className="px-3 py-3 bg-paper border border-border rounded-lg text-[14px] text-ink whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {generatedEmail.email_ja}
          </div>
          <div className="mt-2">
            <CopyButton text={generatedEmail.email_ja} label="Copy Email" testId="copy-email-body" />
          </div>
        </div>

        {/* English Translation (Collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowEnglish(!showEnglish)}
            className="flex items-center gap-2 text-[13px] font-medium text-charcoal hover:text-ink transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showEnglish ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            English Translation (for your reference)
          </button>
          {showEnglish && (
            <div className="mt-2 px-3 py-3 bg-linen/50 border border-border rounded-lg text-[14px] text-muted whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {generatedEmail.email_en}
            </div>
          )}
        </div>

        {/* Dealer Policies */}
        {generatedEmail.dealer_policies && (
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
              Dealer Info
            </label>
            <div className="grid grid-cols-2 gap-2">
              {generatedEmail.dealer_policies.ships_international !== null && (
                <PolicyBadge
                  label="Ships International"
                  value={generatedEmail.dealer_policies.ships_international}
                />
              )}
              {generatedEmail.dealer_policies.accepts_wire_transfer !== null && (
                <PolicyBadge
                  label="Wire Transfer"
                  value={generatedEmail.dealer_policies.accepts_wire_transfer}
                />
              )}
              {generatedEmail.dealer_policies.accepts_paypal !== null && (
                <PolicyBadge
                  label="PayPal"
                  value={generatedEmail.dealer_policies.accepts_paypal}
                />
              )}
              {generatedEmail.dealer_policies.english_support !== null && (
                <PolicyBadge
                  label="English Support"
                  value={generatedEmail.dealer_policies.english_support}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-linen/50">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStartOver}
            className="flex-1 px-4 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors"
          >
            Start Over
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Policy Badge Component
// =============================================================================

function PolicyBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`px-2 py-1 rounded text-[12px] ${
        value
          ? 'bg-green-100 text-green-700'
          : 'bg-red-50 text-red-600'
      }`}
    >
      {value ? '✓' : '✗'} {label}
    </div>
  );
}
