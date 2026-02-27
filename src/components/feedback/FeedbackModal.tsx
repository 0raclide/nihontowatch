'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useFeedbackSubmit } from './useFeedbackSubmit';
import { FeedbackModalShell } from './FeedbackModalShell';
import type { FeedbackType } from '@/types/feedback';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: Array<{ value: FeedbackType; labelKey: string }> = [
  { value: 'bug', labelKey: 'feedback.bug' },
  { value: 'feature_request', labelKey: 'feedback.featureIdea' },
  { value: 'other', labelKey: 'feedback.other' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useLocale();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const { message, setMessage, submitting, success, error, handleSubmit } = useFeedbackSubmit({
    isOpen,
    onClose,
  });

  // Reset type when modal opens
  useEffect(() => {
    if (isOpen) setFeedbackType('bug');
  }, [isOpen]);

  return (
    <FeedbackModalShell
      isOpen={isOpen}
      onClose={onClose}
      success={success}
      successMessage={t('feedback.thanksFeedback')}
      title={t('feedback.sendFeedback')}
      message={message}
      onMessageChange={setMessage}
      placeholder={t('feedback.tellUs')}
      submitting={submitting}
      error={error}
      onSubmit={() => handleSubmit({ feedback_type: feedbackType })}
    >
      {/* Type pills */}
      <div className="flex gap-2 mb-4">
        {FEEDBACK_TYPES.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setFeedbackType(value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              feedbackType === value
                ? 'bg-gold/10 border-gold/40 text-gold font-medium'
                : 'bg-transparent border-border text-muted hover:border-gold/20 hover:text-ink'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </FeedbackModalShell>
  );
}
