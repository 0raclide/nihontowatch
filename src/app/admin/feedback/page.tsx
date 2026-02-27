'use client';

import { useEffect, useState, useCallback } from 'react';
import type { UserFeedback, FeedbackStatus } from '@/types/feedback';

interface FeedbackWithUser extends UserFeedback {
  user_display_name: string;
}

const STATUS_TABS: Array<{ value: FeedbackStatus | 'all'; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'data_report', label: 'Data Reports' },
  { value: 'bug', label: 'Bugs' },
  { value: 'feature_request', label: 'Features' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS: Record<string, string> = {
  data_report: 'bg-amber-500/10 text-amber-600',
  bug: 'bg-red-500/10 text-red-600',
  feature_request: 'bg-blue-500/10 text-blue-600',
  other: 'bg-gray-500/10 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  data_report: 'Data Report',
  bug: 'Bug',
  feature_request: 'Feature',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-500/10 text-amber-600',
  acknowledged: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  dismissed: 'bg-gray-500/10 text-gray-600',
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ open: 0, data_reports: 0, bugs: 0, features: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<FeedbackStatus>('open');
  const [saving, setSaving] = useState(false);
  const limit = 50;

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/admin/feedback?${params}`);
      if (res.ok) {
        const json = await res.json();
        setFeedback(json.data || []);
        setTotal(json.total || 0);
        if (json.summary) setSummary(json.summary);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const handleExpand = (item: FeedbackWithUser) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setEditNotes(item.admin_notes || '');
    setEditStatus(item.status);
  };

  const handleSave = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, admin_notes: editNotes }),
      });
      if (res.ok) {
        await fetchFeedback();
        setExpandedId(null);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink">User Feedback</h1>
          <p className="text-sm text-muted mt-1">{total} total items</p>
        </div>
      </div>

      {/* Metric cards — true totals from DB, not page-scoped */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Open" value={summary.open} color="text-amber-600" />
        <MetricCard label="Data Reports" value={summary.data_reports} color="text-amber-600" />
        <MetricCard label="Bugs" value={summary.bugs} color="text-red-600" />
        <MetricCard label="Features" value={summary.features} color="text-blue-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1 bg-linen/50 rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                statusFilter === tab.value
                  ? 'bg-cream shadow-sm text-ink font-medium'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-cream border border-border rounded-md text-ink focus:outline-none focus:border-gold/40"
        >
          {TYPE_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-20 text-muted text-sm">
          No feedback found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3 pr-4">Time</th>
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3 pr-4">Type</th>
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3 pr-4">Target</th>
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3 pr-4">Message</th>
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3 pr-4">User</th>
                <th className="text-xs uppercase tracking-wider text-muted font-semibold pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {feedback.map(item => (
                <FeedbackRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  onToggle={() => handleExpand(item)}
                  editNotes={editNotes}
                  editStatus={editStatus}
                  onNotesChange={setEditNotes}
                  onStatusChange={setEditStatus}
                  onSave={() => handleSave(item.id)}
                  saving={saving}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-ink disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-ink disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-cream border border-border/50 rounded-lg p-4">
      <div className={`text-2xl font-serif tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{label}</div>
    </div>
  );
}

function FeedbackRow({
  item,
  isExpanded,
  onToggle,
  editNotes,
  editStatus,
  onNotesChange,
  onStatusChange,
  onSave,
  saving,
}: {
  item: FeedbackWithUser;
  isExpanded: boolean;
  onToggle: () => void;
  editNotes: string;
  editStatus: FeedbackStatus;
  onNotesChange: (v: string) => void;
  onStatusChange: (v: FeedbackStatus) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const targetUrl = item.target_type === 'listing'
    ? `/listing/${item.target_id}`
    : item.target_type === 'artist'
    ? `/artists/${item.target_id}`
    : null;

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-linen/30 transition-colors"
        onClick={onToggle}
      >
        <td className="py-3 pr-4 text-xs text-muted whitespace-nowrap">
          {timeAgo(item.created_at)}
        </td>
        <td className="py-3 pr-4">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[item.feedback_type] || 'bg-gray-500/10 text-gray-600'}`}>
            {TYPE_LABELS[item.feedback_type] || item.feedback_type}
          </span>
        </td>
        <td className="py-3 pr-4 text-xs text-ink max-w-[160px] truncate">
          {targetUrl ? (
            <a
              href={targetUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-gold hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.target_label || item.target_id}
            </a>
          ) : (
            <span className="text-muted">General</span>
          )}
        </td>
        <td className="py-3 pr-4 text-xs text-ink max-w-[300px] truncate">
          {item.message}
        </td>
        <td className="py-3 pr-4 text-xs text-muted whitespace-nowrap">
          {item.user_display_name}
        </td>
        <td className="py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_COLORS[item.status] || ''}`}>
            {item.status}
          </span>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-linen/20 px-6 py-4 border-b border-border/30">
            <div className="space-y-4 max-w-2xl">
              {/* Full message */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Message
                </label>
                <p className="text-sm text-ink whitespace-pre-wrap bg-cream rounded p-3 border border-border/30">
                  {item.message}
                </p>
              </div>

              {/* Page URL */}
              {item.page_url && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Source Page
                  </label>
                  <a
                    href={item.page_url}
                    className="text-xs text-gold hover:underline break-all"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.page_url}
                  </a>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Admin Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-ink bg-cream border border-border rounded
                    placeholder:text-muted/40 focus:outline-none focus:border-gold/40 resize-none"
                />
              </div>

              {/* Status + Save */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => onStatusChange(e.target.value as FeedbackStatus)}
                    className="px-3 py-1.5 text-sm bg-cream border border-border rounded text-ink
                      focus:outline-none focus:border-gold/40"
                  >
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onSave(); }}
                  disabled={saving}
                  className="mt-auto px-4 py-1.5 text-xs font-medium text-white bg-gold rounded
                    hover:bg-gold/90 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
