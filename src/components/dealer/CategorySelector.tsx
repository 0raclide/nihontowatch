'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface CategorySelectorProps {
  value: 'nihonto' | 'tosogu';
  onChange: (category: 'nihonto' | 'tosogu') => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { t } = useLocale();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('nihonto')}
        className={`flex-1 py-3 rounded-lg text-[13px] font-medium transition-all ${
          value === 'nihonto'
            ? 'bg-gold text-white shadow-sm'
            : 'bg-surface text-muted hover:bg-hover'
        }`}
      >
        {t('dealer.nihonto')}
      </button>
      <button
        type="button"
        onClick={() => onChange('tosogu')}
        className={`flex-1 py-3 rounded-lg text-[13px] font-medium transition-all ${
          value === 'tosogu'
            ? 'bg-gold text-white shadow-sm'
            : 'bg-surface text-muted hover:bg-hover'
        }`}
      >
        {t('dealer.tosogu')}
      </button>
    </div>
  );
}
