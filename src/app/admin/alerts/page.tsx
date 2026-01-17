'use client';

import { useEffect, useState, useCallback } from 'react';

interface Alert {
  id: number;
  user_id: string;
  alert_type: 'price_drop' | 'new_listing' | 'back_in_stock';
  listing_id: number | null;
  target_price: number | null;
  search_criteria: Record<string, unknown> | null;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  user?: {
    email: string;
    display_name: string | null;
  };
  listing?: {
    title: string;
    price_value: number | null;
  };
  history?: AlertHistoryRecord[];
}

interface AlertHistoryRecord {
  id: number;
  triggered_at: string;
  delivery_status: 'pending' | 'sent' | 'failed';
  delivery_method: 'email' | 'push';
  error_message: string | null;
}

interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  totalPages: number;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  price_drop: 'Price Drop',
  new_listing: 'New Listing',
  back_in_stock: 'Back in Stock',
};

const ALERT_TYPE_COLORS: Record<string, string> = {
  price_drop: 'bg-green-500/10 text-green-600',
  new_listing: 'bg-blue-500/10 text-blue-600',
  back_in_stock: 'bg-purple-500/10 text-purple-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  sent: 'bg-green-500/10 text-green-600',
  failed: 'bg-red-500/10 text-red-600',
};

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/stats?section=alerts&${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data: AlertsResponse = await response.json();
      setAlerts(data.alerts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasFilters = typeFilter || statusFilter;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Alerts</h1>
          <p className="text-muted text-sm mt-1">
            Monitor all user alerts and delivery status
          </p>
        </div>
        <div className="text-sm text-muted">
          {total.toLocaleString()} total alerts
        </div>
      </div>

      {/* Filters */}
      <div className="bg-cream rounded-xl border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              Alert Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 min-w-[150px]"
            >
              <option value="">All Types</option>
              {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-linen border-0 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 min-w-[150px]"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gold hover:text-gold-light transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-cream rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-linen/50">
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  User
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Criteria
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Created
                </th>
                <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted text-sm">
                    No alerts found
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <>
                    <tr key={alert.id} className="hover:bg-linen/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-medium">
                            {(alert.user?.display_name || alert.user?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-ink truncate max-w-[150px]">
                              {alert.user?.display_name || alert.user?.email || alert.user_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                          ALERT_TYPE_COLORS[alert.alert_type] || 'bg-gray-100 text-gray-600'
                        }`}>
                          {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-charcoal">
                        {alert.listing_id ? (
                          <div>
                            <p className="truncate max-w-[200px]">{alert.listing?.title || `Listing #${alert.listing_id}`}</p>
                            {alert.target_price && (
                              <p className="text-xs text-muted">Target: {alert.target_price.toLocaleString()}</p>
                            )}
                          </div>
                        ) : alert.search_criteria ? (
                          <p className="text-xs text-muted truncate max-w-[200px]">
                            {Object.entries(alert.search_criteria)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </p>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                          alert.is_active
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-gray-500/10 text-gray-600'
                        }`}>
                          {alert.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted whitespace-nowrap">
                        {formatDateTime(alert.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                          className="text-xs text-gold hover:text-gold-light transition-colors"
                        >
                          {expandedAlert === alert.id ? 'Hide History' : 'View History'}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded History Row */}
                    {expandedAlert === alert.id && (
                      <tr key={`${alert.id}-history`}>
                        <td colSpan={6} className="px-6 py-4 bg-linen/50">
                          <div className="pl-11">
                            <h4 className="text-xs uppercase tracking-wider text-muted font-semibold mb-3">
                              Delivery History
                            </h4>
                            {alert.history && alert.history.length > 0 ? (
                              <div className="space-y-2">
                                {alert.history.map((record) => (
                                  <div
                                    key={record.id}
                                    className="flex items-center gap-4 text-sm bg-cream rounded-lg px-4 py-3"
                                  >
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                      STATUS_COLORS[record.delivery_status]
                                    }`}>
                                      {STATUS_LABELS[record.delivery_status]}
                                    </span>
                                    <span className="text-muted capitalize">{record.delivery_method}</span>
                                    <span className="text-muted">{formatDateTime(record.triggered_at)}</span>
                                    {record.error_message && (
                                      <span className="text-error text-xs">{record.error_message}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted">No delivery history</p>
                            )}
                            {alert.last_triggered_at && (
                              <p className="text-xs text-muted mt-3">
                                Last triggered: {formatDateTime(alert.last_triggered_at)}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
