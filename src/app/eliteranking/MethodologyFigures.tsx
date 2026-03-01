'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
  LabelList,
} from 'recharts';
import { D, type P } from './scatter-data';

/* ─── Colors ──────────────────────────────────────────────────────────── */

const DOT_COLOR = '#6B7280';
const LABEL_COLOR = '#92400E';

/* ─── Tooltip ─────────────────────────────────────────────────────────── */

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
          <span className="text-muted">Toko Taikan:</span>{' '}
          <span className="tabular-nums">{p.tt.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Custom label renderer for notable artisans ──────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderLabel = (props: any) => {
  const { x, y, index } = props;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof index !== 'number') return null;
  const point = D[index];
  if (!point?.l) return null;
  return (
    <text
      x={x + 8}
      y={y - 6}
      fontSize={10}
      fill={LABEL_COLOR}
      fontFamily="var(--font-serif, Georgia, serif)"
    >
      {point.n}
    </text>
  );
};

/* ─── Main export ─────────────────────────────────────────────────────── */

export function MethodologyFigures() {
  return (
    <div className="space-y-6 mt-12 mb-8">
      <h3 className="font-serif text-lg text-ink mb-2">
        Designation Factor vs Toko Taikan Rating
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-6">
        {D.length} swordsmiths with both a non-zero designation factor and a
        Toko Taikan rating. Hover over any point for details. Notable artisans
        are labeled.
      </p>

      <figure>
        <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
          <ResponsiveContainer width="100%" height={460}>
            <ScatterChart
              margin={{ top: 20, right: 30, bottom: 60, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-subtle, #e5e5e5)"
              />
              <XAxis
                type="number"
                dataKey="tt"
                name="Toko Taikan"
                domain={[0, 3600]}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
              >
                <Label
                  value="Toko Taikan Rating"
                  position="bottom"
                  offset={35}
                  style={{
                    fontSize: 12,
                    fill: 'var(--text-charcoal)',
                    fontFamily: 'var(--font-serif, Georgia, serif)',
                  }}
                />
              </XAxis>
              <YAxis
                type="number"
                dataKey="ef"
                name="Elite Factor"
                domain={[0, 2.0]}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
              >
                <Label
                  value="Elite Factor (Designation Factor)"
                  angle={-90}
                  position="insideLeft"
                  offset={5}
                  style={{
                    fontSize: 12,
                    fill: 'var(--text-charcoal)',
                    fontFamily: 'var(--font-serif, Georgia, serif)',
                  }}
                />
              </YAxis>
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={D} fill={DOT_COLOR}>
                {D.map((p, i) => (
                  <Cell
                    key={i}
                    r={p.l ? 5 : 3}
                    fill={DOT_COLOR}
                    fillOpacity={p.l ? 0.85 : 0.3}
                    stroke={p.l ? DOT_COLOR : 'none'}
                    strokeWidth={p.l ? 1 : 0}
                  />
                ))}
                <LabelList dataKey="n" content={renderLabel} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="mt-3 text-sm text-muted leading-relaxed">
          <strong className="text-charcoal">Figure 1.</strong> Designation
          factor (elite factor) versus Toko Taikan rating for {D.length}{' '}
          swordsmiths. The Toko Taikan — Dr. Tokuno&apos;s comprehensive rating
          of Japanese swordsmiths — uses a scale from approximately 200 to 3,500.
          Higher values on both axes indicate greater artisan stature. The
          positive correlation reflects broad agreement between modern NBTHK
          designation patterns and traditional expert assessment, while
          individual divergences reveal cases where the two systems weight
          different qualities.
        </figcaption>
      </figure>
    </div>
  );
}
