'use client';

import { useLocale } from '@/i18n/LocaleContext';
import { SPECIALIZATIONS } from '@/lib/dealer/specializations';

interface SpecializationPillsProps {
  selected: string[];
  onChange: (values: string[]) => void;
}

export function SpecializationPills({ selected, onChange }: SpecializationPillsProps) {
  const { t } = useLocale();

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">
        {t('dealer.specializations')}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {SPECIALIZATIONS.map(({ value, labelKey }) => {
          const isActive = selected.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggle(value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                isActive
                  ? 'bg-gold/10 text-gold border-gold/30'
                  : 'text-muted border-border/50 hover:border-gold/30'
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
