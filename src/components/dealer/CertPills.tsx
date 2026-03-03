'use client';

import { useLocale } from '@/i18n/LocaleContext';

const CERT_OPTIONS = [
  { value: 'Tokubetsu Juyo', labelKey: 'cert.tokuju' },
  { value: 'Juyo', labelKey: 'cert.juyo' },
  { value: 'Tokubetsu Hozon', labelKey: 'cert.Tokubetsu Hozon' },
  { value: 'Hozon', labelKey: 'cert.hozon' },
];

/**
 * Sentinel value meaning "dealer explicitly chose no certification".
 * The form must convert this to `null` before sending to the API.
 */
export const CERT_NONE = 'none';

interface CertPillsProps {
  value: string | null;
  onChange: (cert: string | null) => void;
}

export function CertPills({ value, onChange }: CertPillsProps) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap gap-2">
      {CERT_OPTIONS.map(({ value: v, labelKey }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          aria-pressed={value === v}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            value === v
              ? 'bg-gold/10 text-gold border border-gold/30'
              : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(value === CERT_NONE ? null : CERT_NONE)}
        aria-pressed={value === CERT_NONE}
        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
          value === CERT_NONE
            ? 'bg-gold/10 text-gold border border-gold/30'
            : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
        }`}
      >
        {t('cert.none')}
      </button>
    </div>
  );
}
