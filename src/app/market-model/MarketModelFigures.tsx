'use client';

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Label,
} from 'recharts';

import {
  BLADE_BOX,
  TOSOGU_BOX,
  PRED_ACTUAL,
  MODEL_STATS,
  RESID_HIST,
  RESID_NORM,
  RESID_STATS,
  QQ_DATA,
  QQ_STATS,
  TT_PRICE,
  TT_LINES,
  NAG_PRICE,
  NAG_LINES,
  JP_INTL_HIST,
  JP_INTL_STATS,
  RESID_BOX,
  PRIVATE_HIST,
  PRIVATE_LINES,
  EF_PRICE,
  EF_LINES,
  BAND_TOKU,
  BAND_JUYO,
  BAND_ACTUAL_TOKU,
  BAND_ACTUAL_JUYO,
  type BoxStat,
  type SP,
  type SPx,
  type RegLine,
} from './chart-data';

/* ─── Cert color & label maps ──────────────────────────────────── */

const CERT_COLORS: Record<number, string> = {
  0: '#6B7280',
  3: '#6B8E23',
  4: '#8B4513',
  5: '#4169E1',
  6: '#7B2D8E',
};

const CERT_LABELS: Record<number, string> = {
  0: 'None/Reg',
  3: 'Hozon',
  4: 'TokuHozon',
  5: 'Juyo',
  6: 'Tokuju',
};

const CERT_ORDS = [0, 3, 4, 5, 6];

/* ─── Shared helpers ───────────────────────────────────────────── */

function fmtJpy(logPrice: number): string {
  const p = Math.pow(10, logPrice);
  if (p >= 1e9) return `¥${(p / 1e9).toFixed(1)}B`;
  if (p >= 1e6) return `¥${(p / 1e6).toFixed(1)}M`;
  if (p >= 1e3) return `¥${(p / 1e3).toFixed(0)}K`;
  return `¥${p.toFixed(0)}`;
}

function CertLegend({ certs }: { certs: number[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-4 text-xs text-muted">
      {certs.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: CERT_COLORS[c] }}
          />
          {CERT_LABELS[c]}
        </span>
      ))}
    </div>
  );
}

function Figure({
  num,
  caption,
  children,
}: {
  num: number;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="mb-14">
      <div className="border border-border-subtle rounded-lg p-4 bg-surface/30">
        {children}
      </div>
      <figcaption className="mt-3 text-sm text-muted leading-relaxed">
        <strong className="text-charcoal">Figure {num}.</strong> {caption}
      </figcaption>
    </figure>
  );
}

/* ─── Custom box-and-whisker SVG ───────────────────────────────── */

