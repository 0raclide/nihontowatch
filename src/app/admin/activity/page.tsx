'use client';

import { useEffect, useState, useCallback } from 'react';

interface ActivityRecord {
  id: number;
  user_id: string;
  action_type: string;
  page_path: string | null;
  listing_id: number | null;
  search_query: string | null;
  duration_seconds: number | null;
  created_at: string;
  user?: {
    email: string;
    display_name: string | null;
  };
}

interface ActivityResponse {
  activity: ActivityRecord[];
  total: number;
  page: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, string> = {
  view: 'Page View',
  search: 'Search',
  favorite: 'Favorite',
  alert_create: 'Alert Created',
  alert_delete: 'Alert Deleted',
  login: 'Login',
  logout: 'Logout',
};

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-blue-500/10 text-blue-600',
  search: 'bg-purple-500/10 text-purple-600',
  favorite: 'bg-pink-500/10 text-pink-600',
  alert_create: 'bg-green-500/10 text-green-600',
  alert_delete: 'bg-orange-500/10 text-orange-600',
  login: 'bg-teal-500/10 text-teal-600',
  logout: 'bg-gray-500/10 text-gray-600',
};

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function AdminActivityPage() {
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (userFilter) params.set('user', userFilter);
      if (actionFilter) params.set('action_type', actionFilter);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await fetch(`/api/admin/activity?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data: ActivityResponse = await response.json();
      setActivity(data.activity);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [page, userFilter, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
      });
      if (userFilter) params.set('user', userFilter);
      if (actionFilter) params.set('action_type', actionFilter);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await fetch(`/api/admin/activity?${params}`);
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    }
  };

  const clearFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = userFilter || actionFilter || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Activity Log</h1>
          <p className="text-muted text-sm mt-1">
            Track user actions and site activity
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-cream border border-border rounded-lg text-sm text-charcoal hover:bg-linen transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-cream rounded-xl border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              User
            </label>
            <input
              type="text"
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Email or ID..."
              className="w-full px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div className="flex items-end">
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gold hover:text-gold-light transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Activity Table */}
      <div className="bg-cream rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-sm text-muted">
            {total.toLocaleString()} activity records
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-linen/50">
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  User
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Action
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Page/Listing
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Duration
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12">
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : activity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted text-sm">
                    No activity found
                  </td>
                </tr>
              ) : (
                activity.map((record) => (
                  <tr key={record.id} className="hover:bg-linen/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-medium">
                          {(record.user?.display_name || record.user?.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-ink truncate max-w-[200px]">
                            {record.user?.display_name || record.user?.email || record.user_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                        ACTION_COLORS[record.action_type] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {ACTION_LABELS[record.action_type] || record.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-charcoal">
                      {record.search_query ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="truncate max-w-[200px]">{record.search_query}</span>
                        </span>
                      ) : record.listing_id ? (
                        <span className="text-gold">Listing #{record.listing_id}</span>
                      ) : record.page_path ? (
                        <span className="truncate max-w-[200px] text-muted">{record.page_path}</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted tabular-nums">
                      {formatDuration(record.duration_seconds)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted whitespace-nowrap">
                      {formatDateTime(record.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-md text-charcoal hover:bg-linen disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-md text-charcoal hover:bg-linen disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
