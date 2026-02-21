'use client';

/**
 * InquiryModal Component
 *
 * A two-step modal for generating AI-powered inquiry emails to Japanese dealers.
 *
 * Value proposition: Foreign buyers can request exemption from Japan's 10%
 * consumption tax (消費税) when purchasing for export. This tool drafts
 * professional Japanese business emails (keigo) that properly request
 * tax-exempt pricing.
 *
 * Step 1: Form input - user describes what they want in English
 * Step 2: Generated email display with clear copy-and-send instructions
 */

import { useState, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInquiry } from '@/hooks/useInquiry';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { CopyButton } from './CopyButton';
import { useLocale } from '@/i18n/LocaleContext';
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
  const { t } = useLocale();
  // Form state
  const [step, setStep] = useState<Step>('form');
  const [buyerName, setBuyerName] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [message, setMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Generated email state
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);

  // Hooks
  const { generateEmail, isGenerating, error, clearError } = useInquiry();
  const { requireFeature } = useSubscription();

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
      errors.push(t('inquiry.nameRequired'));
    }
    if (!buyerCountry.trim()) {
      errors.push(t('inquiry.countryRequired'));
    }
    if (!message.trim()) {
      errors.push(t('inquiry.messageRequired'));
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [buyerName, buyerCountry, message]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Check feature access - shows paywall if not authorized
      if (!requireFeature('inquiry_emails')) {
        return;
      }

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
      requireFeature,
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
          className="relative w-full max-w-lg lg:max-w-4xl bg-cream rounded-lg shadow-xl animate-slideUp max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 id="inquiry-modal-title" className="font-serif text-lg text-ink">
                {step === 'form' ? t('inquiry.draftTitle') : t('inquiry.readyTitle')}
              </h2>
              {step === 'form' && (
                <p className="text-[12px] text-muted mt-0.5">
                  {t('inquiry.subtitle')}
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
                listingId={listing.id}
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
  const { t } = useLocale();
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
                {t('inquiry.taxSave')}
                {listing.price_value && listing.price_currency === 'JPY' && (
                  <span className="text-gold ml-1">
                    (¥{Math.round(listing.price_value * 0.1).toLocaleString()})
                  </span>
                )}
              </p>
              <p className="text-[12px] text-muted mt-1">
                {t('inquiry.taxExplain')}
              </p>
            </div>
          </div>
        </div>

        {/* Listing Info */}
        <div className="bg-linen rounded-lg p-4">
          <p className="text-[12px] uppercase tracking-wider text-muted mb-1">{t('inquiry.inquiringAbout')}</p>
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
              {t('inquiry.yourName')}
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
              {t('inquiry.yourCountry')}
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
            {t('inquiry.whatToSay')}
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('inquiry.messagePlaceholder')}
            rows={4}
            className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold resize-none"
          />
          <p className="mt-2 text-[12px] text-muted">
            {t('inquiry.writeInEnglish')}
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
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isGenerating}
            className="flex-1 px-4 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('inquiry.generating')}
              </>
            ) : (
              t('inquiry.generateEmail')
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
  listingId: number;
  onStartOver: () => void;
  onClose: () => void;
}

