'use client';

import React from 'react';
import type { SearchTermData } from '@/hooks/useUserEngagement';

/**
 * Props for the SearchTermsTable component
 */
interface SearchTermsTableProps {
  /** Array of search term data with engagement metrics */
  searches: SearchTermData[];
  /** Loading state - shows skeleton rows */
  loading?: boolean;
}

/**
 * Get text color class based on CTR
 */
function getCTRColor(ctr: number): string {
  if (ctr >= 30) return 'text-green-500';
  if (ctr >= 10) return 'text-yellow-500';
  return 'text-red-500';
}

/**
 * Skeleton for table loading state
 */
function TableSkeleton() {
  const skeletonRows = [1, 2, 3, 4, 5];

  return (
    <div className="bg-cream rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-linen/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Term
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              Searches
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              Avg Results
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              CTR
            </th>
          </tr>
        </thead>
        <tbody>
          {skeletonRows.map((row) => (
            <tr key={row} className="border-b border-border/50">
              <td className="px-4 py-3">
                <div
                  className="h-4 w-6 bg-linen rounded animate-shimmer"
                  style={{ animationDelay: `${row * 0.1}s` }}
                />
              </td>
              <td className="px-4 py-3">
                <div
                  className="h-4 w-32 bg-linen rounded animate-shimmer"
                  style={{ animationDelay: `${row * 0.1}s` }}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div
                  className="h-4 w-12 bg-linen rounded animate-shimmer ml-auto"
                  style={{ animationDelay: `${row * 0.1}s` }}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div
                  className="h-4 w-10 bg-linen rounded animate-shimmer ml-auto"
                  style={{ animationDelay: `${row * 0.1}s` }}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div
                  className="h-4 w-14 bg-linen rounded animate-shimmer ml-auto"
                  style={{ animationDelay: `${row * 0.1}s` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Empty state when no data is available
 */
function EmptyState() {
  return (
    <div className="flex items-center justify-center bg-linen rounded-lg border border-border border-dashed py-12">
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-muted text-sm">No search data available</p>
      </div>
    </div>
  );
}

/**
 * Format number with compact notation
 */
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Search terms table showing popular search queries with engagement metrics.
 *
 * Features:
 * - Simple table with columns: #, Term, Searches, Avg Results, CTR
 * - Color-coded CTR: green (>=30%), yellow (>=10%), red (<10%)
 * - Loading skeleton rows
 * - Empty state handling
 * - Hover state on rows
 *
 * @example
 * ```tsx
 * <SearchTermsTable
 *   searches={searchesData.searches}
 *   loading={loading.searches}
 * />
 * ```
 */
export function SearchTermsTable({
  searches,
  loading = false,
}: SearchTermsTableProps) {
  if (loading) {
    return <TableSkeleton />;
  }

  if (!searches || searches.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="bg-cream rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-linen/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Term
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              Searches
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              Avg Results
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
              CTR
            </th>
          </tr>
        </thead>
        <tbody>
          {searches.map((search, index) => {
            const ctrColorClass = getCTRColor(search.clickThroughRate);

            return (
              <tr
                key={search.term}
                className="border-b border-border/50 last:border-b-0 hover:bg-linen/30 transition-colors"
              >
                {/* Rank */}
                <td className="px-4 py-3 text-sm text-muted">
                  {index + 1}
                </td>

                {/* Search term */}
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-ink">
                    {search.term}
                  </span>
                  {search.uniqueUsers > 0 && (
                    <span className="text-xs text-muted ml-2">
                      ({search.uniqueUsers} {search.uniqueUsers === 1 ? 'user' : 'users'})
                    </span>
                  )}
                </td>

                {/* Search count */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-serif text-ink tabular-nums">
                    {formatNumber(search.count)}
                  </span>
                </td>

                {/* Average result count */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted tabular-nums">
                    {search.avgResultCount.toFixed(1)}
                  </span>
                </td>

                {/* Click-through rate */}
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium tabular-nums ${ctrColorClass}`}>
                    {search.clickThroughRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer legend */}
      <div className="px-4 py-3 border-t border-border bg-linen/20">
        <div className="flex items-center gap-6 text-xs text-muted">
          <span>CTR: Click-through rate</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-green-500 font-medium">30%+</span>
              <span>Excellent</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-500 font-medium">10-30%</span>
              <span>Average</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-500 font-medium">&lt;10%</span>
              <span>Low</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
