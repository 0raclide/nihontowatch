'use client';

/**
 * InquiryModal Component
 *
 * A two-step modal for generating AI-powered inquiry emails to Japanese dealers.
 *
 * Value proposition: Japanese dealers often give ~10% discount when contacted
 * directly in polite Japanese (keigo). This tool drafts professional Japanese
 * business emails that users can copy/paste to send.
 *
 * Step 1: Form input - user describes what they want in English
 * Step 2: Generated email display with clear copy-and-send instructions
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
            <div>
              <h2 id="inquiry-modal-title" className="font-serif text-lg text-ink">
                {step === 'form' ? 'Draft a Japanese Email' : 'Your Email is Ready'}
              </h2>
              {step === 'form' && (
                <p className="text-[12px] text-muted mt-0.5">
                  Professional keigo that gets responses
                </p>
              )}
            </div>
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
        {/* Value Proposition */}
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink">
                Skip the middleman, save ~10%
              </p>
              <p className="text-[12px] text-muted mt-1">
                Japanese dealers often offer better prices when you contact them directly in polite Japanese. We&apos;ll draft a professional business email for you.
              </p>
            </div>
          </div>
        </div>

        {/* Listing Info */}
        <div className="bg-linen rounded-lg p-4">
          <p className="text-[12px] uppercase tracking-wider text-muted mb-1">Inquiring about</p>
          <p className="text-[13px] text-charcoal font-medium line-clamp-2">{listing.title}</p>
          <p className="text-[12px] text-muted mt-1">
            {listing.dealers?.name || listing.dealer_name}
          </p>
        </div>

        {/* Two column layout for name and country */}
        <div className="grid grid-cols-2 gap-4">
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
              className="w-full px-3 py-2.5 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
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
              className="w-full px-3 py-2.5 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-[12px] uppercase tracking-wider text-muted mb-2">
            What would you like to say?
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example: I'd like to purchase this sword. Can you ship to the US? What payment methods do you accept?"
            rows={4}
            className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold resize-none"
          />
          <p className="mt-2 text-[12px] text-muted">
            Write in English — we&apos;ll translate it into formal Japanese (keigo).
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
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Build mailto link if dealer email is available
  const mailtoLink = generatedEmail.dealer_email
    ? `mailto:${generatedEmail.dealer_email}?subject=${encodeURIComponent(generatedEmail.subject_ja)}&body=${encodeURIComponent(generatedEmail.email_ja)}`
    : null;

  // Handle copy with feedback
  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail.email_ja);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div>
      <div className="p-5 space-y-5">
        {/* How to Send - Step by Step */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-[13px] font-medium text-green-800 mb-3">
            How to send your email:
          </p>
          <ol className="space-y-2 text-[12px] text-green-700">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">1</span>
              <span>Copy the email below using the button</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">2</span>
              <span>Open your email app (Gmail, Outlook, etc.)</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">3</span>
              <span>Paste into a new email and send to the dealer</span>
            </li>
          </ol>
        </div>

        {/* Primary Action - Copy Email */}
        <div className="bg-paper border-2 border-gold rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[12px] uppercase tracking-wider text-muted">
              Your Email (Japanese)
            </label>
            {generatedEmail.dealer_email && (
              <span className="text-[11px] text-muted">
                To: {generatedEmail.dealer_email}
              </span>
            )}
          </div>

          {/* Subject */}
          <div className="mb-3 pb-3 border-b border-border">
            <p className="text-[11px] text-muted mb-1">Subject:</p>
            <p className="text-[13px] text-ink">{generatedEmail.subject_ja}</p>
          </div>

          {/* Body */}
          <div className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
            {generatedEmail.email_ja}
          </div>

          {/* Copy Button - Prominent */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCopyEmail}
              className={`flex-1 px-4 py-3 text-[14px] font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                copiedEmail
                  ? 'bg-green-500 text-white'
                  : 'bg-gold text-white hover:bg-gold-light'
              }`}
            >
              {copiedEmail ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Email
                </>
              )}
            </button>
            {mailtoLink && (
              <a
                href={mailtoLink}
                className="px-4 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors flex items-center gap-2"
                title="Open in your default email app"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            )}
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
            See English translation
          </button>
          {showEnglish && (
            <div className="mt-2 px-3 py-3 bg-linen/50 border border-border rounded-lg text-[13px] text-muted whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
              {generatedEmail.email_en}
            </div>
          )}
        </div>

        {/* Dealer Policies - Compact */}
        {generatedEmail.dealer_policies && (
          <div className="flex flex-wrap gap-2">
            {generatedEmail.dealer_policies.ships_international && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[11px]">
                Ships International
              </span>
            )}
            {generatedEmail.dealer_policies.accepts_wire_transfer && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[11px]">
                Wire Transfer
              </span>
            )}
            {generatedEmail.dealer_policies.accepts_paypal && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[11px]">
                PayPal
              </span>
            )}
            {generatedEmail.dealer_policies.english_support && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[11px]">
                English Support
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-linen/50">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStartOver}
            className="px-4 py-2.5 text-[13px] text-muted hover:text-ink transition-colors"
          >
            Start Over
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors"
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
