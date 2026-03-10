'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

/**
 * MeiDistributionBar — Typographic signature type distribution.
 *
 * Museum catalog style: clean rows matching FormDistributionBar.
 * Shows proportion of signed vs attributed works.
 * Rows with form breakdown data are clickable — expanding to show
 * item type counts (e.g., "135 Katana, 29 Tanto").
 */

interface MeiDistributionBarProps {
  distribution: Record<string, number>;
  formByMei?: Record<string, Record<string, number>>;
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

/** Maps form keys to itemType.* translation keys (shared with FormDistributionBar) */
const FORM_TRANSLATION_KEYS: Record<string, string> = {
  tanto: 'itemType.tanto',
  katana: 'itemType.katana',
  tachi: 'itemType.tachi',
  wakizashi: 'itemType.wakizashi',
  naginata: 'itemType.naginata',
  yari: 'itemType.yari',
  ken: 'itemType.ken',
  kodachi: 'itemType.kodachi',
  tsuba: 'itemType.tsuba',
  kozuka: 'itemType.kozuka',
  kogai: 'itemType.kogai',
  menuki: 'itemType.menuki',
  fuchi: 'itemType.fuchi',
  kashira: 'itemType.kashira',
  'fuchi-kashira': 'itemType.fuchi-kashira',
  mitokoromono: 'itemType.mitokoromono',
  futatokoromono: 'itemType.futatokoromono',
  soroimono: 'itemType.soroimono',
  other: 'itemType.other',
};

export function MeiDistributionBar({ distribution, formByMei }: MeiDistributionBarProps) {
  const [expandedMei, setExpandedMei] = useState<string | null>(null);
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
        const formBreakdown = formByMei?.[type];
        const isExpandable = formBreakdown && Object.keys(formBreakdown).length > 0;
        const isExpanded = expandedMei === type;
        const isLast = i === entries.length - 1;

        if (isExpandable) {
          const formEntries = Object.entries(formBreakdown)
            .filter(([, c]) => c > 0)
            .sort(([, a], [, b]) => b - a);

          return (
            <div key={type} className={!isLast ? 'border-b border-border/30' : ''}>
              <button
                type="button"
                onClick={() => setExpandedMei(isExpanded ? null : type)}
                className="flex items-baseline justify-between py-2 w-full text-left hover:bg-hover/30 -mx-2 px-2 rounded transition-colors cursor-pointer"
              >
                <span className="text-sm text-ink flex items-baseline gap-1.5">
                  <span className="text-ink/30 text-[10px] shrink-0">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  {label}
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-sm tabular-nums text-ink font-light">{count}</span>
                  <span className="text-xs tabular-nums text-ink/45 w-10 text-right">{pct}%</span>
                </div>
              </button>
              {isExpanded && (
                <div className="pl-5 pr-2 pb-2">
                  {formEntries.map(([formKey, formCount]) => {
                    const formTransKey = FORM_TRANSLATION_KEYS[formKey];
                    const formLabel = formTransKey ? t(formTransKey) : formKey.charAt(0).toUpperCase() + formKey.slice(1);
                    return (
                      <div
                        key={formKey}
                        className="flex items-baseline justify-between py-1"
                      >
                        <span className="text-xs text-ink/60">{formLabel}</span>
                        <span className="text-xs tabular-nums text-ink/50 font-light">{formCount}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={type}
            className={`flex items-baseline justify-between py-2 ${
              !isLast ? 'border-b border-border/30' : ''
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
