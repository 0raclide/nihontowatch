'use client';

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { D, type P } from './scatter-data';

/* ─── Colors ──────────────────────────────────────────────────────────── */

const SWORD_COLOR = '#6B7280';
const TOSOGU_COLOR = '#B8860B';
const CONCORDANT_COLOR = '#3B82F6';
const DIVERGENT_COLOR = '#DC2626';

/* ─── Shared tooltip ──────────────────────────────────────────────────── */

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: P }>;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-medium text-ink mb-1.5">
        {p.n} <span className="text-muted font-normal">({p.id})</span>
      </p>
      <div className="space-y-0.5 text-charcoal">
        <p>
          <span className="text-muted">Elite Factor:</span>{' '}
          <span className="tabular-nums">{p.ef.toFixed(4)}</span>
        </p>
        <p>
          <span className="text-muted">Provenance Factor:</span>{' '}
          <span className="tabular-nums">{p.pf.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Raw scatter chart (EF vs PF) ────────────────────────────────────── */

function RawScatter({
  data,
  color,
  efMax,
  pfMax,
}: {
  data: P[];
  color: string;
  efMax: number;
  pfMax: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 10 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle, #e5e5e5)"
        />
        <XAxis
          type="number"
          dataKey="ef"
          name="Elite Factor"
          domain={[0, efMax]}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false}
          label={{
            value: 'Elite Factor',
            position: 'bottom',
            offset: 30,
            style: {
              fontSize: 12,
              fill: 'var(--text-charcoal)',
              fontFamily: 'var(--font-serif, Georgia, serif)',
            },
          }}
        />
        <YAxis
          type="number"
          dataKey="pf"
          name="Provenance Factor"
          domain={[1.5, pfMax]}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false}
          label={{
            value: 'Provenance Factor',
            angle: -90,
            position: 'insideLeft',
            offset: 10,
            style: {
              fontSize: 12,
              fill: 'var(--text-charcoal)',
              fontFamily: 'var(--font-serif, Georgia, serif)',
            },
          }}
        />
        <Tooltip content={<ScatterTooltip />} />
        <Scatter data={data} fill={color} r={3}>
          {data.map((p, i) => (
            <Cell
              key={i}
              r={p.l ? 5 : 3}
              fillOpacity={p.l ? 0.85 : 0.35}
              stroke={p.l ? color : 'none'}
              strokeWidth={p.l ? 1 : 0}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ─── Divergence chart (percentile-percentile) ────────────────────────── */

type Ranked = P & { er: number; pr: number; divergence: number };

function DivergenceScatter({ data, color }: { data: P[]; color: string }) {
  const ranked: Ranked[] = useMemo(() => {
    const both = data.filter((p) => p.ef > 0 && p.pf > 0);
    const byEf = [...both].sort((a, b) => a.ef - b.ef);
    const byPf = [...both].sort((a, b) => a.pf - b.pf);
    const n = both.length;
    const efRank = new Map(byEf.map((p, i) => [p, (i + 0.5) / n]));
    const pfRank = new Map(byPf.map((p, i) => [p, (i + 0.5) / n]));
    return both.map((p) => {
      const er = efRank.get(p)!;
      const pr = pfRank.get(p)!;
      return { ...p, er, pr, divergence: Math.abs(er - pr) };
    });
  }, [data]);

  const bothCount = ranked.length;

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle, #e5e5e5)"
          />
          <XAxis
            type="number"
            dataKey="er"
            name="Elite Factor Percentile"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}`}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            label={{
              value: 'Elite Factor Percentile',
              position: 'bottom',
              offset: 30,
              style: {
                fontSize: 12,
                fill: 'var(--text-charcoal)',
                fontFamily: 'var(--font-serif, Georgia, serif)',
              },
            }}
          />
          <YAxis
            type="number"
            dataKey="pr"
            name="Provenance Factor Percentile"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}`}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            label={{
              value: 'Provenance Factor Percentile',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: {
                fontSize: 12,
                fill: 'var(--text-charcoal)',
                fontFamily: 'var(--font-serif, Georgia, serif)',
              },
            }}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            stroke="var(--text-muted)"
            strokeDasharray="6 3"
            strokeOpacity={0.5}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]?.payload) return null;
              const p = payload[0].payload as Ranked;
              return (
                <div className="bg-paper border border-border rounded-lg p-3 shadow-lg text-xs">
                  <p className="font-medium text-ink mb-1.5">
                    {p.n} <span className="text-muted font-normal">({p.id})</span>
                  </p>
                  <div className="space-y-0.5 text-charcoal">
                    <p>
                      <span className="text-muted">Elite percentile:</span>{' '}
                      <span className="tabular-nums">
                        {Math.round(p.er * 100)}th
                      </span>
                    </p>
                    <p>
                      <span className="text-muted">
                        Provenance percentile:
                      </span>{' '}
                      <span className="tabular-nums">
                        {Math.round(p.pr * 100)}th
                      </span>
                    </p>
                    <p>
                      <span className="text-muted">Divergence:</span>{' '}
                      <span className="tabular-nums">
                        {(p.divergence * 100).toFixed(0)} pts
                      </span>
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={ranked} r={3}>
            {ranked.map((p, i) => {
              const t = Math.min(p.divergence / 0.5, 1);
              const r = Math.round(59 + t * (220 - 59));
              const g = Math.round(130 + t * (38 - 130));
              const b = Math.round(246 + t * (38 - 246));
              return (
                <Cell
                  key={i}
                  fill={`rgb(${r},${g},${b})`}
                  fillOpacity={p.l ? 0.9 : 0.55}
                  r={p.l ? 5 : 3}
                  stroke={p.l ? `rgb(${r},${g},${b})` : 'none'}
                  strokeWidth={p.l ? 1 : 0}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: CONCORDANT_COLOR }}
          />
          Concordant
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-2.5 rounded-full"
            style={{
              background: 'linear-gradient(to right, #3B82F6, #DC2626)',
            }}
          />
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: DIVERGENT_COLOR }}
          />
          Divergent
        </span>
        <span className="text-muted/60">
          ({bothCount} artisans with both metrics &gt; 0)
        </span>
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────────────── */

export function MethodologyFigures() {
  const sword = useMemo(() => D.filter((p) => p.d === 's'), []);
  const tosogu = useMemo(() => D.filter((p) => p.d === 't'), []);

  const swordBoth = sword.filter((p) => p.ef > 0).length;
  const tosoguBoth = tosogu.filter((p) => p.ef > 0).length;

  return (
    <div className="space-y-14 mt-12 mb-8">
      {/* ─── Swordsmiths ──────────────────────────────────────────── */}
      <div>
        <h3 className="font-serif text-lg text-ink mb-6">Swordsmiths</h3>

        <figure className="mb-10">
          <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
            <RawScatter
              data={sword}
              color={SWORD_COLOR}
              efMax={0.7}
              pfMax={5.5}
            />
          </div>
          <figcaption className="mt-3 text-sm text-muted leading-relaxed">
            <strong className="text-charcoal">Figure 1.</strong> Elite factor
            versus provenance factor for {sword.length} swordsmiths with
            documented provenance. The vertical cluster at x = 0 represents{' '}
            {sword.length - swordBoth} artisans with provenance data but no
            elite designations. Notable artisans discussed in Parts III and IV
            are enlarged. Hover for details.
          </figcaption>
        </figure>

        <figure>
          <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
            <DivergenceScatter data={sword} color={SWORD_COLOR} />
          </div>
          <figcaption className="mt-3 text-sm text-muted leading-relaxed">
            <strong className="text-charcoal">Figure 2.</strong> Percentile
            agreement for swordsmiths. Each axis shows the artisan&apos;s rank
            within the group. Points on the dashed diagonal have identical
            percentile ranks on both metrics. Color ranges from blue
            (concordant) to red (divergent). Artisans far from the diagonal
            — such as Kunimitsu (high provenance, modest elite) or Masatsune
            (high elite, modest provenance) — are those whose elite status and
            provenance prestige tell meaningfully different stories.
          </figcaption>
        </figure>
      </div>

      {/* ─── Tosogu Artists ───────────────────────────────────────── */}
      <div>
        <h3 className="font-serif text-lg text-ink mb-6">Tosogu Artists</h3>

        <figure className="mb-10">
          <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
            <RawScatter
              data={tosogu}
              color={TOSOGU_COLOR}
              efMax={0.38}
              pfMax={3.0}
            />
          </div>
          <figcaption className="mt-3 text-sm text-muted leading-relaxed">
            <strong className="text-charcoal">Figure 3.</strong> Elite factor
            versus provenance factor for {tosogu.length} tosogu artists with
            documented provenance. The compressed scale compared to swordsmiths
            reflects the structurally lower elite rates and narrower provenance
            range in the tosogu domain. {tosogu.length - tosoguBoth} artisans
            sit at x = 0 (provenance but no elite designations).
          </figcaption>
        </figure>

        <figure>
          <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
            <DivergenceScatter data={tosogu} color={TOSOGU_COLOR} />
          </div>
          <figcaption className="mt-3 text-sm text-muted leading-relaxed">
            <strong className="text-charcoal">Figure 4.</strong> Percentile
            agreement for tosogu artists. The Goto family dominates the
            provenance axis (above the diagonal), reflecting their centuries of
            shogunal patronage. Somin and Kaneie — the two highest-ranked by
            elite factor — sit near or below the diagonal, indicating that
            their NBTHK recognition exceeds their documented provenance trail.
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