function ResultStep({ generatedEmail, listingId, onStartOver, onClose }: ResultStepProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'japanese' | 'english'>('japanese');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const activityTracker = useActivityTrackerOptional();

  // Build mailto link if dealer email is available
  const mailtoLink = generatedEmail.dealer_email
    ? `mailto:${generatedEmail.dealer_email}?subject=${encodeURIComponent(generatedEmail.subject_ja)}&body=${encodeURIComponent(generatedEmail.email_ja)}`
    : null;

  // Handle copy with feedback
  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail.email_ja);
      setCopiedEmail(true);
      activityTracker?.trackInquiryCopy(listingId);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle mailto click
  const handleMailtoClick = () => {
    activityTracker?.trackInquiryMailtoClick(listingId);
  };

  return (
    <div>
      <div className="p-5 space-y-5">
        {/* How to Send - Step by Step */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-[13px] font-medium text-green-800 mb-3">
            {t('inquiry.howToSend')}
          </p>
          <ol className="space-y-2 text-[12px] text-green-700">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">1</span>
              <span>{t('inquiry.step1')}</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">2</span>
              <span>{t('inquiry.step2')}</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-[11px] font-bold">3</span>
              <span>{t('inquiry.step3')}</span>
            </li>
          </ol>
        </div>

        {/* Desktop: Side-by-side layout */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
          <EmailPanel
            label={t('inquiry.japaneseSend')}
            subject={generatedEmail.subject_ja}
            body={generatedEmail.email_ja}
            dealerEmail={generatedEmail.dealer_email}
            isPrimary={true}
          />
          <EmailPanel
            label={t('inquiry.englishRef')}
            subject={generatedEmail.subject_en}
            body={generatedEmail.email_en}
            isPrimary={false}
          />
        </div>

        {/* Mobile: Tab-based layout */}
        <div className="lg:hidden">
          <TabButtons activeTab={activeTab} setActiveTab={setActiveTab} />
          {activeTab === 'japanese' ? (
            <EmailPanel
              label={t('inquiry.japaneseSend')}
              subject={generatedEmail.subject_ja}
              body={generatedEmail.email_ja}
              dealerEmail={generatedEmail.dealer_email}
              isPrimary={true}
            />
          ) : (
            <EmailPanel
              label={t('inquiry.englishRef')}
              subject={generatedEmail.subject_en}
              body={generatedEmail.email_en}
              isPrimary={false}
            />
          )}
        </div>

        {/* Copy Button - Always visible */}
        <div className="flex gap-2">
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
                {t('inquiry.copied')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('inquiry.copyJapanese')}
              </>
            )}
          </button>
          {mailtoLink && (
            <a
              href={mailtoLink}
              onClick={handleMailtoClick}
              className="px-4 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors flex items-center gap-2"
              title={t('inquiry.openInEmail')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
        </div>

        {/* Dealer Policies - Compact */}
        {generatedEmail.dealer_policies && (
          <div className="flex flex-wrap gap-2">
            {generatedEmail.dealer_policies.ships_international && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[11px]">
                {t('inquiry.shipsInternational')}
              </span>
            )}
            {generatedEmail.dealer_policies.accepts_wire_transfer && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[11px]">
                {t('inquiry.wireTransfer')}
              </span>
            )}
            {generatedEmail.dealer_policies.accepts_paypal && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[11px]">
                {t('inquiry.paypal')}
              </span>
            )}
            {generatedEmail.dealer_policies.english_support && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[11px]">
                {t('inquiry.englishSupport')}
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
            {t('inquiry.startOver')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors"
          >
            {t('inquiry.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Email Panel Component
// =============================================================================

interface EmailPanelProps {
  label: string;
  subject: string;
  body: string;
  dealerEmail?: string | null;
  isPrimary: boolean;
}

function EmailPanel({ label, subject, body, dealerEmail, isPrimary }: EmailPanelProps) {
  const { t } = useLocale();
  return (
    <div className={`bg-paper rounded-lg p-4 ${isPrimary ? 'border-2 border-gold' : 'border border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-[12px] uppercase tracking-wider text-muted">
          {label}
        </label>
        {isPrimary && dealerEmail && (
          <span className="text-[11px] text-muted">{t('inquiry.toLabel')} {dealerEmail}</span>
        )}
      </div>

      {/* Subject */}
      <div className="mb-3 pb-3 border-b border-border">
        <p className="text-[11px] text-muted mb-1">{t('inquiry.subjectLabel')}</p>
        <p className="text-[13px] text-ink">{subject}</p>
      </div>

      {/* Body - scrollable */}
      <div className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
        {body}
      </div>
    </div>
  );
}

// =============================================================================
// Tab Buttons Component (Mobile)
// =============================================================================

interface TabButtonsProps {
  activeTab: 'japanese' | 'english';
  setActiveTab: (tab: 'japanese' | 'english') => void;
}

function TabButtons({ activeTab, setActiveTab }: TabButtonsProps) {
  const { t } = useLocale();
  return (
    <div className="flex mb-4 bg-linen rounded-lg p-1">
      <button
        type="button"
        onClick={() => setActiveTab('japanese')}
        className={`flex-1 py-2 text-[13px] font-medium rounded-md transition-colors ${
          activeTab === 'japanese'
            ? 'bg-paper text-ink shadow-sm'
            : 'text-muted hover:text-ink'
        }`}
      >
        {t('inquiry.japanese')}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('english')}
        className={`flex-1 py-2 text-[13px] font-medium rounded-md transition-colors ${
          activeTab === 'english'
            ? 'bg-paper text-ink shadow-sm'
            : 'text-muted hover:text-ink'
        }`}
      >
        {t('inquiry.english')}
      </button>
    </div>
  );
}
