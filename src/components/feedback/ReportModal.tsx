'use client';

import { useLocale } from '@/i18n/LocaleContext';
import { useFeedbackSubmit } from './useFeedbackSubmit';
import { FeedbackModalShell } from './FeedbackModalShell';
import type { FeedbackTargetType } from '@/types/feedback';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: FeedbackTargetType;
  targetId: string;
  targetLabel: string;
}

export function ReportModal({ isOpen, onClose, targetType, targetId, targetLabel }: ReportModalProps) {
  const { t } = useLocale();
  const { message, setMessage, submitting, success, error, handleSubmit } = useFeedbackSubmit({
    isOpen,
    onClose,
    basePayload: {
      feedback_type: 'data_report',
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel,
    },
  });

  return (
    <FeedbackModalShell
      isOpen={isOpen}
      onClose={onClose}
      success={success}
      successMessage={t('feedback.thanks')}
      title={t('feedback.reportIssue')}
      subtitle={targetLabel}
      message={message}
      onMessageChange={setMessage}
      placeholder={t('feedback.whatLooksWrong')}
      submitting={submitting}
      error={error}
      onSubmit={() => handleSubmit()}
    />
  );
}
