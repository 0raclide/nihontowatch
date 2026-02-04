'use client';

import { useEffect, useState, useCallback } from 'react';

interface Alert {
  id: number | string;
  user_id: string;
  alert_type: 'price_drop' | 'new_listing' | 'back_in_stock';
  source_table: 'saved_searches' | 'alerts';
  // For new_listing (from saved_searches)
  name?: string | null;
  notification_frequency?: 'instant' | 'daily' | 'none';
  last_notified_at?: string | null;
  last_match_count?: number;
  // For price_drop/back_in_stock (from alerts)
  listing_id?: number | null;
  target_price?: number | null;
  listing?: {
    title: string | null;
    price_value: number | null;
  } | null;
  last_triggered_at?: string | null;
  // Common fields
  search_criteria?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  user?: {
    email: string;
    display_name: string | null;
  } | null;
  history?: AlertHistoryRecord[];
}

interface AlertHistoryRecord {
  id?: number;
  alert_id?: string | number;
  triggered_at: string;
  delivery_status: 'pending' | 'sent' | 'failed';
  delivery_method: 'email' | 'push';
  error_message?: string | null;
  match_count?: number;
}

interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  totalPages: number;
}

const ALERT_TYPE_OPTIONS = [
  { value: 'new_listing', label: 'New Listing' },
  { value: 'price_drop', label: 'Price Drop' },
  { value: 'back_in_stock', label: 'Back in Stock' },
  { value: 'all', label: 'All Types' },
];

const ALERT_TYPE_LABELS: Record<string, string> = {
  price_drop: 'Price Drop',
  new_listing: 'New Listing',
  back_in_stock: 'Back in Stock',
};

const NOTIFICATION_FREQUENCY_LABELS: Record<string, string> = {
  instant: 'Instant',
  daily: 'Daily',
  none: 'None',
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

function formatSearchCriteria(criteria: Record<string, unknown> | null | undefined): string {
  if (!criteria) return 'Any listing';

  const parts: string[] = [];

  // Item types
  if (criteria.itemTypes && Array.isArray(criteria.itemTypes) && criteria.itemTypes.length > 0) {
    const types = criteria.itemTypes as string[];
    parts.push(types.length > 2 ? `${types.length} types` : types.join(', '));
  }

  // Category
  if (criteria.category && criteria.category !== 'all') {
    parts.push(criteria.category as string);
  }

  // Certifications
  if (criteria.certifications && Array.isArray(criteria.certifications) && criteria.certifications.length > 0) {
    const certs = criteria.certifications as string[];
    parts.push(certs.length > 2 ? `${certs.length} certs` : certs.join(', '));
  }

  // Dealers
  if (criteria.dealers && Array.isArray(criteria.dealers) && criteria.dealers.length > 0) {
    const dealers = criteria.dealers as number[];
    parts.push(`${dealers.length} dealer${dealers.length !== 1 ? 's' : ''}`);
  }

  // Schools
  if (criteria.schools && Array.isArray(criteria.schools) && criteria.schools.length > 0) {
    const schools = criteria.schools as string[];
    parts.push(schools.length > 2 ? `${schools.length} schools` : schools.join(', '));
  }

  // Price range
  if (criteria.minPrice || criteria.maxPrice) {
    const min = criteria.minPrice as number | undefined;
    const max = criteria.maxPrice as number | undefined;
    if (min && max) {
      parts.push(`¥${min.toLocaleString()}-${max.toLocaleString()}`);
    } else if (min) {
      parts.push(`≥¥${min.toLocaleString()}`);
    } else if (max) {
      parts.push(`≤¥${max.toLocaleString()}`);
    }
  }

  // Query text
  if (criteria.query) {
    parts.push(`"${criteria.query}"`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Any listing';
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | number | null>(null);

  // Filters - default to new_listing
  const [typeFilter, setTypeFilter] = useState<string>('new_listing');
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
    setTypeFilter('new_listing');
    setStatusFilter('');
    setPage(1);
  };

  // Has filters if status is set or type is not the default
  const hasFilters = statusFilter || (typeFilter !== 'new_listing');

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
              {ALERT_TYPE_OPTIONS.map(({ value, label }) => (
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
                        {alert.alert_type === 'new_listing' ? (
                          <div className="max-w-[250px]">
                            {alert.name && (
                              <p className="font-medium text-ink truncate">{alert.name}</p>
                            )}
                            <p className="text-xs text-muted truncate">
                              {formatSearchCriteria(alert.search_criteria)}
                            </p>
                            {alert.notification_frequency && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                  {NOTIFICATION_FREQUENCY_LABELS[alert.notification_frequency]}
                                </span>
                                {alert.last_match_count !== undefined && alert.last_match_count > 0 && (
                                  <span className="text-xs text-muted">
                                    {alert.last_match_count} last match{alert.last_match_count !== 1 ? 'es' : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : alert.listing_id ? (
                          <div>
                            <p className="truncate max-w-[200px]">{alert.listing?.title || `Listing #${alert.listing_id}`}</p>
                            {alert.target_price && (
                              <p className="text-xs text-muted">Target: ¥{alert.target_price.toLocaleString()}</p>
                            )}
                          </div>
                        ) : alert.search_criteria ? (
                          <p className="text-xs text-muted truncate max-w-[200px]">
                            {formatSearchCriteria(alert.search_criteria)}
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
                              {alert.alert_type === 'new_listing' ? 'Notification History' : 'Delivery History'}
                            </h4>
                            {alert.history && alert.history.length > 0 ? (
                              <div className="space-y-2">
                                {alert.history.map((record, index) => (
                                  <div
                                    key={record.id || index}
                                    className="flex items-center gap-4 text-sm bg-cream rounded-lg px-4 py-3"
                                  >
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                      STATUS_COLORS[record.delivery_status]
                                    }`}>
                                      {STATUS_LABELS[record.delivery_status]}
                                    </span>
                                    <span className="text-muted capitalize">{record.delivery_method}</span>
                                    <span className="text-muted">{formatDateTime(record.triggered_at)}</span>
                                    {record.match_count !== undefined && record.match_count > 0 && (
                                      <span className="text-xs text-charcoal">
                                        {record.match_count} match{record.match_count !== 1 ? 'es' : ''}
                                      </span>
                                    )}
                                    {record.error_message && (
                                      <span className="text-error text-xs">{record.error_message}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted">No delivery history</p>
                            )}
                            {alert.alert_type === 'new_listing' && alert.last_notified_at && (
                              <p className="text-xs text-muted mt-3">
                                Last notified: {formatDateTime(alert.last_notified_at)}
                              </p>
                            )}
                            {alert.alert_type !== 'new_listing' && alert.last_triggered_at && (
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
