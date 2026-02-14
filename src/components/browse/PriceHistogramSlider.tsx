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
const HANDLE_SIZE = 10; // px — diameter of visible drag dot
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const TOUCH_SIZE = 44; // px — minimum touch target (Apple HIG / WCAG 2.5.8)
const TOUCH_OFFSET = (TOUCH_SIZE - HANDLE_SIZE) / 2; // 17px — centering offset
const TOUCH_TOP = MAX_BAR_HEIGHT - TOUCH_SIZE + HANDLE_RADIUS; // touch zone bottom aligns with handle bottom
const BAR_GAP = 6; // px — gap between bottom of bars and handle center line

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

/**
 * CSS `left` for the 44px touch zone, centered on the inset handle position.
 * At 0%: handle center at HANDLE_RADIUS from track edge.
 * At 100%: handle center at HANDLE_RADIUS from opposite edge.
 */
function touchLeft(pct: number): string {
  return `calc(${pct}% - ${(pct / 100) * HANDLE_SIZE + TOUCH_OFFSET}px)`;
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
    // Account for handle inset: usable range starts at HANDLE_RADIUS, ends at width - HANDLE_RADIUS
    const fraction = Math.max(0, Math.min(1,
      (clientX - rect.left - HANDLE_RADIUS) / (rect.width - HANDLE_SIZE)
    ));
    return Math.round(fraction * (visibleCountRef.current - 1));
  }, []);

  const handlePointerDown = useCallback((handle: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  // Tap-on-track: tap a histogram bar to jump the nearest handle
  const handleTrackTap = useCallback((e: React.PointerEvent) => {
    // Skip if a handle drag was just initiated (event bubbled from touch zone)
    if (draggingRef.current) return;
    const idx = getBucketFromPointer(e.clientX);
    const distToMin = Math.abs(idx - minIdxRef.current);
    const distToMax = Math.abs(idx - maxIdxRef.current);

    if (distToMin <= distToMax) {
      const clamped = Math.min(idx, maxIdxRef.current);
      setLocalMinIdx(clamped);
      minIdxRef.current = clamped;
      commitPriceChange(clamped, maxIdxRef.current);
    } else {
      const clamped = Math.max(idx, minIdxRef.current);
      setLocalMaxIdx(clamped);
      maxIdxRef.current = clamped;
      commitPriceChange(minIdxRef.current, clamped);
    }
  }, [getBucketFromPointer, commitPriceChange]);

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
      {/* Unified histogram + handles — single interactive track */}
      <div
        ref={trackRef}
        className="relative select-none touch-none cursor-pointer"
        style={{ height: `${MAX_BAR_HEIGHT + BAR_GAP + HANDLE_RADIUS}px` }}
        onPointerDown={handleTrackTap}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Bars — inset by HANDLE_RADIUS so bar edges align with handle center positions */}
        <div
          className="absolute top-0 flex items-end"
          style={{
            height: `${MAX_BAR_HEIGHT}px`,
            gap: '0.5px',
            left: `${HANDLE_RADIUS}px`,
            right: `${HANDLE_RADIUS}px`,
          }}
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

        {/* Min handle — 44px touch zone with visible 10px dot at bottom */}
        <div
          className="absolute z-10 cursor-grab active:cursor-grabbing"
          style={{
            width: `${TOUCH_SIZE}px`,
            height: `${TOUCH_SIZE}px`,
            top: `${TOUCH_TOP}px`,
            left: touchLeft(minPct),
          }}
          onPointerDown={handlePointerDown('min')}
        >
          <div
            className="absolute rounded-full bg-white pointer-events-none"
            style={{
              width: `${HANDLE_SIZE}px`,
              height: `${HANDLE_SIZE}px`,
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.1)',
            }}
          />
        </div>

        {/* Max handle — 44px touch zone with visible 10px dot at bottom */}
        <div
          className="absolute z-10 cursor-grab active:cursor-grabbing"
          style={{
            width: `${TOUCH_SIZE}px`,
            height: `${TOUCH_SIZE}px`,
            top: `${TOUCH_TOP}px`,
            left: touchLeft(maxPct),
          }}
          onPointerDown={handlePointerDown('max')}
        >
          <div
            className="absolute rounded-full bg-white pointer-events-none"
            style={{
              width: `${HANDLE_SIZE}px`,
              height: `${HANDLE_SIZE}px`,
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.1)',
            }}
          />
        </div>
      </div>

      {/* Range labels — inset to align with handle centers */}
      <div className="flex justify-between -mt-0.5" style={{ paddingLeft: `${HANDLE_RADIUS}px`, paddingRight: `${HANDLE_RADIUS}px` }}>
        <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/50 tabular-nums`}>
          {formatPrice(bucketIndexToPrice(localMinIdx), currency, exchangeRates)}
        </span>
        <span className={`${isB ? 'text-[9px]' : 'text-[10px]'} text-muted/50 tabular-nums`}>
          {localMaxIdx >= visibleBucketCount - 1
            ? `${formatPrice(bucketIndexToPrice(Math.min(localMaxIdx, BUCKET_COUNT - 1)), currency, exchangeRates)}+`
            : formatPrice(bucketIndexToPrice(localMaxIdx), currency, exchangeRates)}
        </span>
      </div>

    </div>
  );
}
