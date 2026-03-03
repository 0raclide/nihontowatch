'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

const NIHONTO_PRIMARY = [
  { value: 'katana', labelKey: 'itemType.katana' },
  { value: 'wakizashi', labelKey: 'itemType.wakizashi' },
  { value: 'tanto', labelKey: 'itemType.tanto' },
  { value: 'tachi', labelKey: 'itemType.tachi' },
  { value: 'naginata', labelKey: 'itemType.naginata' },
  { value: 'yari', labelKey: 'itemType.yari' },
];

const NIHONTO_MORE = [
  { value: 'kodachi', labelKey: 'itemType.kodachi' },
  { value: 'ken', labelKey: 'itemType.ken' },
  { value: 'naginata_naoshi', labelKey: 'itemType.naginata naoshi' },
  { value: 'daisho', labelKey: 'itemType.daisho' },
];

const TOSOGU_PRIMARY = [
  { value: 'tsuba', labelKey: 'itemType.tsuba' },
  { value: 'fuchi_kashira', labelKey: 'itemType.fuchi_kashira' },
  { value: 'menuki', labelKey: 'itemType.menuki' },
  { value: 'kozuka', labelKey: 'itemType.kozuka' },
  { value: 'kogai', labelKey: 'itemType.kogai' },
];

const TOSOGU_MORE = [
  { value: 'mitokoromono', labelKey: 'itemType.mitokoromono' },
  { value: 'futatokoro', labelKey: 'itemType.futatokoro' },
  { value: 'gotokoromono', labelKey: 'itemType.gotokoromono' },
  { value: 'koshirae', labelKey: 'itemType.koshirae' },
  { value: 'tosogu', labelKey: 'itemType.tosogu' },
];

interface TypePillsProps {
  category: 'nihonto' | 'tosogu';
  value: string | null;
  onChange: (type: string | null) => void;
}

export function TypePills({ category, value, onChange }: TypePillsProps) {
  const { t } = useLocale();
  const [showMore, setShowMore] = useState(false);

  const primary = category === 'nihonto' ? NIHONTO_PRIMARY : TOSOGU_PRIMARY;
  const more = category === 'nihonto' ? NIHONTO_MORE : TOSOGU_MORE;

  // Auto-expand if current value is in the "more" list
  const isMoreSelected = more.some(({ value: v }) => v === value);
  const expanded = showMore || isMoreSelected;

  return (
    <div className="flex flex-wrap gap-2">
      {primary.map(({ value: v, labelKey }) => (
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
      {expanded ? (
        more.map(({ value: v, labelKey }) => (
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
        ))
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium text-muted border border-border/50 hover:border-gold/30 transition-all"
        >
          {t('dealer.more')} +
        </button>
      )}
    </div>
  );
}
