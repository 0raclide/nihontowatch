'use client';

import { useLocale } from '@/i18n/LocaleContext';

/**
 * MeiDistributionBar — Typographic signature type distribution.
 *
 * Museum catalog style: clean rows matching FormDistributionBar.
 * Shows proportion of signed vs attributed works.
 */

interface MeiDistributionBarProps {
  distribution: Record<string, number>;
}

/** Maps distribution keys to mei.* translation keys */
const MEI_TRANSLATION_KEYS: Record<string, string> = {
  signed: 'mei.signed',
  mumei: 'mei.mumei',
  attributed: 'mei.attributed',
  den: 'mei.den',
  gimei: 'mei.gimei',
  orikaeshi_mei: 'mei.orikaeshi',
  gaku_mei: 'mei.gaku',
  suriage: 'mei.suriage',
  kinzogan_mei: 'mei.kinzogan',
  shu_mei: 'mei.shu',
  kinpun_mei: 'mei.kinpun',
  ginzogan_mei: 'mei.ginzogan',
  kiritsuke_mei: 'mei.kiritsuke',
  shusho_mei: 'mei.shusho',
};

export function MeiDistributionBar({ distribution }: MeiDistributionBarProps) {
  const { t } = useLocale();

  const entries = Object.entries(distribution)
    .filter(([key, count]) => count > 0 && key !== 'total')
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="space-y-0">
      {entries.map(([type, count], i) => {
        const translationKey = MEI_TRANSLATION_KEYS[type];
        const label = translationKey ? t(translationKey) : type.charAt(0).toUpperCase() + type.slice(1);
        const pct = Math.round((count / total) * 100);

        return (
          <div
            key={type}
            className={`flex items-baseline justify-between py-2 ${
              i < entries.length - 1 ? 'border-b border-border/30' : ''
            }`}
          >
            <span className="text-sm text-ink">{label}</span>
            <div className="flex items-baseline gap-3">
              <span className="text-sm tabular-nums text-ink font-light">{count}</span>
              <span className="text-xs tabular-nums text-ink/45 w-10 text-right">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
