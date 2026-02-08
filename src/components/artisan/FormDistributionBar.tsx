'use client';

/**
 * FormDistributionBar — Clean tabular form distribution.
 *
 * Scholarly style: a simple proportional layout,
 * no colored bars. Typography carries the hierarchy.
 */

interface FormDistributionBarProps {
  distribution: Record<string, number>;
}

const FORM_LABELS: Record<string, string> = {
  tanto: 'Tantō',
  katana: 'Katana',
  tachi: 'Tachi',
  wakizashi: 'Wakizashi',
  naginata: 'Naginata',
  yari: 'Yari',
  ken: 'Ken',
  kodachi: 'Kodachi',
  other: 'Other',
};

export function FormDistributionBar({ distribution }: FormDistributionBarProps) {
  const entries = Object.entries(distribution)
    .filter(([key, count]) => count > 0 && key !== 'total')
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="space-y-0">
      {entries.map(([form, count], i) => {
        const label = FORM_LABELS[form] || form.charAt(0).toUpperCase() + form.slice(1);
        const pct = Math.round((count / total) * 100);

        return (
          <div
            key={form}
            className={`flex items-baseline justify-between py-2 ${
              i < entries.length - 1 ? 'border-b border-border/30' : ''
            }`}
          >
            <span className="text-sm text-ink">{label}</span>
            <div className="flex items-baseline gap-3">
              <span className="text-sm tabular-nums text-ink font-light">{count}</span>
              <span className="text-xs tabular-nums text-muted w-10 text-right">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
