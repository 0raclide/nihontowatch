'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n/LocaleContext';

interface FeedbackModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  success: boolean;
  successMessage: string;
  /** Rendered between header and textarea */
  children?: ReactNode;
  /** Modal header */
  title: string;
  subtitle?: string;
  /** Textarea state */
  message: string;
  onMessageChange: (value: string) => void;
  placeholder: string;
  /** Submit state */
  submitting: boolean;
  error: string;
  onSubmit: () => void;
}

export function FeedbackModalShell({
  isOpen,
  onClose,
  success,
  successMessage,
  children,
  title,
  subtitle,
  message,
  onMessageChange,
  placeholder,
  submitting,
  error,
  onSubmit,
}: FeedbackModalShellProps) {
  const { t } = useLocale();

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-cream border border-border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        {success ? (
          <div className="px-6 py-10 text-center">
            <svg className="w-8 h-8 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-ink">{successMessage}</p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-sm font-medium text-ink">{title}</h3>
              {subtitle && <p className="text-xs text-muted mt-1 truncate">{subtitle}</p>}
            </div>

            <div className="px-6 pb-5">
              {children}

              <textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder={placeholder}
                maxLength={2000}
                rows={4}
                autoFocus
                className="w-full px-3 py-2.5 text-sm text-ink bg-paper border border-border rounded
                  placeholder:text-muted/40 focus:outline-none focus:border-gold/40
                  focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] resize-none transition-all"
              />

              {error && (
                <p className="text-xs text-red-500 mt-2">{error}</p>
              )}

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={onClose}
                  className="text-xs text-muted hover:text-ink transition-colors"
                >
                  {t('feedback.cancel')}
                </button>
                <button
                  onClick={onSubmit}
                  disabled={!message.trim() || submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-gold rounded
                    hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('feedback.submit')}
                    </span>
                  ) : (
                    t('feedback.submit')
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
