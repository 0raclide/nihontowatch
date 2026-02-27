'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { SubmitFeedbackRequest } from '@/types/feedback';

interface UseFeedbackSubmitOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Extra fields merged into every submission (target info, fixed feedback_type, etc.) */
  basePayload?: Partial<SubmitFeedbackRequest>;
}

export function useFeedbackSubmit({ isOpen, onClose, basePayload }: UseFeedbackSubmitOptions) {
  const { t } = useLocale();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setSubmitting(false);
      setSuccess(false);
      setError('');
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Auto-dismiss on success
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  const handleSubmit = useCallback(async (overrides?: Partial<SubmitFeedbackRequest>) => {
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          ...overrides,
          message: message.trim(),
          page_url: window.location.href,
        }),
      });

      if (res.status === 429) {
        setError(t('feedback.rateLimited'));
        return;
      }

      if (!res.ok) {
        setError(t('feedback.submitError'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('feedback.submitError'));
    } finally {
      setSubmitting(false);
    }
  }, [message, submitting, basePayload, t]);

  return { message, setMessage, submitting, success, error, handleSubmit };
}
