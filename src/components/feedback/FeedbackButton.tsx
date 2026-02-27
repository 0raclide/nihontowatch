'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleContext';
import { FeedbackModal } from './FeedbackModal';

export function FeedbackButton() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [showModal, setShowModal] = useState(false);

  const handleClose = useCallback(() => setShowModal(false), []);

  // Only show for logged-in users
  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="relative p-1 text-muted hover:text-gold transition-colors"
        aria-label={t('nav.feedback')}
        title={t('nav.feedback')}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      <FeedbackModal isOpen={showModal} onClose={handleClose} />
    </>
  );
}
