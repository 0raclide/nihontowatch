'use client';

import { useState, useCallback } from 'react';
import type { Listing } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface AdminSetsumeiWidgetProps {
  listing: Listing;
  onConnectionChanged?: () => void;
}

interface PreviewData {
  listing: {
    id: number;
    title: string;
    title_en: string | null;
    item_type: string | null;
    cert_type: string | null;
    cert_session: number | null;
    smith: string | null;
    school: string | null;
    tosogu_maker: string | null;
    tosogu_school: string | null;
  };
  catalogRecord: {
    yuhinkai_uuid: string;
    yuhinkai_collection: string;
    yuhinkai_volume: number;
    yuhinkai_item_number: number;
    catalog_url: string;
    collection_display: string;
    session_number: number | null;
    setsumei_ja: string | null;
    setsumei_en: string | null;
    has_setsumei: boolean;
    enriched_maker: string | null;
    enriched_school: string | null;
    enriched_period: string | null;
    enriched_cert_type: string | null;
  };
  existingEnrichment: {
    yuhinkai_collection: string | null;
    yuhinkai_volume: number | null;
    yuhinkai_item_number: number | null;
    connection_source: string | null;
    verified_by: string | null;
  } | null;
  willOverwrite: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Admin widget for manually connecting listings to Yuhinkai catalog records.
 * Only visible to admin users on the listing detail page.
 */
export function AdminSetsumeiWidget({ listing, onConnectionChanged }: AdminSetsumeiWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if listing already has yuhinkai enrichment
  const hasEnrichment = !!(listing as Listing & { yuhinkai_enrichment?: unknown }).yuhinkai_enrichment;

  // Reset state when collapsing
  const handleToggle = useCallback(() => {
    if (isExpanded) {
      setUrl('');
      setError(null);
      setPreview(null);
      setSuccessMessage(null);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Fetch preview data
  const handlePreview = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a Yuhinkai URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const params = new URLSearchParams({
        url: url.trim(),
        listing_id: String(listing.id),
      });

      const response = await fetch(`/api/admin/setsumei/preview?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch preview');
      }

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preview');
    } finally {
      setIsLoading(false);
    }
  }, [url, listing.id]);

  // Connect to catalog record
  const handleConnect = useCallback(async () => {
    if (!preview) return;

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/setsumei/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          yuhinkai_url: url.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setSuccessMessage(
        `Connected to ${preview.catalogRecord.yuhinkai_collection} vol.${preview.catalogRecord.yuhinkai_volume} #${preview.catalogRecord.yuhinkai_item_number}`
      );
      setPreview(null);
      setUrl('');
      onConnectionChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [preview, url, listing.id, onConnectionChanged]);

  // Disconnect from catalog record
  const handleDisconnect = useCallback(async () => {
    if (!confirm('Are you sure you want to remove this connection?')) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/setsumei/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect');
      }

      setSuccessMessage('Connection removed');
      onConnectionChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  }, [listing.id, onConnectionChanged]);

  return (
    <div className="mb-6 border border-dashed border-gold/40 rounded-lg bg-gold/5">
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[12px] font-medium text-gold uppercase tracking-wider">
            Admin: Yuhinkai Connection
          </span>
          {hasEnrichment && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded">
              Connected
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gold transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-[13px] text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-[13px] text-error">{error}</p>
            </div>
          )}

          {/* URL Input */}
          {!preview && (
            <div>
              <label className="block text-[11px] text-muted uppercase tracking-wider mb-2">
                Yuhinkai URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/item/juyo/68/14936 or full URL"
                  className="flex-1 px-3 py-2 text-[13px] bg-paper border border-border rounded-lg focus:outline-none focus:border-gold text-ink placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isLoading || !url.trim()}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-gold hover:bg-gold-light disabled:bg-muted disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Preview'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Paste a Yuhinkai URL like /item/juyo/68/14936 or https://yuhinkai.com/item/...
              </p>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              {/* Warning if overwriting */}
              {preview.willOverwrite && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-[13px] text-amber-600">
                    This listing already has a connection to{' '}
                    <strong>
                      {preview.existingEnrichment?.yuhinkai_collection} vol.
                      {preview.existingEnrichment?.yuhinkai_volume} #
                      {preview.existingEnrichment?.yuhinkai_item_number}
                    </strong>
                    . Connecting will replace it.
                  </p>
                </div>
              )}

              {/* Catalog Record Info */}
              <div className="p-4 bg-paper border border-border rounded-lg">
                <h4 className="text-[11px] text-muted uppercase tracking-wider mb-3">
                  Catalog Record
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-muted">Collection:</span>
                    <p className="text-ink font-medium">{preview.catalogRecord.collection_display}</p>
                  </div>
                  <div>
                    <span className="text-muted">Reference:</span>
                    <p className="text-ink font-medium">
                      Vol.{preview.catalogRecord.yuhinkai_volume} #{preview.catalogRecord.yuhinkai_item_number}
                    </p>
                  </div>
                  {preview.catalogRecord.enriched_maker && (
                    <div>
                      <span className="text-muted">Artisan:</span>
                      <p className="text-ink">{preview.catalogRecord.enriched_maker}</p>
                    </div>
                  )}
                  {preview.catalogRecord.enriched_school && (
                    <div>
                      <span className="text-muted">School:</span>
                      <p className="text-ink">{preview.catalogRecord.enriched_school}</p>
                    </div>
                  )}
                </div>

                {/* Setsumei preview */}
                {preview.catalogRecord.has_setsumei ? (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-[10px] text-green-600 uppercase tracking-wider">
                      Has Setsumei Translation
                    </span>
                    {preview.catalogRecord.setsumei_en && (
                      <p className="mt-2 text-[12px] text-muted line-clamp-3">
                        {preview.catalogRecord.setsumei_en.substring(0, 200)}...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-[10px] text-amber-600 uppercase tracking-wider">
                      No Setsumei Translation Available
                    </span>
                  </div>
                )}

                <a
                  href={preview.catalogRecord.catalog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-[12px] text-gold hover:text-gold-light"
                >
                  View in Yuhinkai
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setUrl('');
                  }}
                  className="px-4 py-2 text-[13px] font-medium text-charcoal bg-paper border border-border hover:border-gold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 px-4 py-2 text-[13px] font-medium text-white bg-gold hover:bg-gold-light disabled:bg-muted disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isConnecting ? 'Connecting...' : preview.willOverwrite ? 'Replace Connection' : 'Connect'}
                </button>
              </div>
            </div>
          )}

          {/* Disconnect option if already connected */}
          {hasEnrichment && !preview && (
            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-[12px] text-error hover:text-error/80 disabled:text-muted"
              >
                {isDisconnecting ? 'Removing...' : 'Remove existing connection'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
