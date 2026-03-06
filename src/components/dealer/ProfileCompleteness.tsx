'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface ProfileCompletenessProps {
  score: number;
  missing: string[];
}

export function ProfileCompleteness({ score, missing }: ProfileCompletenessProps) {
  const { t } = useLocale();

  const color = score < 33 ? 'bg-amber-500' : score < 67 ? 'bg-gold' : 'bg-green-500';

  return (
    <div className="bg-hover/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium">{t('dealer.profileCompleteness')}</span>
        <span className="text-[13px] font-medium">{score}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-border/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Missing items (up to 3) */}
      {missing.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {missing.slice(0, 3).map((key) => (
            <div key={key} className="flex items-center gap-2 text-[11px] text-muted">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v8m-4-4h8" />
              </svg>
              {t(key)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