function BoxPlotChart({
  data,
  yDomain,
  yLabel,
  title,
}: {
  data: BoxStat[];
  yDomain: [number, number];
  yLabel: string;
  title: string;
}) {
  const W = 700;
  const H = 340;
  const pad = { top: 20, right: 70, bottom: 60, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const yScale = (v: number) =>
    pad.top + plotH * (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0]));
  const boxW = Math.min(60, plotW / data.length - 10);

  // Y-axis ticks
  const yTicks: number[] = [];
  for (let y = Math.ceil(yDomain[0]); y <= yDomain[1]; y += 0.5) yTicks.push(y);

  // JPY labels for right axis
  const jpyTicks = yTicks.filter((y) => Number.isInteger(y));

  return (
    <div>
      <h4 className="font-serif text-base text-ink mb-3">{title}</h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 380 }}>
        {/* Grid */}
        {yTicks.map((y) => (
          <line
            key={y}
            x1={pad.left}
            x2={W - pad.right}
            y1={yScale(y)}
            y2={yScale(y)}
            stroke="var(--border-subtle, #e5e5e5)"
            strokeDasharray="3 3"
          />
        ))}

        {/* Y axis labels (left) */}
        {yTicks.map((y) => (
          <text
            key={y}
            x={pad.left - 8}
            y={yScale(y) + 4}
            textAnchor="end"
            fontSize={10}
            fill="var(--text-muted, #999)"
          >
            {y.toFixed(1)}
          </text>
        ))}

        {/* Y axis label */}
        <text
          x={14}
          y={pad.top + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-charcoal, #555)"
          transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}
          fontFamily="var(--font-serif, Georgia, serif)"
        >
          {yLabel}
        </text>

        {/* JPY labels (right) */}
        {jpyTicks.map((y) => (
          <text
            key={y}
            x={W - pad.right + 8}
            y={yScale(y) + 4}
            textAnchor="start"
            fontSize={9}
            fill="var(--text-muted, #999)"
          >
            {fmtJpy(y)}
          </text>
        ))}

        {/* Boxes */}
        {data.map((d, i) => {
          const cx = pad.left + (plotW / data.length) * (i + 0.5);
          const half = boxW / 2;
          return (
            <g key={d.name}>
              {/* Whisker line */}
              <line
                x1={cx}
                x2={cx}
                y1={yScale(d.wh)}
                y2={yScale(d.wl)}
                stroke={d.color}
                strokeWidth={1.5}
              />
              {/* Whisker caps */}
              <line
                x1={cx - half * 0.4}
                x2={cx + half * 0.4}
                y1={yScale(d.wh)}
                y2={yScale(d.wh)}
                stroke={d.color}
                strokeWidth={1.5}
              />
              <line
                x1={cx - half * 0.4}
                x2={cx + half * 0.4}
                y1={yScale(d.wl)}
                y2={yScale(d.wl)}
                stroke={d.color}
                strokeWidth={1.5}
              />
              {/* IQR box */}
              <rect
                x={cx - half}
                y={yScale(d.q3)}
                width={boxW}
                height={yScale(d.q1) - yScale(d.q3)}
                fill={d.color}
                fillOpacity={0.35}
                stroke={d.color}
                strokeWidth={1.5}
                rx={3}
              />
              {/* Median line */}
              <line
                x1={cx - half}
                x2={cx + half}
                y1={yScale(d.med)}
                y2={yScale(d.med)}
                stroke={d.color}
                strokeWidth={2.5}
              />
              {/* X label */}
              <text
                x={cx}
                y={H - pad.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-ink, #333)"
                fontFamily="var(--font-serif, Georgia, serif)"
              >
                {d.name}
              </text>
              <text
                x={cx}
                y={H - pad.bottom + 30}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted, #999)"
              >
                (n={d.n.toLocaleString()})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Scatter tooltip ──────────────────────────────────────────── */

function ScatterTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: SP | SPx }>;
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg text-xs">
      <div className="space-y-0.5 text-charcoal">
        <p>
          <span className="text-muted">{xLabel}:</span>{' '}
          <span className="tabular-nums">{p.x}</span>
        </p>
        <p>
          <span className="text-muted">{yLabel}:</span>{' '}
          <span className="tabular-nums">
            {typeof p.y === 'number' ? `${p.y.toFixed(3)} (${fmtJpy(p.y)})` : p.y}
          </span>
        </p>
        <p>
          <span className="text-muted">Cert:</span>{' '}
          {CERT_LABELS[p.c] || `ord ${p.c}`}
        </p>
      </div>
    </div>
  );
}

/* ─── Multi-series scatter (shared) ────────────────────────────── */

function CertScatterChart({
  data,
  lines,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  height = 400,
}: {
  data: SP[];
  lines: RegLine[];
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const byCert = useMemo(() => {
    const map: Record<number, SP[]> = {};
    for (const c of CERT_ORDS) map[c] = [];
    for (const p of data) {
      if (map[p.c]) map[p.c].push(p);
    }
    return map;
  }, [data]);

  return (
    <>
      <CertLegend certs={CERT_ORDS.filter((c) => (byCert[c]?.length ?? 0) > 0)} />
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle, #e5e5e5)"
          />
          <XAxis
            type="number"
            dataKey="x"
            domain={xDomain}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
          >
            <Label
              value={xLabel}
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
            dataKey="y"
            domain={yDomain}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
          >
            <Label
              value={yLabel}
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
          <Tooltip
            content={<ScatterTooltip xLabel={xLabel} yLabel={yLabel} />}
          />
          {/* Regression lines (rendered as reference lines) */}
          {lines.map((l, i) => {
            // Approximate with start/end points — render as scatter with line
            const lineData = [
              { x: l.x1, y: l.y1 },
              { x: l.x2, y: l.y2 },
            ];
            return (
              <Scatter
                key={`line-${i}`}
                data={lineData}
                fill="none"
                line={{ stroke: l.color, strokeWidth: 2.5 }}
                legendType="none"
                isAnimationActive={false}
              >
                {lineData.map((_, j) => (
                  <Cell key={j} r={0} />
                ))}
              </Scatter>
            );
          })}
          {/* Data points by cert */}
          {CERT_ORDS.map((cert) => {
            const pts = byCert[cert];
            if (!pts || pts.length === 0) return null;
            return (
              <Scatter key={cert} data={pts} isAnimationActive={false}>
                {pts.map((_, i) => (
                  <Cell
                    key={i}
                    r={3}
                    fill={CERT_COLORS[cert]}
                    fillOpacity={0.4}
                  />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export function MarketModelFigures() {
  const predByCert = useMemo(() => {
    const scraped: Record<number, SPx[]> = {};
    const privSale: SPx[] = [];
    for (const c of CERT_ORDS) scraped[c] = [];
    for (const p of PRED_ACTUAL) {
      if (p.s === 1) privSale.push(p);
      else if (scraped[p.c]) scraped[p.c].push(p);
    }
    return { scraped, privSale };
  }, []);

  return (
    <div className="space-y-14 mt-12 mb-8">
      {/* ═══ 1. Price Ladder — Blades ═══ */}
      <Figure
        num={1}
        caption={`Price distribution by certification tier for ${BLADE_BOX.reduce((s, b) => s + b.n, 0).toLocaleString()} blade listings. Each box shows the interquartile range (IQR); whiskers extend to 1.5× IQR. The bold line marks the median. The clear step-wise pattern confirms the certification "ladder" — each tier roughly doubles or triples the price.`}
      >
        <BoxPlotChart
          data={BLADE_BOX}
          yDomain={[3.5, 9]}
          yLabel="log₁₀(Price JPY)"
          title="Price Ladder — Blades"
        />
      </Figure>

      {/* ═══ 2. Price Ladder — Tosogu ═══ */}
      <Figure
        num={2}
        caption={`Price distribution for ${TOSOGU_BOX.reduce((s, b) => s + b.n, 0).toLocaleString()} tosogu listings. The same ladder pattern holds, though with a lower price floor and fewer Juyo observations (n=${TOSOGU_BOX.find((b) => b.name === 'Juyo')?.n ?? '—'}).`}
      >
        <BoxPlotChart
          data={TOSOGU_BOX}
          yDomain={[3.5, 8]}
          yLabel="log₁₀(Price JPY)"
          title="Price Ladder — Tosogu"
        />
      </Figure>

      {/* ═══ 3. Predicted vs Actual ═══ */}
      <Figure
        num={3}
        caption={`Tier 2N model (cert + item + log TT + cert×TT + log nagasa + dealer origin). adj R² = ${MODEL_STATS.adjR2}, RMSE = ${MODEL_STATS.rmse}, ${MODEL_STATS.within2x}% of predictions within 2× of actual price. Green band shows the ±2× region. Red stars are private sale observations — they track the diagonal, confirming the model handles ultra-high-end data. n = ${MODEL_STATS.n.toLocaleString()}.`}
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Predicted vs Actual Price (Tier 2N)
        </h4>
        <CertLegend certs={CERT_ORDS} />
        <div className="flex flex-wrap justify-center gap-x-4 mb-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 text-red-500">★</span>
            Private sale
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-6 h-3 rounded"
              style={{ background: 'rgba(34,197,94,0.15)' }}
            />
            ±2× band
          </span>
        </div>
        <ResponsiveContainer width="100%" height={440}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={[4, 8.5]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Predicted log₁₀(Price)"
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
              dataKey="y"
              domain={[4, 8.5]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Actual log₁₀(Price)"
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
            <Tooltip
              content={
                <ScatterTooltip xLabel="Predicted" yLabel="Actual" />
              }
            />
            {/* Diagonal */}
            <ReferenceLine
              segment={[
                { x: 4, y: 4 },
                { x: 8.5, y: 8.5 },
              ]}
              stroke="var(--text-muted)"
              strokeDasharray="5 5"
              strokeWidth={1}
            />
            {/* ±2× band lines */}
            <ReferenceLine
              segment={[
                { x: 4, y: 4 + 0.301 },
                { x: 8.2, y: 8.5 },
              ]}
              stroke="rgba(34,197,94,0.3)"
              strokeWidth={1}
            />
            <ReferenceLine
              segment={[
                { x: 4.301, y: 4 },
                { x: 8.5, y: 8.2 },
              ]}
              stroke="rgba(34,197,94,0.3)"
              strokeWidth={1}
            />
            {/* Scraped points by cert */}
            {CERT_ORDS.map((cert) => {
              const pts = predByCert.scraped[cert];
              if (!pts || pts.length === 0) return null;
              return (
                <Scatter key={cert} data={pts} isAnimationActive={false}>
                  {pts.map((_, i) => (
                    <Cell
                      key={i}
                      r={3}
                      fill={CERT_COLORS[cert]}
                      fillOpacity={0.4}
                    />
                  ))}
                </Scatter>
              );
            })}
            {/* Private sale stars */}
            {predByCert.privSale.length > 0 && (
              <Scatter
                data={predByCert.privSale}
                isAnimationActive={false}
              >
                {predByCert.privSale.map((_, i) => (
                  <Cell
                    key={i}
                    r={6}
                    fill="#EF4444"
                    stroke="#000"
                    strokeWidth={0.5}
                  />
                ))}
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </Figure>

      {/* ═══ 4. Residual Histogram ═══ */}
      <Figure
        num={4}
        caption={`Distribution of Tier 2N residuals (actual − predicted in log₁₀ space). Red curve: fitted normal (μ=${RESID_STATS.mu}, σ=${RESID_STATS.sigma}). Skew=${RESID_STATS.skew}, kurtosis=${RESID_STATS.kurtosis}. The slight right skew and heavy tails are expected for price data — a few items sell far above the model prediction.`}
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Residual Distribution (Tier 2N)
        </h4>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={RESID_HIST}
            margin={{ top: 16, right: 24, bottom: 50, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[-1.2, 1.2]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Residual (log₁₀ scale)"
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
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Density"
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
            <ReferenceLine x={0} stroke="var(--text-ink)" strokeDasharray="5 5" />
            <Bar dataKey="y" fill="#6899C8" fillOpacity={0.7} isAnimationActive={false} />
            <Line
              data={RESID_NORM}
              dataKey="y"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Figure>

      {/* ═══ 5. QQ Plot ═══ */}
      <Figure
        num={5}
        caption={`Normal probability plot (QQ) of residuals. r = ${QQ_STATS.r} — near-perfect linearity except at extreme tails. The log-normal price assumption is well supported. Slight curvature at the upper tail indicates a few listings priced far above prediction (heavy right tail).`}
      >
        <h4 className="font-serif text-base text-ink mb-3">
          QQ Plot — Residual Normality
        </h4>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 50, left: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              type="number"
              dataKey="t"
              domain={[-3.5, 3.5]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Theoretical Quantiles"
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
              dataKey="s"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Sample Quantiles"
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
            {/* Reference line */}
            <ReferenceLine
              segment={[
                {
                  x: -3.5,
                  y: QQ_STATS.intercept + QQ_STATS.slope * -3.5,
                },
                {
                  x: 3.5,
                  y: QQ_STATS.intercept + QQ_STATS.slope * 3.5,
                },
              ]}
              stroke="#EF4444"
              strokeWidth={2}
            />
            <Scatter data={QQ_DATA} isAnimationActive={false}>
              {QQ_DATA.map((_, i) => (
                <Cell key={i} r={3} fill="#6899C8" fillOpacity={0.5} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Figure>

      {/* ═══ 6. TT vs Price by Cert ═══ */}
      <Figure
        num={6}
        caption="Toko Taikan rating versus price, colored by certification tier. The key interaction effect is visible: regression lines are nearly flat at Hozon (TT doesn't matter) but steepen dramatically at TokuHozon and Juyo. A TT=3000 smith commands 4× more at Juyo than at Hozon."
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Toko Taikan vs Price — The Interaction Effect
        </h4>
        <CertScatterChart
          data={TT_PRICE}
          lines={TT_LINES}
          xDomain={[0, 3600]}
          yDomain={[4, 9]}
          xLabel="Toko Taikan Rating"
          yLabel="log₁₀(Price JPY)"
          height={440}
        />
      </Figure>

      {/* ═══ 7. Elite Factor vs Price ═══ */}
      <Figure
        num={7}
        caption="Elite Factor versus price by cert tier. Same interaction pattern as Toko Taikan — flat at low cert, steep at high cert. EF captures designation-based prestige (Juyo/Tokuju counts) that historical reference books don't."
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Elite Factor vs Price by Cert Tier
        </h4>
        <CertScatterChart
          data={EF_PRICE}
          lines={EF_LINES}
          xDomain={[0, 2]}
          yDomain={[4, 9]}
          xLabel="Elite Factor"
          yLabel="log₁₀(Price JPY)"
        />
      </Figure>

      {/* ═══ 8. Nagasa vs Price ═══ */}
      <Figure
        num={8}
        caption="Blade length versus price by cert tier. At None/Reg and Hozon (gray, olive), the slope is steep — longer blades are worth substantially more. At TokuHozon and Juyo, the relationship flattens as certification and artisan reputation dominate."
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Blade Length vs Price by Cert Tier
        </h4>
        <CertScatterChart
          data={NAG_PRICE}
          lines={NAG_LINES}
          xDomain={[15, 110]}
          yDomain={[4, 8.5]}
          xLabel="Nagasa (cm)"
          yLabel="log₁₀(Price JPY)"
        />
      </Figure>

      {/* ═══ 9. JP vs International ═══ */}
      <Figure
        num={9}
        caption={`Price distributions for Japanese (n=${JP_INTL_STATS.jpN.toLocaleString()}, median ¥${(JP_INTL_STATS.jpMedian / 1e3).toFixed(0)}K) vs international dealers (n=${JP_INTL_STATS.intlN.toLocaleString()}, median ¥${(JP_INTL_STATS.intlMedian / 1e3).toFixed(0)}K). After controlling for cert, artisan, and type, the model finds Japanese dealers price ~33–39% lower than international.`}
      >
        <h4 className="font-serif text-base text-ink mb-3">
          JP vs International Pricing (Blades)
        </h4>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: '#E74C3C' }}
            />
            JP dealers
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: '#3498DB' }}
            />
            International
          </span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={JP_INTL_HIST}
            margin={{ top: 16, right: 24, bottom: 50, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[3.5, 9]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="log₁₀(Price JPY)"
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
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Density"
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
            <Bar
              dataKey="jp"
              fill="#E74C3C"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            <Bar
              dataKey="intl"
              fill="#3498DB"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Figure>

      {/* ═══ 10. Private Sales vs Scraped ═══ */}
      <Figure
        num={10}
        caption={`Scraped blade price distribution (blue bars) with ${PRIVATE_LINES.length} private sale observations overlaid as red lines. The private data fills the extreme right tail (¥10M–200M) where scraped data barely exists — critical for training the model on high-end transactions.`}
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Private Sales vs Scraped Distribution
        </h4>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={PRIVATE_HIST}
            margin={{ top: 16, right: 24, bottom: 50, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[3.5, 9]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="log₁₀(Price JPY)"
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
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Density"
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
            <Bar
              dataKey="y"
              fill="#6899C8"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            {/* Private sale lines */}
            {PRIVATE_LINES.map((lp, i) => (
              <ReferenceLine
                key={i}
                x={lp}
                stroke="#EF4444"
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Figure>

      {/* ═══ 11. Residual by Cert (Heteroscedasticity) ═══ */}
      <Figure
        num={11}
        caption="Residual spread by cert tier (universal blade model). The boxes visibly widen from left to right — residual variance increases at higher cert tiers. This 7.1× variance ratio (down from 18× pre-fusion, stabilized by 800+ additional Juyo/Tokuju observations) proves that fixed-width confidence intervals would be meaningless. Quantile regression produces bands that naturally widen at higher tiers."
      >
        <BoxPlotChart
          data={RESID_BOX}
          yDomain={[-2, 2.5]}
          yLabel="Residual (log₁₀)"
          title="Residual Spread by Cert Tier"
        />
      </Figure>

      {/* ═══ 12. Quantile Price Bands ═══ */}
      <Figure
        num={12}
        caption="Quantile price bands for a 70cm katana from a Japanese dealer. Shaded regions show P10–P90 (outer) and P25–P75 (inner) from quantile regression. Solid line = median prediction. Small dots = actual observations. The Juyo band is naturally wider than TokuHozon, reflecting the market's greater price variance at elite certification levels."
      >
        <h4 className="font-serif text-base text-ink mb-3">
          Quantile Price Bands (Katana, 70cm, JP Dealer)
        </h4>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-3 rounded"
              style={{ background: CERT_COLORS[4], opacity: 0.3 }}
            />
            TokuHozon
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-3 rounded"
              style={{ background: CERT_COLORS[5], opacity: 0.3 }}
            />
            Juyo
          </span>
        </div>
        <ResponsiveContainer width="100%" height={440}>
          <ComposedChart margin={{ top: 16, right: 24, bottom: 50, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle, #e5e5e5)"
            />
            <XAxis
              dataKey="tt"
              type="number"
              domain={[400, 3200]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
            >
              <Label
                value="Toko Taikan Rating"
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
              scale="log"
              domain={[0.3, 120]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1 ? `¥${v.toFixed(0)}M` : `¥${(v * 1000).toFixed(0)}K`
              }
            >
              <Label
                value="Price (¥ millions)"
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
            <Tooltip
              formatter={(v: number | undefined) => {
                if (v == null) return '';
                return v >= 1 ? `¥${v.toFixed(1)}M` : `¥${(v * 1000).toFixed(0)}K`;
              }}
            />

            {/* TokuHozon bands */}
            <Area
              data={BAND_TOKU}
              dataKey="p90"
              stroke="none"
              fill={CERT_COLORS[4]}
              fillOpacity={0.1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_TOKU}
              dataKey="p10"
              stroke="none"
              fill="#FFFBF0"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_TOKU}
              dataKey="p75"
              stroke="none"
              fill={CERT_COLORS[4]}
              fillOpacity={0.2}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_TOKU}
              dataKey="p25"
              stroke="none"
              fill="#FFFBF0"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              data={BAND_TOKU}
              dataKey="p50"
              stroke={CERT_COLORS[4]}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Juyo bands */}
            <Area
              data={BAND_JUYO}
              dataKey="p90"
              stroke="none"
              fill={CERT_COLORS[5]}
              fillOpacity={0.1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_JUYO}
              dataKey="p10"
              stroke="none"
              fill="#FFFBF0"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_JUYO}
              dataKey="p75"
              stroke="none"
              fill={CERT_COLORS[5]}
              fillOpacity={0.2}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              data={BAND_JUYO}
              dataKey="p25"
              stroke="none"
              fill="#FFFBF0"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              data={BAND_JUYO}
              dataKey="p50"
              stroke={CERT_COLORS[5]}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Actual data dots — TokuHozon */}
            <Scatter
              data={BAND_ACTUAL_TOKU.map((d) => ({
                tt: d.tt,
                price: d.price,
              }))}
              dataKey="price"
              isAnimationActive={false}
            >
              {BAND_ACTUAL_TOKU.map((_, i) => (
                <Cell
                  key={i}
                  r={3}
                  fill={CERT_COLORS[4]}
                  fillOpacity={0.3}
                />
              ))}
            </Scatter>

            {/* Actual data dots — Juyo */}
            <Scatter
              data={BAND_ACTUAL_JUYO.map((d) => ({
                tt: d.tt,
                price: d.price,
              }))}
              dataKey="price"
              isAnimationActive={false}
            >
              {BAND_ACTUAL_JUYO.map((_, i) => (
                <Cell
                  key={i}
                  r={3}
                  fill={CERT_COLORS[5]}
                  fillOpacity={0.3}
                />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </Figure>
    </div>
  );
}
