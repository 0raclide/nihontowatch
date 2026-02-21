'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface AddItemCardProps {
  onClick: () => void;
}

export function AddItemCard({ onClick }: AddItemCardProps) {
  const { t } = useLocale();
  return (
    <button
      onClick={onClick}
      className="group block w-full bg-cream border-2 border-dashed border-border/60 hover:border-gold/60 transition-all duration-300 cursor-pointer rounded overflow-hidden"
    >
      {/* Match CollectionCard height: header + 3:4 image + content */}
      <div className="px-3 py-2">
        <span className="text-[10px] font-medium tracking-[0.14em] text-transparent">placeholder</span>
      </div>
      <div className="relative aspect-[3/4] flex items-center justify-center bg-linen/30">
        <div className="flex flex-col items-center gap-3 text-muted/30 group-hover:text-gold/60 transition-colors">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[13px] font-medium tracking-wide">{t('collection.addItem')}</span>
        </div>
      </div>
      <div className="px-3 pt-3 pb-3">
        <div className="text-[15px] font-semibold text-transparent">placeholder</div>
        <div className="h-[20px]" />
        <div className="pt-2 mt-1 border-t border-transparent" />
      </div>
    </button>
  );
}
