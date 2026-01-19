'use client';

import { useEffect, useState, useCallback } from 'react';

interface ScraperStats {
  lastScrape: {
    time: string | null;
    dealer: string | null;
  };
  totalListings: number;
  availableListings: number;
  qaPassRate: number;
  pendingUrls: number;
}

interface ScrapeRun {
  id: number;
  runType: 'discovery' | 'scrape' | 'full';
  dealer: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  processed: number;
  newListings: number;
  updatedListings: number;
  errors: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface QAIssue {
  dealer: string;
  total: number;
  passed: number;
  passRate: number;
  topIssue: string | null;
}

interface DealerOption {
  id: number;
  name: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = 'gold',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'gold' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    gold: 'bg-gold/10 text-gold',
    green: 'bg-success/10 text-success',
    yellow: 'bg-warning/10 text-warning',
    red: 'bg-error/10 text-error',
  };

  return (
    <div className="bg-cream rounded-xl p-6 border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted font-medium">{title}</p>
          <p className="text-3xl font-serif text-ink mt-2">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getPassRateColor(rate: number): 'green' | 'yellow' | 'red' {
  if (rate >= 80) return 'green';
  if (rate >= 60) return 'yellow';
  return 'red';
}

export default function ScrapersAdmin() {
  const [stats, setStats] = useState<ScraperStats | null>(null);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [qaIssues, setQaIssues] = useState<QAIssue[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scrape trigger state
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, runsRes, qaRes, dealersRes] = await Promise.all([
        fetch('/api/admin/scrapers/stats'),
        fetch('/api/admin/scrapers/runs'),
        fetch('/api/admin/scrapers/qa'),
        fetch('/api/admin/scrapers/dealers'),
      ]);

      if (!statsRes.ok || !runsRes.ok || !qaRes.ok || !dealersRes.ok) {
        throw new Error('Failed to fetch scraper data');
      }

      const [statsData, runsData, qaData, dealersData] = await Promise.all([
        statsRes.json(),
        runsRes.json(),
        qaRes.json(),
        dealersRes.json(),
      ]);

      setStats(statsData);
      setRuns(runsData.runs || []);
      setQaIssues(qaData.issues || []);
      setDealers(dealersData.dealers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRunScrape = async () => {
    setIsRunning(true);
    setScrapeStatus('Starting scrape...');

    try {
      const response = await fetch('/api/admin/scrapers/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer: selectedDealer === 'all' ? null : selectedDealer,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger scrape');
      }

      const data = await response.json();
      setScrapeStatus(`Scrape triggered: ${data.message}`);

      // Refresh data after a short delay
      setTimeout(() => {
        fetchData();
        setScrapeStatus(null);
      }, 3000);
    } catch (err) {
      setScrapeStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 text-error rounded-lg p-4">
        <p className="font-medium">Error loading scraper data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-serif text-ink">Scrapers</h1>
        <p className="text-muted text-sm mt-1">Monitor and control data scrapers</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Last Scrape"
          value={formatTimeAgo(stats?.lastScrape.time || null)}
          subtitle={stats?.lastScrape.dealer || undefined}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Total Listings"
          value={stats?.totalListings.toLocaleString() || '0'}
          subtitle={`${stats?.availableListings.toLocaleString() || '0'} available`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <MetricCard
          title="QA Pass Rate"
          value={`${stats?.qaPassRate || 0}%`}
          color={getPassRateColor(stats?.qaPassRate || 0)}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Pending URLs"
          value={stats?.pendingUrls.toLocaleString() || '0'}
          subtitle="Unscraped"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Trigger Scrape Panel */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <h2 className="font-serif text-lg text-ink mb-4">Trigger Scrape</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs uppercase tracking-wider text-muted font-medium mb-2">
              Dealer
            </label>
            <select
              value={selectedDealer}
              onChange={(e) => setSelectedDealer(e.target.value)}
              className="w-full px-4 py-2 bg-linen border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-gold/50"
              disabled={isRunning}
            >
              <option value="all">All Dealers (Unscraped Queue)</option>
              {dealers.map((dealer) => (
                <option key={dealer.id} value={dealer.name}>
                  {dealer.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRunScrape}
            disabled={isRunning}
            className="px-6 py-2 bg-gold text-white rounded-lg font-medium hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunning && (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {isRunning ? 'Running...' : 'Run Scrape'}
          </button>
        </div>
        {scrapeStatus && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            scrapeStatus.startsWith('Error')
              ? 'bg-error/10 text-error'
              : 'bg-success/10 text-success'
          }`}>
            {scrapeStatus}
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Runs */}
        <div className="bg-cream rounded-xl border border-border lg:col-span-2">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-serif text-lg text-ink">Recent Runs</h2>
          </div>
          {runs.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted text-sm">
              No recent runs
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Dealer</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Processed</th>
                    <th className="px-4 py-3 font-medium text-right">New</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.slice(0, 15).map((run) => (
                    <tr key={run.id} className={`hover:bg-linen/50 ${run.status === 'failed' ? 'bg-error/5' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          run.runType === 'discovery' ? 'bg-blue-100 text-blue-700' :
                          run.runType === 'scrape' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {run.runType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{run.dealer}</td>
                      <td className="px-4 py-3 text-sm text-muted">{formatTimeAgo(run.startedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          run.status === 'completed' ? 'bg-success/10 text-success' :
                          run.status === 'running' ? 'bg-gold/10 text-gold animate-pulse' :
                          run.status === 'pending' ? 'bg-gray-100 text-gray-600' :
                          'bg-error/10 text-error'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-ink">
                        {run.processed}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {run.newListings > 0 ? (
                          <span className="text-success font-medium">+{run.newListings}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted max-w-[200px]">
                        {run.status === 'failed' && run.errorMessage ? (
                          <span className="text-error truncate block" title={run.errorMessage}>
                            {run.errorMessage.length > 50
                              ? run.errorMessage.substring(0, 50) + '...'
                              : run.errorMessage}
                          </span>
                        ) : run.errors > 0 ? (
                          <span className="text-warning">{run.errors} errors</span>
                        ) : run.updatedListings > 0 ? (
                          <span>{run.updatedListings} updated</span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QA Issues */}
        <div className="bg-cream rounded-xl border border-border lg:col-span-2">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-serif text-lg text-ink">QA Issues by Dealer</h2>
          </div>
          {qaIssues.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted text-sm">
              No QA issues detected
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                    <th className="px-6 py-3 font-medium">Dealer</th>
                    <th className="px-6 py-3 font-medium">Pass Rate</th>
                    <th className="px-6 py-3 font-medium">Top Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {qaIssues.map((issue) => (
                    <tr key={issue.dealer} className="hover:bg-linen/50">
                      <td className="px-6 py-3 text-sm text-ink">{issue.dealer}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-linen rounded-full overflow-hidden max-w-[100px]">
                            <div
                              className={`h-full rounded-full ${
                                issue.passRate >= 80 ? 'bg-success' :
                                issue.passRate >= 60 ? 'bg-warning' :
                                'bg-error'
                              }`}
                              style={{ width: `${issue.passRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted">{issue.passRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-muted">
                        {issue.topIssue || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
