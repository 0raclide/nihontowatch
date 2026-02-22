import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface CohortWeekData {
  activeUsers: number;
  retentionPct: number;
}

export interface CohortData {
  cohortWeek: string;
  cohortSize: number;
  weeks: Record<number, CohortWeekData>;
}

export interface CohortSummary {
  avgW0: number;
  avgW1: number;
  avgW4: number;
  totalCohorts: number;
}

export interface CohortsResponse {
  cohorts: CohortData[];
  summary: CohortSummary;
  mode: 'users' | 'visitors';
  period: string;
}

export interface SegmentData {
  segment: string;
  visitorCount: number;
  percentage: number;
  avgEvents: number;
  avgSessions: number;
  topEventType: string;
}

export interface DeviceBreakdown {
  mobile: number;
  desktop: number;
  unknown: number;
}

export interface SegmentsResponse {
  segments: SegmentData[];
  deviceBreakdown: Record<string, DeviceBreakdown>;
  period: string;
}

export type CohortMode = 'users' | 'visitors';

export interface UseRetentionAnalyticsOptions {
  period: '7d' | '30d' | '90d';
  cohortMode: CohortMode;
}

export interface UseRetentionAnalyticsReturn {
  cohorts: CohortsResponse | null;
  segments: SegmentsResponse | null;
  loading: { cohorts: boolean; segments: boolean };
  errors: { cohorts: string | null; segments: string | null };
  isLoading: boolean;
  refreshAll: () => Promise<void>;
}

// =============================================================================
// API HELPERS
// =============================================================================

interface AnalyticsAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchRetentionData<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${endpoint}?${qs}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  const result: AnalyticsAPIResponse<T> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || `No data returned from ${endpoint}`);
  }

  return result.data;
}

// =============================================================================
// HOOK
// =============================================================================

export function useRetentionAnalytics(
  options: UseRetentionAnalyticsOptions
): UseRetentionAnalyticsReturn {
  const { period, cohortMode } = options;

  const [cohorts, setCohorts] = useState<CohortsResponse | null>(null);
  const [segments, setSegments] = useState<SegmentsResponse | null>(null);

  const [loading, setLoading] = useState({ cohorts: true, segments: true });
  const [errors, setErrors] = useState<{ cohorts: string | null; segments: string | null }>({
    cohorts: null,
    segments: null,
  });

  const isMountedRef = useRef(true);

  const fetchCohorts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, cohorts: true }));
    setErrors((prev) => ({ ...prev, cohorts: null }));

    try {
      const result = await fetchRetentionData<CohortsResponse>(
        '/api/admin/analytics/retention/cohorts',
        { period, mode: cohortMode }
      );
      if (isMountedRef.current) setCohorts(result);
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          cohorts: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, cohorts: false }));
      }
    }
  }, [period, cohortMode]);

  const fetchSegments = useCallback(async () => {
    setLoading((prev) => ({ ...prev, segments: true }));
    setErrors((prev) => ({ ...prev, segments: null }));

    try {
      const result = await fetchRetentionData<SegmentsResponse>(
        '/api/admin/analytics/retention/segments',
        { period }
      );
      if (isMountedRef.current) setSegments(result);
    } catch (err) {
      if (isMountedRef.current) {
        setErrors((prev) => ({
          ...prev,
          segments: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, segments: false }));
      }
    }
  }, [period]);

  // Separate effects: cohorts re-fetch on period OR cohortMode change,
  // segments re-fetch on period change only (cohortMode is irrelevant to segments)
  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchCohorts(), fetchSegments()]);
  }, [fetchCohorts, fetchSegments]);

  const isLoading = loading.cohorts || loading.segments;

  return {
    cohorts,
    segments,
    loading,
    errors,
    isLoading,
    refreshAll,
  };
}
