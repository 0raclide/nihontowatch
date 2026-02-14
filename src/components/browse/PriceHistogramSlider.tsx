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

/** Format price value as compact label, currency-aware */
function formatPrice(jpyValue: number, currency?: Currency, rates?: ExchangeRates | null): string {
  if (!currency || currency === 'JPY' || !rates) {
    if (jpyValue >= 10_000_000) return `¥${(jpyValue / 1_000_000).toFixed(0)}M`;
    if (jpyValue >= 1_000_000) return `¥${(jpyValue / 1_000_000).toFixed(jpyValue % 1_000_000 === 0 ? 0 : 1)}M`;
    return `¥${(jpyValue / 1_000).toFixed(0)}K`;
  }

  const converted = convertPrice(jpyValue, 'JPY', currency, rates);
  const symbol = currency === 'USD' ? '$' : '€';

  if (currency === 'USD' || currency === 'EUR') {
    if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(converted % 1_000_000 === 0 ? 0 : 1)}M`;
    if (converted >= 1_000) return `${symbol}${(converted / 1_000).toFixed(converted % 1_000 < 100 ? 0 : 1)}K`;
    return `${symbol}${converted.toFixed(0)}`;
  }

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
    // Show at least up to the bucket containing maxPrice + 1 more for context
    return Math.min(BUCKET_COUNT, maxIdx + 2);
  }, [histogram]);

  const maxCount = useMemo(() => Math.max(...bucketCounts), [bucketCounts]);

  // Local state for handle positions (bucket indices) — drives render
  const [localMinIdx, setLocalMinIdx] = useState<number>(0);
  const [localMaxIdx, setLocalMaxIdx] = useState<number>(BUCKET_COUNT - 1);

  // Refs that mirror state — read by stable drag callbacks without deps
  const minIdxRef = useRef(localMinIdx);
  const maxIdxRef = useRef(localMaxIdx);
  const visibleCountRef = useRef(visibleBucketCount);
  const onPriceChangeRef = useRef(onPriceChange);

  // Keep refs in sync
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

  // Debounced commit to parent
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitPriceChange = useCallback((minIdx: number, maxIdx: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const vc = visibleCountRef.current;
      const newMin = minIdx > 0 ? bucketIndexToPrice(minIdx) : undefined;
      const newMax = maxIdx < vc - 1 ? bucketIndexToPrice(maxIdx + 1) : undefined;
      onPriceChangeRef.current(newMin, newMax);
    }, DEBOUNCE_MS);
  }, []); // stable — reads from refs

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Drag state
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'min' | 'max' | null>(null);

  // Stable — reads visibleBucketCount from ref
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

  // Stable — reads indices from refs, writes to state for render
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

  // Stable — reads indices from refs
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
      <div className="space-y-2">
        <div className="flex items-end gap-[1px] h-[48px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-border/15 rounded-t-sm animate-pulse"
              style={{ height: `${6 + Math.random() * 36}px` }}
            />
          ))}
        </div>
        <div className="h-1.5 bg-border/10 rounded-full animate-pulse" />
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

  // Compute handle positions as percentages
  const minPct = visibleBucketCount > 1 ? (localMinIdx / (visibleBucketCount - 1)) * 100 : 0;
  const maxPct = visibleBucketCount > 1 ? (localMaxIdx / (visibleBucketCount - 1)) * 100 : 100;

  return (
    <div className="space-y-2">
      {/* Histogram bars + slider track */}
      <div
        className="relative select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Bars */}
        <div className="flex items-end gap-px" style={{ height: `${MAX_BAR_HEIGHT}px` }}>
          {bucketCounts.slice(0, visibleBucketCount).map((count, i) => {
            const inRange = i >= localMinIdx && i <= localMaxIdx;
            const height = count > 0 && maxCount > 0
              ? Math.max(MIN_BAR_HEIGHT, (count / maxCount) * MAX_BAR_HEIGHT)
              : 0;

            return (
              <div
                key={i}
                className={`flex-1 rounded-t-[2px] transition-colors duration-150 ${
                  count === 0
                    ? ''
                    : inRange
                      ? 'bg-gold/40'
                      : 'bg-border/15'
                }`}
                style={{ height: count > 0 ? `${height}px` : '0px' }}
                title={count > 0 ? `${formatPrice(BOUNDARIES[i], currency, exchangeRates)}: ${count} items` : undefined}
              />
            );
          })}
        </div>

        {/* Spacer between bars and slider */}
        <div className="h-2" />

        {/* Slider track */}
        <div ref={trackRef} className="relative h-3">
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-border/15 rounded-full" />

          {/* Active range highlight */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-gold/40 rounded-full"
            style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
          />

          {/* Min handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-[1.5px] border-gold/70 bg-surface cursor-grab active:cursor-grabbing z-10 hover:border-gold hover:scale-110 transition-transform"
            style={{ left: `${minPct}%`, transform: 'translate(-50%, -50%)' }}
            onPointerDown={handlePointerDown('min')}
          />

          {/* Max handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-[1.5px] border-gold/70 bg-surface cursor-grab active:cursor-grabbing z-10 hover:border-gold hover:scale-110 transition-transform"
            style={{ left: `${maxPct}%`, transform: 'translate(-50%, -50%)' }}
            onPointerDown={handlePointerDown('max')}
          />
        </div>

        {/* Range labels */}
        <div className="flex justify-between mt-0.5">
          <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/60 tabular-nums`}>
            {formatPrice(bucketIndexToPrice(localMinIdx), currency, exchangeRates)}
          </span>
          <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/60 tabular-nums`}>
            {localMaxIdx >= visibleBucketCount - 1
              ? `${formatPrice(bucketIndexToPrice(Math.min(localMaxIdx, BUCKET_COUNT - 1)), currency, exchangeRates)}+`
              : formatPrice(bucketIndexToPrice(localMaxIdx), currency, exchangeRates)}
          </span>
        </div>
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
        <span className="text-muted/40 text-[10px] shrink-0">&ndash;</span>
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
