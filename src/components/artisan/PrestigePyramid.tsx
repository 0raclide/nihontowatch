'use client';

/**
 * PrestigePyramid — Typographic certification hierarchy with subtle bars.
 *
 * Museum catalog style: clean rows with quiet visual weight
 * from indentation and proportional fill indicators.
 */

interface PrestigePyramidProps {
  kokuho: number;
  jubun: number;
  jubi: number;
  gyobutsu: number;
  tokuju: number;
  juyo: number;
}

const TIERS = [
  { key: 'kokuho', label: 'Kokuhō', fullLabel: 'National Treasure', indent: 0 },
  { key: 'jubun', label: 'Jūyō Bunkazai', fullLabel: 'Important Cultural Property', indent: 1 },
  { key: 'jubi', label: 'Jūyō Bijutsuhin', fullLabel: 'Important Art Object', indent: 2 },
  { key: 'gyobutsu', label: 'Gyobutsu', fullLabel: 'Imperial Collection', indent: 2 },
  { key: 'tokuju', label: 'Tokubetsu Jūyō', fullLabel: 'Tokubetsu Jūyō Tōken', indent: 3 },
  { key: 'juyo', label: 'Jūyō Tōken', fullLabel: 'Jūyō Tōken', indent: 3 },
] as const;

export function PrestigePyramid({ kokuho, jubun, jubi, gyobutsu, tokuju, juyo }: PrestigePyramidProps) {
  const counts: Record<string, number> = { kokuho, jubun, jubi, gyobutsu, tokuju, juyo };
  const hasAnyCerts = Object.values(counts).some(c => c > 0);
  const maxCount = Math.max(...Object.values(counts), 1);

  if (!hasAnyCerts) return null;

  return (
    <div className="space-y-0">
      {TIERS.map((tier, i) => {
        const count = counts[tier.key];
        const active = count > 0;
        const barWidth = active ? Math.max((count / maxCount) * 100, 8) : 0;

        return (
          <div
            key={tier.key}
            className={`py-2.5 ${
              i < TIERS.length - 1 ? 'border-b border-border/20' : ''
            }`}
            style={{ paddingLeft: `${tier.indent * 16}px` }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-sm ${active ? 'text-ink' : 'text-ink/25'}`}>
                {tier.label}
              </span>
              <span className={`tabular-nums text-sm font-light ${
                active ? 'text-ink' : 'text-ink/20'
              }`}>
                {active ? count : '—'}
              </span>
            </div>
            {active && (
              <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold/40 rounded-full"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
