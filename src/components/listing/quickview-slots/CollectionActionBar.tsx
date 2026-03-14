'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface CollectionActionBarProps {
  onEditCollection?: () => void;
  onDeaccession?: () => void;
  holdingStatus?: string;
}

export function CollectionActionBar({ onEditCollection, onDeaccession, holdingStatus }: CollectionActionBarProps) {
  const { t } = useLocale();

  return (
    <>
      {onEditCollection && (
        <button
          onClick={onEditCollection}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
          aria-label={t('common.edit')}
          title={t('common.edit')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      )}
      {onDeaccession && holdingStatus === 'owned' && (
        <button
          onClick={onDeaccession}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
          aria-label={t('vault.deaccession.title')}
          title={t('vault.deaccession.title')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </button>
      )}
    </>
  );
}
