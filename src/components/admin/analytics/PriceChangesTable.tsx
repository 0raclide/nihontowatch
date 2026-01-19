'use client';

import React from 'react';
import type { PriceChangeRecord } from '@/types/analytics';
import { formatCurrency } from '@/lib/analytics/statistics';

/**
 * Props for the PriceChangesTable component
 */
interface PriceChangesTableProps {
  /** Array of price change records to display */
  changes: PriceChangeRecord[];
  /** Loading state - shows skeleton */
  loading?: boolean;
  /** Callback when a listing row is clicked */
  onViewListing?: (listingId: number) => void;
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  return 'Just now';
}

/**
 * Skeleton row for loading state
 */
function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="h-4 w-48 bg-linen rounded animate-shimmer" />
          <div className="h-3 w-24 bg-linen rounded animate-shimmer" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 bg-linen rounded animate-shimmer" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 bg-linen rounded animate-shimmer" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 bg-linen rounded animate-shimmer" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-14 bg-linen rounded animate-shimmer" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 bg-linen rounded animate-shimmer" />
      </td>
    </tr>
  );
}

/**
 * Arrow icon for price change direction
 */
function ChangeArrow({ direction }: { direction: 'up' | 'down' }) {
  if (direction === 'up') {
    return (
      <svg
        className="w-3 h-3 inline-block mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-3 h-3 inline-block mr-1"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

/**
 * Price changes table component.
 * Displays recent price changes with visual indicators for increases/decreases.
 *
 * Features:
 * - Table showing item, dealer, old price, new price, change %, and time
 * - Green/red color coding for price changes
 * - Click to view listing detail
 * - Skeleton loading state
 * - Empty state handling
 *
 * @example
 * ```tsx
 * <PriceChangesTable
 *   changes={priceChanges}
 *   onViewListing={(id) => router.push(`/listing/${id}`)}
 * />
 * ```
 */
export function PriceChangesTable({
  changes,
  loading = false,
  onViewListing,
}: PriceChangesTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">
                Dealer
              </th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
                Old Price
              </th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
                New Price
              </th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
                Change
              </th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!changes || changes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-linen rounded-lg border border-border border-dashed">
        <div className="text-center">
          <svg
            className="w-12 h-12 text-muted mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-muted text-sm">No price changes in this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">
              Item
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">
              Dealer
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
              Old Price
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
              New Price
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
              Change
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => {
            const isPriceIncrease = change.changePercent > 0;
            const isPriceDecrease = change.changePercent < 0;

            return (
              <tr
                key={`${change.listingId}-${change.detectedAt}`}
                className={`border-b border-border ${
                  onViewListing
                    ? 'cursor-pointer hover:bg-hover transition-colors'
                    : ''
                }`}
                onClick={() => onViewListing?.(change.listingId)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink truncate max-w-[200px]">
                      {change.title}
                    </p>
                    <p className="text-xs text-muted capitalize">
                      {change.itemType.replace(/_/g, ' ')}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-charcoal">{change.dealerName}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted tabular-nums line-through">
                    {formatCurrency(change.oldPrice, 'JPY', { compact: true })}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-ink tabular-nums">
                    {formatCurrency(change.newPrice, 'JPY', { compact: true })}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      isPriceDecrease
                        ? 'text-success' // Price drops are good for buyers
                        : isPriceIncrease
                        ? 'text-error' // Price increases are bad for buyers
                        : 'text-muted'
                    }`}
                  >
                    <ChangeArrow direction={isPriceIncrease ? 'up' : 'down'} />
                    {Math.abs(change.changePercent).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-muted">
                    {formatRelativeTime(change.detectedAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
