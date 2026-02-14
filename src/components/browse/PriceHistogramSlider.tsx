'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PRICE_HISTOGRAM } from '@/lib/constants';
import { convertPrice, type ExchangeRates, type Currency } from '@/hooks/useCurrency';
import type { SidebarVariant } from './FilterContent';

export interface PriceHistogramData {
  buckets: { idx: number; count: number }[];
  boundaries: number[];
  totalPriced: number;
  maxPrice: number;
}

interface PriceHistogramSliderProps {
  histogram: PriceHistogramData | null;
  priceMin?: number;
  priceMax?: number;
  onPriceChange: (min: number | undefined, max: number | undefined) => void;
  variant?: SidebarVariant;
  currency?: Currency;
  exchangeRates?: ExchangeRates | null;
}

const { BOUNDARIES, MAX_BAR_HEIGHT, MIN_BAR_HEIGHT, DEBOUNCE_MS } = PRICE_HISTOGRAM;
const BUCKET_COUNT = BOUNDARIES.length;
const HANDLE_SIZE = 14; // px — diameter of drag handles
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const BAR_GAP = 4; // px — gap between bottom of bars and handle center line

/** Format price value as compact label, currency-aware */
function formatPrice(jpyValue: number, currency?: Currency, rates?: ExchangeRates | null): string {
  if (!currency || currency === 'JPY' || !rates) {
    if (jpyValue >= 10_000_000) return `¥${(jpyValue / 1_000_000).toFixed(0)}M`;
    if (jpyValue >= 1_000_000) return `¥${(jpyValue / 1_000_000).toFixed(jpyValue % 1_000_000 === 0 ? 0 : 1)}M`;
    return `¥${(jpyValue / 1_000).toFixed(0)}K`;
  }

  const converted = convertPrice(jpyValue, 'JPY', currency, rates);
  const symbol = currency === 'USD' ? '$' : '€';

  if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(converted % 1_000_000 === 0 ? 0 : 1)}M`;
  if (converted >= 1_000) return `${symbol}${(converted / 1_000).toFixed(converted % 1_000 < 100 ? 0 : 1)}K`;
  return `${symbol}${converted.toFixed(0)}`;
}

/** Find the closest bucket index for a JPY value */
function priceToBucketIndex(price: number): number {
  for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
    if (price >= BOUNDARIES[i]) return i;
  }
  return 0;
}

/** Convert bucket index to JPY boundary value */
function bucketIndexToPrice(index: number): number {
  return BOUNDARIES[Math.max(0, Math.min(index, BUCKET_COUNT - 1))];
}

export function PriceHistogramSlider({
  histogram,
  priceMin,
  priceMax,
  onPriceChange,
  variant,
  currency,
  exchangeRates,
}: PriceHistogramSliderProps) {
  const isB = variant === 'b';

  // Build full bucket array with counts (sparse → dense)
  const bucketCounts = useMemo(() => {
    const counts = new Array(BUCKET_COUNT).fill(0);
    if (histogram?.buckets) {
      for (const b of histogram.buckets) {
        if (b.idx >= 0 && b.idx < BUCKET_COUNT) {
          counts[b.idx] = b.count;
        }
      }
    }
    return counts;
  }, [histogram]);

  // Trim trailing empty buckets based on maxPrice
  const visibleBucketCount = useMemo(() => {
    if (!histogram || histogram.maxPrice <= 0) return BUCKET_COUNT;
    const maxIdx = priceToBucketIndex(histogram.maxPrice);
    return Math.min(BUCKET_COUNT, maxIdx + 2);
  }, [histogram]);

  const maxCount = useMemo(() => Math.max(...bucketCounts), [bucketCounts]);

  // Local state for handle positions (bucket indices)
  const [localMinIdx, setLocalMinIdx] = useState<number>(0);
  const [localMaxIdx, setLocalMaxIdx] = useState<number>(BUCKET_COUNT - 1);

  // Refs for stable drag callbacks
  const minIdxRef = useRef(localMinIdx);
  const maxIdxRef = useRef(localMaxIdx);
  const visibleCountRef = useRef(visibleBucketCount);
  const onPriceChangeRef = useRef(onPriceChange);

  useEffect(() => { minIdxRef.current = localMinIdx; }, [localMinIdx]);
  useEffect(() => { maxIdxRef.current = localMaxIdx; }, [localMaxIdx]);
  useEffect(() => { visibleCountRef.current = visibleBucketCount; }, [visibleBucketCount]);
  useEffect(() => { onPriceChangeRef.current = onPriceChange; }, [onPriceChange]);

  // Sync local state from external props
  useEffect(() => {
    const idx = priceMin ? priceToBucketIndex(priceMin) : 0;
    setLocalMinIdx(idx);
    minIdxRef.current = idx;
  }, [priceMin]);

  useEffect(() => {
    const idx = priceMax ? priceToBucketIndex(priceMax) : visibleBucketCount - 1;
    setLocalMaxIdx(idx);
    maxIdxRef.current = idx;
  }, [priceMax, visibleBucketCount]);

  // Debounced commit
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitPriceChange = useCallback((minIdx: number, maxIdx: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const vc = visibleCountRef.current;
      const newMin = minIdx > 0 ? bucketIndexToPrice(minIdx) : undefined;
      const newMax = maxIdx < vc - 1 ? bucketIndexToPrice(maxIdx + 1) : undefined;
      onPriceChangeRef.current(newMin, newMax);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Drag state
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'min' | 'max' | null>(null);

  const getBucketFromPointer = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(fraction * (visibleCountRef.current - 1));
  }, []);

  const handlePointerDown = useCallback((handle: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = handle;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const idx = getBucketFromPointer(e.clientX);

    if (draggingRef.current === 'min') {
      const clamped = Math.min(idx, maxIdxRef.current);
      setLocalMinIdx(clamped);
      minIdxRef.current = clamped;
    } else {
      const clamped = Math.max(idx, minIdxRef.current);
      setLocalMaxIdx(clamped);
      maxIdxRef.current = clamped;
    }
  }, [getBucketFromPointer]);

  const handlePointerUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = null;
      commitPriceChange(minIdxRef.current, maxIdxRef.current);
    }
  }, [commitPriceChange]);

  // Text input handlers
  const handleMinInputChange = useCallback((value: string) => {
    const num = value ? Number(value) : undefined;
    if (num !== undefined && !isNaN(num)) {
      const idx = priceToBucketIndex(num);
      setLocalMinIdx(idx);
      minIdxRef.current = idx;
      commitPriceChange(idx, maxIdxRef.current);
    } else if (!value) {
      setLocalMinIdx(0);
      minIdxRef.current = 0;
      commitPriceChange(0, maxIdxRef.current);
    }
  }, [commitPriceChange]);

  const handleMaxInputChange = useCallback((value: string) => {
    const num = value ? Number(value) : undefined;
    if (num !== undefined && !isNaN(num)) {
      const idx = priceToBucketIndex(num);
      setLocalMaxIdx(idx);
      maxIdxRef.current = idx;
      commitPriceChange(minIdxRef.current, idx);
    } else if (!value) {
      const vc = visibleCountRef.current;
      setLocalMaxIdx(vc - 1);
      maxIdxRef.current = vc - 1;
      commitPriceChange(minIdxRef.current, vc - 1);
    }
  }, [commitPriceChange]);

  // Loading skeleton
  if (!histogram) {
    return (
      <div>
        <div className="flex items-end h-[48px]" style={{ gap: '0.5px' }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-border/10 rounded-t-[1px] animate-pulse"
              style={{ height: `${4 + Math.random() * 38}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // No priced items
  if (histogram.totalPriced === 0) {
    return (
      <p className={`${isB ? 'text-[11px]' : 'text-[12px]'} text-muted italic py-2`}>
        No priced items
      </p>
    );
  }

  // Handle positions as percentages
  const minPct = visibleBucketCount > 1 ? (localMinIdx / (visibleBucketCount - 1)) * 100 : 0;
  const maxPct = visibleBucketCount > 1 ? (localMaxIdx / (visibleBucketCount - 1)) * 100 : 100;

  return (
    <div className="space-y-2">
      {/* Unified histogram + handles — single interactive element */}
      <div
        ref={trackRef}
        className="relative select-none touch-none cursor-pointer"
        style={{ height: `${MAX_BAR_HEIGHT + BAR_GAP + HANDLE_RADIUS}px` }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Bars — continuous silhouette, stop above the handle line */}
        <div
          className="absolute inset-x-0 top-0 flex items-end"
          style={{ height: `${MAX_BAR_HEIGHT}px`, gap: '0.5px' }}
        >
          {bucketCounts.slice(0, visibleBucketCount).map((count, i) => {
            const inRange = i >= localMinIdx && i <= localMaxIdx;
            const barMax = MAX_BAR_HEIGHT - BAR_GAP; // bars never reach the baseline
            const height = count > 0 && maxCount > 0
              ? Math.max(MIN_BAR_HEIGHT, (count / maxCount) * barMax)
              : 0;

            return (
              <div
                key={i}
                className={`flex-1 rounded-t-[1px] transition-colors duration-100 ${
                  count === 0
                    ? ''
                    : inRange
                      ? 'bg-gold/35'
                      : 'bg-border/10'
                }`}
                style={{ height: count > 0 ? `${height}px` : '0px' }}
                title={count > 0 ? `${formatPrice(BOUNDARIES[i], currency, exchangeRates)}: ${count} items` : undefined}
              />
            );
          })}
        </div>

        {/* Handle center line — positioned below bars with BAR_GAP clearance */}
        {/* Baseline — thin full-width line */}
        <div
          className="absolute inset-x-0 h-px bg-border/8"
          style={{ top: `${MAX_BAR_HEIGHT + BAR_GAP}px` }}
        />

        {/* Active range line — accent between handles */}
        <div
          className="absolute h-[1.5px] bg-gold/40 rounded-full"
          style={{
            top: `${MAX_BAR_HEIGHT + BAR_GAP - 0.25}px`,
            left: `${minPct}%`,
            right: `${100 - maxPct}%`,
          }}
        />

        {/* Min handle — white circle, centered on baseline */}
        <div
          className="absolute rounded-full bg-white cursor-grab active:cursor-grabbing z-10"
          style={{
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            top: `${MAX_BAR_HEIGHT + BAR_GAP - HANDLE_RADIUS}px`,
            left: `${minPct}%`,
            transform: 'translateX(-50%)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.1)',
          }}
          onPointerDown={handlePointerDown('min')}
        />

        {/* Max handle — white circle, centered on baseline */}
        <div
          className="absolute rounded-full bg-white cursor-grab active:cursor-grabbing z-10"
          style={{
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            top: `${MAX_BAR_HEIGHT + BAR_GAP - HANDLE_RADIUS}px`,
            left: `${maxPct}%`,
            transform: 'translateX(-50%)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.1)',
          }}
          onPointerDown={handlePointerDown('max')}
        />
      </div>

      {/* Range labels */}
      <div className="flex justify-between -mt-0.5">
        <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/50 tabular-nums`}>
          {formatPrice(bucketIndexToPrice(localMinIdx), currency, exchangeRates)}
        </span>
        <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/50 tabular-nums`}>
          {localMaxIdx >= visibleBucketCount - 1
            ? `${formatPrice(bucketIndexToPrice(Math.min(localMaxIdx, BUCKET_COUNT - 1)), currency, exchangeRates)}+`
            : formatPrice(bucketIndexToPrice(localMaxIdx), currency, exchangeRates)}
        </span>
      </div>

      {/* Min/Max text inputs */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={priceMin ?? ''}
          onChange={(e) => handleMinInputChange(e.target.value)}
          className={`w-full ${isB ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'} rounded-md border border-border/20 bg-transparent text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <span className="text-muted/30 text-[10px] shrink-0">&ndash;</span>
        <input
          type="number"
          placeholder="Max"
          value={priceMax ?? ''}
          onChange={(e) => handleMaxInputChange(e.target.value)}
          className={`w-full ${isB ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'} rounded-md border border-border/20 bg-transparent text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
      </div>
    </div>
  );
}
