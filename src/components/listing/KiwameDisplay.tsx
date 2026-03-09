'use client';

import type { KiwameEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

const KIWAME_TYPE_KEYS: Record<string, string> = {
  origami: 'dealer.kiwameTypeOrigami',
  kinzogan: 'dealer.kiwameTypeKinzogan',
  saya_mei: 'dealer.kiwameTypeSayaMei',
  other: 'dealer.kiwameTypeOther',
};

interface KiwameDisplayProps {
  kiwame: KiwameEntry[];
  readable?: boolean;
}

export function KiwameDisplay({ kiwame, readable }: KiwameDisplayProps) {
  const { t } = useLocale();

  if (!kiwame || kiwame.length === 0) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border">
      <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-2`}>
        {t('dealer.kiwame')}
      </div>
      <div className="space-y-3">
        {kiwame.map((entry, i) => (
          <div key={entry.id || i}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} font-medium text-ink`}>
                {entry.judge_name}
                {entry.judge_name_ja && (
                  <span className={`ml-2 ${readable ? 'text-[13px]' : 'text-[12px]'} text-muted font-normal`}>{entry.judge_name_ja}</span>
                )}
              </span>
              <span className="inline-block px-2 py-0.5 bg-gold/10 text-gold text-[10px] rounded-full border border-gold/20">
                {t(KIWAME_TYPE_KEYS[entry.kiwame_type] || 'dealer.kiwameTypeOther')}
              </span>
            </div>
            {entry.notes && (
              <p className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap`}>
                {entry.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
