'use client';

/**
 * MeiDistributionBar — Typographic signature type distribution.
 *
 * Museum catalog style: clean rows matching FormDistributionBar.
 * Shows proportion of signed vs attributed works.
 */

interface MeiDistributionBarProps {
  distribution: Record<string, number>;
}

const MEI_LABELS: Record<string, string> = {
  signed: 'Signed (mei)',
  mumei: 'Mumei (unsigned)',
  attributed: 'Attributed',
  den: 'Den (tradition)',
  gimei: 'Gimei (false)',
  orikaeshi_mei: 'Orikaeshi Mei',
  gaku_mei: 'Gaku Mei',
  suriage: 'Suriage',
  kinzogan_mei: 'Kinzōgan Mei',
  shu_mei: 'Shū Mei',
};

export function MeiDistributionBar({ distribution }: MeiDistributionBarProps) {
  const entries = Object.entries(distribution)
    .filter(([key, count]) => count > 0 && key !== 'total')
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="space-y-0">
      {entries.map(([type, count], i) => {
        const label = MEI_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
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
              <span className="text-xs tabular-nums text-muted w-10 text-right">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
