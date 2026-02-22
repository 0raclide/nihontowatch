'use client';

import { useState } from 'react';
import { MetricCard } from '@/components/admin/analytics/MetricCard';
import { RetentionHeatmap } from '@/components/admin/analytics/RetentionHeatmap';
import { SegmentBreakdownChart } from '@/components/admin/analytics/SegmentBreakdownChart';
import { SegmentDetailTable } from '@/components/admin/analytics/SegmentDetailTable';
import { DeviceBreakdownChart } from '@/components/admin/analytics/DeviceBreakdownChart';
import { useRetentionAnalytics, type CohortMode } from '@/hooks/useRetentionAnalytics';

type TimeRange = '7d' | '30d' | '90d';

export default function RetentionPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  const [cohortMode, setCohortMode] = useState<CohortMode>('visitors');

  const { cohorts, segments, loading, errors } = useRetentionAnalytics({
    period: timeRange,
    cohortMode,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Retention & Segmentation</h1>
          <p className="text-muted text-sm mt-1">
            Cohort retention and visitor behavioral segments
          </p>
        </div>
        <div className="flex gap-1 bg-cream rounded-lg p-1 border border-border">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-gold text-white'
                  : 'text-charcoal hover:bg-linen'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {(errors.cohorts || errors.segments) && (
        <div className="bg-error/10 text-error rounded-lg p-4">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm mt-1">{errors.cohorts || errors.segments}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Avg W0 Retention"
          value={cohorts?.summary.avgW0 ?? 0}
          format="percent"
          subtitle="First week"
          loading={loading.cohorts}
        />
        <MetricCard
          title="Avg W1 Retention"
          value={cohorts?.summary.avgW1 ?? 0}
          format="percent"
          subtitle="Second week"
          loading={loading.cohorts}
        />
        <MetricCard
          title="Avg W4 Retention"
          value={cohorts?.summary.avgW4 ?? 0}
          format="percent"
          subtitle="Fifth week"
          loading={loading.cohorts}
        />
        <MetricCard
          title="Cohorts Tracked"
          value={cohorts?.summary.totalCohorts ?? 0}
          subtitle="Weekly cohorts"
          loading={loading.cohorts}
        />
      </div>

      {/* Cohort Retention Heatmap */}
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-ink">Cohort Retention</h2>
          <div className="flex gap-1 bg-linen rounded-lg p-1">
            <button
              onClick={() => setCohortMode('visitors')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                cohortMode === 'visitors'
                  ? 'bg-cream text-ink shadow-sm'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              Visitors
            </button>
            <button
              onClick={() => setCohortMode('users')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                cohortMode === 'users'
                  ? 'bg-cream text-ink shadow-sm'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              Users
            </button>
          </div>
        </div>
        <div className="p-6">
          <RetentionHeatmap
            cohorts={cohorts?.cohorts ?? []}
            loading={loading.cohorts}
          />
        </div>
      </div>

      {/* Segments Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Breakdown */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium text-ink">Visitor Segments</h2>
          </div>
          <div className="p-6">
            <SegmentBreakdownChart
              segments={segments?.segments ?? []}
              loading={loading.segments}
            />
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium text-ink">Device Breakdown</h2>
          </div>
          <div className="p-6">
            <DeviceBreakdownChart
              deviceBreakdown={segments?.deviceBreakdown ?? {}}
              loading={loading.segments}
            />
          </div>
        </div>
      </div>

      {/* Segment Detail Table */}
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-medium text-ink">Segment Detail</h2>
        </div>
        <SegmentDetailTable
          segments={segments?.segments ?? []}
          loading={loading.segments}
        />
      </div>
    </div>
  );
}
