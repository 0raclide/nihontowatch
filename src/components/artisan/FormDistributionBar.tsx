'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { MeasurementPanel } from './MeasurementPanel';

/**
 * FormDistributionBar — Clean tabular form distribution.
 *
 * Scholarly style: a simple proportional layout,
 * no colored bars. Typography carries the hierarchy.
 * Rows with measurement data are clickable — expanding to show
 * box-plot style range bars for nagasa, sori, motohaba, sakihaba.
 */

interface MeasurementData {
  nagasa: number[];
  sori: number[];
  motohaba: number[];
  sakihaba: number[];
}

interface FormDistributionBarProps {
  distribution: Record<string, number>;
  measurementsByForm?: Record<string, MeasurementData>;
}

/** Maps distribution keys to itemType.* translation keys */
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

function hasMeasurements(m: MeasurementData | undefined): boolean {
  if (!m) return false;
  return m.nagasa.length > 0 || m.sori.length > 0 || m.motohaba.length > 0 || m.sakihaba.length > 0;
}

export function FormDistributionBar({ distribution, measurementsByForm }: FormDistributionBarProps) {
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const { t } = useLocale();

  const entries = Object.entries(distribution)
    .filter(([key, count]) => count > 0 && key !== 'total')
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="space-y-0">
      {entries.map(([form, count], i) => {
        const translationKey = FORM_TRANSLATION_KEYS[form];
        const label = translationKey ? t(translationKey) : form.charAt(0).toUpperCase() + form.slice(1);
        const pct = Math.round((count / total) * 100);
        const formMeasurements = measurementsByForm?.[form];
        const isExpandable = hasMeasurements(formMeasurements);
        const isExpanded = expandedForm === form;
        const isLast = i === entries.length - 1;

        if (isExpandable) {
          return (
            <div key={form} className={!isLast ? 'border-b border-border/30' : ''}>
              <button
                type="button"
                onClick={() => setExpandedForm(isExpanded ? null : form)}
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
                <div className="pl-5 pr-2">
                  <MeasurementPanel measurements={formMeasurements!} />
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={form}
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
