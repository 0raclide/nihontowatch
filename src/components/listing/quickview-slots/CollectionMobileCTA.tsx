'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface CollectionMobileCTAProps {
  onEditCollection?: () => void;
}

export function CollectionMobileCTA({ onEditCollection }: CollectionMobileCTAProps) {
  const { t } = useLocale();

  return (
    <div className="flex gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEditCollection?.();
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        {t('common.edit')}
      </button>
    </div>
  );
}
