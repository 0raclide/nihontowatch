'use client';

import { useLocale } from '@/i18n/LocaleContext';

const NIHONTO_TYPES = [
  { value: 'katana', labelKey: 'itemType.katana' },
  { value: 'wakizashi', labelKey: 'itemType.wakizashi' },
  { value: 'tanto', labelKey: 'itemType.tanto' },
  { value: 'tachi', labelKey: 'itemType.tachi' },
  { value: 'naginata', labelKey: 'itemType.naginata' },
  { value: 'yari', labelKey: 'itemType.yari' },
];

const TOSOGU_TYPES = [
  { value: 'tsuba', labelKey: 'itemType.tsuba' },
  { value: 'fuchi_kashira', labelKey: 'itemType.fuchi_kashira' },
  { value: 'menuki', labelKey: 'itemType.menuki' },
  { value: 'kozuka', labelKey: 'itemType.kozuka' },
  { value: 'kogai', labelKey: 'itemType.kogai' },
];

interface TypePillsProps {
  category: 'nihonto' | 'tosogu';
  value: string | null;
  onChange: (type: string | null) => void;
}

export function TypePills({ category, value, onChange }: TypePillsProps) {
  const { t } = useLocale();
  const types = category === 'nihonto' ? NIHONTO_TYPES : TOSOGU_TYPES;

  return (
    <div className="flex flex-wrap gap-2">
      {types.map(({ value: v, labelKey }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            value === v
              ? 'bg-gold/10 text-gold border border-gold/30'
              : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
