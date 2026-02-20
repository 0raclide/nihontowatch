'use client';

import { useEffect, useState, useCallback } from 'react';

interface VisitorSession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  pageViews: number;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
}

interface ActivityEvent {
  id: number;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
  sessionId: string;
}

interface VisitorDetail {
  visitorId: string;
  ipAddresses: string[];
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  totalSessions: number;
  totalDurationMs: number;

  searchCount: number;
  filterChangeCount: number;
  pageViewCount: number;
  dealerClickCount: number;
  favoriteCount: number;

  topSearches: { query: string; count: number }[];
  filterPatterns: {
    category: string;
    filters: Record<string, unknown>;
    count: number;
  }[];
  sessions: VisitorSession[];
  recentActivity: ActivityEvent[];
  dealersClicked: { name: string; count: number }[];
  pagesViewed: { path: string; count: number }[];
}

interface VisitorDetailModalProps {
  visitorId: string;
  onClose: () => void;
}

// Format duration in human readable format
function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Format relative time
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Format time for timeline
function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format date
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get event type label and icon
function getEventDisplay(eventType: string): { label: string; icon: string; color: string } {
  switch (eventType) {
    case 'search':
      return { label: 'Search', icon: '🔍', color: 'text-blue-600' };
    case 'filter_change':
      return { label: 'Filter', icon: '⚙️', color: 'text-purple-600' };
    case 'page_view':
      return { label: 'Page View', icon: '📄', color: 'text-gray-600' };
    case 'external_link_click':
      return { label: 'Dealer Click', icon: '🔗', color: 'text-green-600' };
    case 'favorite_add':
      return { label: 'Favorited', icon: '❤️', color: 'text-red-500' };
    case 'favorite_remove':
      return { label: 'Unfavorited', icon: '💔', color: 'text-red-300' };
    case 'listing_view':
      return { label: 'Listing View', icon: '👁️', color: 'text-amber-600' };
    case 'viewport_dwell':
      return { label: 'Dwell', icon: '⏱️', color: 'text-gray-400' };
    case 'quickview_panel_toggle':
      return { label: 'Panel Toggle', icon: '📸', color: 'text-indigo-500' };
    case 'inquiry_copy':
      return { label: 'Copied Draft', icon: '📋', color: 'text-green-600' };
    case 'inquiry_mailto_click':
      return { label: 'Opened Email', icon: '📧', color: 'text-green-700' };
    case 'dealer_click':
      return { label: 'Dealer Click', icon: '🔗', color: 'text-green-600' };
    case 'listing_detail_view':
      return { label: 'Listing Detail', icon: '📋', color: 'text-blue-500' };
    case 'search_click':
      return { label: 'Search Click', icon: '🔍', color: 'text-blue-600' };
    case 'quickview_open':
      return { label: 'Quick View', icon: '👁️', color: 'text-indigo-500' };
    case 'alert_create':
      return { label: 'Alert Created', icon: '🔔', color: 'text-amber-500' };
    case 'alert_delete':
      return { label: 'Alert Deleted', icon: '🔕', color: 'text-gray-400' };
    case 'listing_view':
      return { label: 'Listing View', icon: '👁️', color: 'text-amber-600' };
    case 'listing_impression':
      return { label: 'Impression', icon: '📊', color: 'text-gray-400' };
    default:
      return { label: eventType, icon: '•', color: 'text-gray-500' };
  }
}

// Get event description
function getEventDescription(event: ActivityEvent): string {
  const data = event.eventData;

  switch (event.eventType) {
    case 'search':
      return `"${data.query || 'empty'}"`;
    case 'filter_change':
      if (data.changedKey) {
        return `Changed ${data.changedKey}`;
      }
      return 'Updated filters';
    case 'page_view':
      return data.path as string || '/';
    case 'external_link_click':
    case 'dealer_click':
      return data.dealerName as string || 'Unknown dealer';
    case 'favorite_add':
    case 'favorite_remove':
      return `Listing #${data.listingId || 'unknown'}`;
    case 'listing_view':
    case 'listing_detail_view':
      return `#${data.listingId || 'unknown'}`;
    case 'inquiry_copy':
      return `Copied draft for #${data.listingId || 'unknown'}`;
    case 'inquiry_mailto_click':
      return `Opened email for #${data.listingId || 'unknown'}`;
    case 'search_click':
      return `Clicked result #${data.listingId || 'unknown'}`;
    case 'quickview_open':
      return `Listing #${data.listingId || 'unknown'}`;
    case 'alert_create':
    case 'alert_delete':
      return data.alertName as string || '';
    case 'listing_impression':
      return `${data.count || ''} listings`;
    default:
      return '';
  }
}

