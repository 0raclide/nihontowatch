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
  Cell,
  Label,
  LabelList,
} from 'recharts';
import { D_TT, D_FJ, type TT, type FJ } from './scatter-data';

/* ─── Colors ──────────────────────────────────────────────────────────── */

const DOT_COLOR = '#6B7280';
const LABEL_COLOR = '#92400E';

/* Fujishiro grade colors — warm gradient from low (muted) to high (gold) */
const FJ_COLORS: Record<number, string> = {
  1: '#9CA3AF', // Chu saku — gray
  2: '#78716C', // Chu-jo saku — warm gray
  3: '#B45309', // Jo saku — amber
  4: '#D97706', // Jo-jo saku — warm amber
  5: '#B8860B', // Sai-jo saku — gold
};

const FJ_LABELS: Record<number, string> = {
  1: 'Chu saku',
  2: 'Chu-jo saku',
  3: 'Jo saku',
  4: 'Jo-jo saku',
  5: 'Sai-jo saku',
};

/* ─── Toko Taikan Tooltip ─────────────────────────────────────────────── */

function TTTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TT }>;
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

/* ─── Fujishiro Tooltip ───────────────────────────────────────────────── */

function FJTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FJ }>;
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
          <span className="text-muted">Fujishiro:</span>{' '}
          {FJ_LABELS[p.fj]}
        </p>
      </div>
    </div>
  );
}

/* ─── TT label renderer ───────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTTLabel = (props: any) => {
  const { x, y, index } = props;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof index !== 'number') return null;
  const point = D_TT[index];
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

/* ─── FJ label renderer (per-era data subset) ─────────────────────────── */

function makeFJLabelRenderer(data: FJ[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const { x, y, index } = props;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof index !== 'number') return null;
    const point = data[index];
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
}

/* ─── Fujishiro scatter for one era ───────────────────────────────────── */

function FujishiroEraChart({
  era,
  data,
  figNum,
  efMax,
}: {
  era: string;
  data: FJ[];
  figNum: number;
  efMax: number;
}) {
  const renderLabel = useMemo(() => makeFJLabelRenderer(data), [data]);

  return (
    <figure className="mb-10">
      <h4 className="font-serif text-base text-ink mb-3">{era}</h4>
      <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart
            margin={{ top: 16, right: 24, bottom: 50, left: 10 }}
          >
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
            >
              <Label
                value="Elite Factor"
                position="bottom"
                offset={30}
                style={{
                  fontSize: 12,
                  fill: 'var(--text-charcoal)',
                  fontFamily: 'var(--font-serif, Georgia, serif)',
                }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="fj"
              name="Fujishiro"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tickFormatter={(v: number) => FJ_LABELS[v] || ''}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<FJTooltip />} />
            <Scatter data={data} fill={DOT_COLOR}>
              {data.map((p, i) => (
                <Cell
                  key={i}
                  r={p.l ? 6 : 4}
                  fill={FJ_COLORS[p.fj]}
                  fillOpacity={p.l ? 0.9 : 0.6}
                  stroke={p.l ? FJ_COLORS[p.fj] : 'none'}
                  strokeWidth={p.l ? 1.5 : 0}
                />
              ))}
              <LabelList dataKey="n" content={renderLabel} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-sm text-muted leading-relaxed">
        <strong className="text-charcoal">Figure {figNum}.</strong>{' '}
        Elite factor versus Fujishiro grade for {data.length} {era}-period
        swordsmiths. Dot color indicates Fujishiro grade. Hover for details.
      </figcaption>
    </figure>
  );
}

/* ─── Main export ─────────────────────────────────────────────────────── */

const ERA_ORDER = ['Heian', 'Kamakura', 'Nanbokucho', 'Muromachi'] as const;

export function MethodologyFigures() {
  const fjByEra = useMemo(() => {
    const map: Record<string, FJ[]> = {};
    for (const era of ERA_ORDER) {
      map[era] = D_FJ.filter((p) => p.era === era);
    }
    return map;
  }, []);

  const fjMaxEf = useMemo(
    () => Math.ceil(Math.max(...D_FJ.map((p) => p.ef)) * 5) / 5,
    []
  );

  return (
    <div className="space-y-14 mt-12 mb-8">
      {/* ─── EF vs Toko Taikan ──────────────────────────────────── */}
      <div>
        <h3 className="font-serif text-lg text-ink mb-2">
          Designation Factor vs Toko Taikan
        </h3>
        <p className="text-sm text-muted leading-relaxed mb-6">
          {D_TT.length} swordsmiths with both a non-zero designation factor and
          a Toko Taikan rating. Hover over any point for details.
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
                    value="Elite Factor"
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
                <Tooltip content={<TTTooltip />} />
                <Scatter data={D_TT} fill={DOT_COLOR}>
                  {D_TT.map((p, i) => (
                    <Cell
                      key={i}
                      r={p.l ? 5 : 3}
                      fill={DOT_COLOR}
                      fillOpacity={p.l ? 0.85 : 0.3}
                      stroke={p.l ? DOT_COLOR : 'none'}
                      strokeWidth={p.l ? 1 : 0}
                    />
                  ))}
                  <LabelList dataKey="n" content={renderTTLabel} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 text-sm text-muted leading-relaxed">
            <strong className="text-charcoal">Figure 1.</strong> Designation
            factor versus Toko Taikan rating for {D_TT.length} swordsmiths.
            The positive correlation reflects broad agreement between modern
            NBTHK designation patterns and Dr. Tokuno&apos;s traditional expert
            assessment. Divergences reveal where the two systems weight
            different qualities.
          </figcaption>
        </figure>
      </div>

      {/* ─── EF vs Fujishiro (by era) ───────────────────────────── */}
      <div>
        <h3 className="font-serif text-lg text-ink mb-2">
          Designation Factor vs Fujishiro Grade
        </h3>
        <p className="text-sm text-muted leading-relaxed mb-4">
          {D_FJ.length} swordsmiths across four periods, each with a non-zero
          designation factor and a Fujishiro rating. The five grades range from
          Chu saku (average) to Sai-jo saku (supreme).
        </p>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-8 text-xs text-muted">
          {[5, 4, 3, 2, 1].map((fj) => (
            <span key={fj} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: FJ_COLORS[fj] }}
              />
              {FJ_LABELS[fj]}
            </span>
          ))}
        </div>

        {ERA_ORDER.map((era, i) => (
          <FujishiroEraChart
            key={era}
            era={era}
            data={fjByEra[era]}
            figNum={i + 2}
            efMax={fjMaxEf}
          />
        ))}
      </div>
    </div>
  );
}
