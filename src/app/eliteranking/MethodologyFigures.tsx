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

const SWORD_COLOR = '#6B7280'; // gray-500
const TOSOGU_COLOR = '#B8860B'; // dark goldenrod
const CONCORDANT_COLOR = '#3B82F6'; // blue-500
const DIVERGENT_COLOR = '#DC2626'; // red-600
const NEUTRAL_COLOR = '#9CA3AF'; // gray-400

/* ─── Tooltip ─────────────────────────────────────────────────────────── */

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: P & { name?: string } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-medium text-ink mb-1.5">{p.n}</p>
      <div className="space-y-0.5 text-charcoal">
        <p>
          <span className="text-muted">Domain:</span>{' '}
          {p.d === 's' ? 'Sword' : 'Tosogu'}
        </p>
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

/* ─── Custom label renderer for notable artisans ──────────────────────── */

function renderLabel(props: {
  x?: number;
  y?: number;
  value?: string;
  index?: number;
  payload?: P;
}) {
  const { x, y, payload } = props;
  if (!payload?.l || !x || !y) return null;

  // Offset labels to avoid overlap with dots
  const offsets: Record<string, [number, number]> = {
    Tomonari: [6, -10],
    Yoshimitsu: [6, -10],
    Masamune: [-60, 12],
    Mitsutada: [6, -10],
    Masatsune: [6, 4],
    Kunimitsu: [6, -10],
    Sa: [6, -10],
    Nagamitsu: [-68, 8],
    Sadamune: [6, 4],
    Kunitoshi: [-62, 8],
    Kanemitsu: [6, 4],
    Somin: [6, -10],
    Kaneie: [6, 4],
    'Goto Sojo': [6, -10],
    'Goto Ichijo': [6, 4],
  };

  const [dx, dy] = offsets[payload.n] || [6, -8];

  return (
    <text
      x={x + dx}
      y={y + dy}
      fontSize={10}
      fill="var(--text-ink)"
      fontFamily="var(--font-serif, Georgia, serif)"
      fontStyle="italic"
    >
      {payload.n}
    </text>
  );
}

/* ─── Figure 1: Raw scatter ───────────────────────────────────────────── */

function Figure1() {
  const sword = useMemo(() => D.filter((p) => p.d === 's'), []);
  const tosogu = useMemo(() => D.filter((p) => p.d === 't'), []);

  return (
    <div>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle, #e5e5e5)"
          />
          <XAxis
            type="number"
            dataKey="ef"
            name="Elite Factor"
            domain={[0, 0.7]}
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
            domain={[1.5, 5.5]}
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
          <Scatter
            name="Swordsmiths"
            data={sword}
            fill={SWORD_COLOR}
            fillOpacity={0.5}
            r={3}
          >
            {sword.map((p, i) => (
              <Cell
                key={i}
                r={p.l ? 5 : 3}
                fillOpacity={p.l ? 0.9 : 0.35}
                stroke={p.l ? SWORD_COLOR : 'none'}
                strokeWidth={p.l ? 1 : 0}
              />
            ))}
          </Scatter>
          <Scatter
            name="Tosogu Artists"
            data={tosogu}
            fill={TOSOGU_COLOR}
            fillOpacity={0.5}
            r={3}
          >
            {tosogu.map((p, i) => (
              <Cell
                key={i}
                r={p.l ? 5 : 3}
                fillOpacity={p.l ? 0.9 : 0.4}
                stroke={p.l ? TOSOGU_COLOR : 'none'}
                strokeWidth={p.l ? 1 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: SWORD_COLOR }}
          />
          Swordsmiths (617)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: TOSOGU_COLOR }}
          />
          Tosogu Artists (70)
        </span>
      </div>
    </div>
  );
}

/* ─── Figure 2: Divergence ────────────────────────────────────────────── */

function Figure2() {
  // Only artisans with both metrics > 0 (295 points)
  const both = useMemo(() => D.filter((p) => p.ef > 0 && p.pf > 0), []);

  // Compute percentile ranks within this group
  const ranked = useMemo(() => {
    const byEf = [...both].sort((a, b) => a.ef - b.ef);
    const byPf = [...both].sort((a, b) => a.pf - b.pf);
    const n = both.length;
    const efRank = new Map(byEf.map((p, i) => [p, (i + 0.5) / n]));
    const pfRank = new Map(byPf.map((p, i) => [p, (i + 0.5) / n]));

    return both.map((p) => {
      const er = efRank.get(p)!;
      const pr = pfRank.get(p)!;
      const divergence = Math.abs(er - pr);
      return { ...p, er, pr, divergence };
    });
  }, [both]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 10 }}>
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
              if (
                !active ||
                !payload?.[0]?.payload
              )
                return null;
              const p = payload[0].payload as P & {
                er: number;
                pr: number;
                divergence: number;
              };
              return (
                <div className="bg-paper border border-border rounded-lg p-3 shadow-lg text-xs">
                  <p className="font-medium text-ink mb-1.5">{p.n}</p>
                  <div className="space-y-0.5 text-charcoal">
                    <p>
                      <span className="text-muted">Elite percentile:</span>{' '}
                      <span className="tabular-nums">
                        {Math.round(p.er * 100)}th
                      </span>
                    </p>
                    <p>
                      <span className="text-muted">Provenance percentile:</span>{' '}
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
              // Color by divergence: blue (concordant) → red (divergent)
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
      {/* Color legend */}
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
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────────────── */

export function MethodologyFigures() {
  return (
    <div className="space-y-12 mt-12 mb-8">
      {/* Figure 1 */}
      <figure>
        <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
          <Figure1 />
        </div>
        <figcaption className="mt-3 text-sm text-muted leading-relaxed">
          <strong className="text-charcoal">Figure 1.</strong> Elite factor
          versus provenance factor for 687 artisans with documented provenance.
          Each point represents one artisan; hover for details. Gray dots are
          swordsmiths, gold dots are tosogu artists. The vertical cluster at x =
          0 represents 392 artisans with provenance data but no elite
          designations. Notable artisans discussed in Parts III and IV are
          enlarged.
        </figcaption>
      </figure>

      {/* Figure 2 */}
      <figure>
        <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
          <Figure2 />
        </div>
        <figcaption className="mt-3 text-sm text-muted leading-relaxed">
          <strong className="text-charcoal">Figure 2.</strong> Percentile
          agreement between elite factor and provenance factor for 295 artisans
          with both metrics above zero. Each axis shows the artisan&apos;s rank
          within the group. Points on the dashed diagonal have identical
          percentile ranks on both metrics (perfect agreement). Points are
          colored from blue (concordant) to red (divergent) by the absolute
          difference between their two percentile ranks. The most instructive
          cases are artisans far from the diagonal — those whose elite status
          and provenance prestige tell meaningfully different stories.
        </figcaption>
      </figure>
    </div>
  );
}