export function VisitorDetailModal({ visitorId, onClose }: VisitorDetailModalProps) {
  const [data, setData] = useState<VisitorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'sessions' | 'searches' | 'filters'>('timeline');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/visitors/${encodeURIComponent(visitorId)}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to load visitor data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        data-testid="modal-backdrop"
      />

      {/* Modal */}
      <div className="relative bg-paper dark:bg-ink rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-linen dark:border-charcoal/50">
          <div>
            <h2 className="text-lg font-semibold text-ink dark:text-paper">
              Visitor Details
            </h2>
            <p className="text-sm text-muted font-mono truncate max-w-md">
              {visitorId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-linen dark:hover:bg-charcoal/50 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div role="status" className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              {error}
            </div>
          ) : data ? (
            <div className="p-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Time" value={formatDuration(data.totalDurationMs)} />
                <StatCard label="Sessions" value={data.totalSessions.toString()} />
                <StatCard label="Events" value={data.totalEvents.toString()} />
                <StatCard label="Searches" value={data.searchCount.toString()} />
              </div>

              {/* Activity breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <MiniStat label="Page Views" value={data.pageViewCount} />
                <MiniStat label="Filter Changes" value={data.filterChangeCount} />
                <MiniStat label="Dealer Clicks" value={data.dealerClickCount} />
                <MiniStat label="Favorites" value={data.favoriteCount} />
                <MiniStat label="IPs" value={data.ipAddresses.length} />
              </div>

              {/* Time info */}
              <div className="flex gap-6 text-sm text-muted">
                <span>First seen: {formatDate(data.firstSeen)}</span>
                <span>Last seen: {formatRelativeTime(data.lastSeen)}</span>
              </div>

              {/* Tabs */}
              <div className="border-b border-linen dark:border-charcoal/50">
                <div className="flex gap-1">
                  <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
                    Timeline
                  </TabButton>
                  <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')}>
                    Sessions ({data.sessions.length})
                  </TabButton>
                  <TabButton active={activeTab === 'searches'} onClick={() => setActiveTab('searches')}>
                    Searches ({data.searchCount})
                  </TabButton>
                  <TabButton active={activeTab === 'filters'} onClick={() => setActiveTab('filters')}>
                    Filters
                  </TabButton>
                </div>
              </div>

              {/* Tab content */}
              <div role="tabpanel">
                {activeTab === 'timeline' && (
                  <TimelineTab activity={data.recentActivity} />
                )}
                {activeTab === 'sessions' && (
                  <SessionsTab sessions={data.sessions} />
                )}
                {activeTab === 'searches' && (
                  <SearchesTab searches={data.topSearches} />
                )}
                {activeTab === 'filters' && (
                  <FiltersTab patterns={data.filterPatterns} dealers={data.dealersClicked} pages={data.pagesViewed} />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Sub-components
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-linen/50 dark:bg-charcoal/30 rounded-lg p-4 text-center">
      <div className="text-2xl font-semibold text-ink dark:text-paper">{value}</div>
      <div className="text-xs text-muted uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-linen/30 dark:bg-charcoal/20 rounded px-3 py-2 text-center">
      <div className="font-medium">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'text-gold border-b-2 border-gold -mb-px'
          : 'text-muted hover:text-ink dark:hover:text-paper'
      }`}
    >
      {children}
    </button>
  );
}

function TimelineTab({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) {
    return <div className="text-center text-muted py-8">No activity recorded</div>;
  }

  // Group by date
  const groupedByDate = new Map<string, ActivityEvent[]>();
  for (const event of activity) {
    const dateKey = new Date(event.createdAt).toLocaleDateString();
    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, []);
    }
    groupedByDate.get(dateKey)!.push(event);
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedByDate.entries()).map(([date, events]) => (
        <div key={date}>
          <div className="text-sm font-medium text-muted mb-3">{date}</div>
          <div className="space-y-2">
            {events.map((event) => {
              const display = getEventDisplay(event.eventType);
              const description = getEventDescription(event);

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 py-2 px-3 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
                >
                  <span className="text-lg">{display.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${display.color}`}>{display.label}</span>
                      {description && (
                        <span className="text-sm text-muted truncate">{description}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatTime(event.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionsTab({ sessions }: { sessions: VisitorSession[] }) {
  if (sessions.length === 0) {
    return <div className="text-center text-muted py-8">No sessions recorded</div>;
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          className="p-4 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">
              {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
            </div>
            <div className="text-lg font-semibold text-gold">
              {formatDuration(session.durationMs)}
            </div>
          </div>
          <div className="flex gap-4 text-sm text-muted">
            <span>{session.pageViews} page views</span>
            {session.screenWidth && session.screenHeight && (
              <span>{session.screenWidth}x{session.screenHeight}</span>
            )}
            {session.endedAt ? (
              <span>Ended {formatRelativeTime(session.endedAt)}</span>
            ) : (
              <span className="text-green-500">Active</span>
            )}
          </div>
          {session.userAgent && (
            <div className="text-xs text-muted mt-2 truncate">
              {session.userAgent}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SearchesTab({ searches }: { searches: { query: string; count: number }[] }) {
  if (searches.length === 0) {
    return <div className="text-center text-muted py-8">No searches recorded</div>;
  }

  return (
    <div className="space-y-2">
      {searches.map((search, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
        >
          <span className="font-mono text-sm">&ldquo;{search.query}&rdquo;</span>
          <span className="text-sm text-muted">{search.count}x</span>
        </div>
      ))}
    </div>
  );
}

function FiltersTab({
  patterns,
  dealers,
  pages,
}: {
  patterns: { category: string; filters: Record<string, unknown>; count: number }[];
  dealers: { name: string; count: number }[];
  pages: { path: string; count: number }[];
}) {
  return (
    <div className="space-y-6">
      {/* Filter patterns */}
      {patterns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted mb-3">Filter Combinations Used</h4>
          <div className="space-y-2">
            {patterns.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
              >
                <span className="text-sm">{p.category}</span>
                <span className="text-sm text-muted">{p.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dealers clicked */}
      {dealers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted mb-3">Dealers Clicked</h4>
          <div className="space-y-2">
            {dealers.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
              >
                <span className="text-sm">{d.name}</span>
                <span className="text-sm text-muted">{d.count} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pages viewed */}
      {pages.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted mb-3">Pages Viewed</h4>
          <div className="space-y-2">
            {pages.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-linen/30 dark:bg-charcoal/20 rounded-lg"
              >
                <span className="text-sm font-mono">{p.path}</span>
                <span className="text-sm text-muted">{p.count} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {patterns.length === 0 && dealers.length === 0 && pages.length === 0 && (
        <div className="text-center text-muted py-8">No filter or browsing data</div>
      )}
    </div>
  );
}
