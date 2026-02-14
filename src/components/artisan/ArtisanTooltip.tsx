'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { ArtisanDetails } from '@/app/api/artisan/[code]/route';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';

interface ArtisanCandidate {
  artisan_id: string;
  name_kanji?: string;
  name_romaji?: string;
  school?: string;
  generation?: string;
  is_school_code?: boolean;
  retrieval_method?: string;
  retrieval_score?: number;
}

// Cert options for the pill row
const CERT_OPTIONS: { value: string | null; label: string; tier: 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon' | 'none' }[] = [
  { value: 'Tokuju', label: 'Tokuju', tier: 'tokuju' },
  { value: 'Juyo', label: 'Jūyō', tier: 'juyo' },
  { value: 'TokuHozon', label: 'Tokuho', tier: 'tokuho' },
  { value: 'Hozon', label: 'Hozon', tier: 'hozon' },
  { value: 'juyo_bijutsuhin', label: 'Jubi', tier: 'jubi' },
  { value: 'TokuKicho', label: 'TokuKichō', tier: 'tokuho' },
  { value: null, label: 'None', tier: 'none' },
];

// Normalize cert_type from DB to the canonical value used in CERT_OPTIONS
function normalizeCertValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    tokubetsu_juyo: 'Tokuju', tokuju: 'Tokuju', Tokuju: 'Tokuju',
    juyo: 'Juyo', Juyo: 'Juyo',
    tokubetsu_hozon: 'TokuHozon', TokuHozon: 'TokuHozon',
    hozon: 'Hozon', Hozon: 'Hozon',
    juyo_bijutsuhin: 'juyo_bijutsuhin', JuyoBijutsuhin: 'juyo_bijutsuhin', 'Juyo Bijutsuhin': 'juyo_bijutsuhin',
    TokuKicho: 'TokuKicho',
    nbthk: 'Hozon', nthk: 'Hozon',
  };
  return map[raw] ?? raw;
}

// Tier → Tailwind color classes for active pill
const CERT_TIER_COLORS: Record<string, string> = {
  tokuju: 'bg-tokuju/20 text-tokuju ring-tokuju/50',
  jubi: 'bg-jubi/20 text-jubi ring-jubi/50',
  juyo: 'bg-juyo/20 text-juyo ring-juyo/50',
  tokuho: 'bg-toku-hozon/20 text-toku-hozon ring-toku-hozon/50',
  hozon: 'bg-hozon/20 text-hozon ring-hozon/50',
  none: 'bg-muted/20 text-muted ring-muted/50',
};

interface ArtisanTooltipProps {
  listingId: number;
  artisanId?: string | null;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  method?: string | null;
  candidates?: ArtisanCandidate[] | null;
  verified?: 'correct' | 'incorrect' | null;
  onVerify?: (status: 'correct' | 'incorrect' | null) => void;
  onArtisanFixed?: (newArtisanId: string) => void;
  /** Open directly in search/assign mode (for listings with no artisan) */
  startInSearchMode?: boolean;
  /** Whether the listing is currently hidden from public views */
  adminHidden?: boolean;
  /** Callback when admin toggles hide/unhide */
  onToggleHidden?: () => void;
  /** Current cert_type for inline editing (undefined = hide section) */
  certType?: string | null;
  /** Callback when admin changes cert via pill row */
  onCertChanged?: (newCert: string | null) => void;
  children: React.ReactNode;
}

export function ArtisanTooltip({
  listingId,
  artisanId: initialArtisanId,
  confidence: initialConfidence,
  method,
  candidates,
  verified: initialVerified,
  onVerify,
  onArtisanFixed,
  startInSearchMode = false,
  adminHidden,
  onToggleHidden,
  certType: certTypeProp,
  onCertChanged,
  children,
}: ArtisanTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const [artisan, setArtisan] = useState<ArtisanDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<'correct' | 'incorrect' | null>(initialVerified ?? null);
  const [verifying, setVerifying] = useState(false);
  const termRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // State for artisan ID (can change after fix)
  const [artisanId, setArtisanId] = useState(initialArtisanId || '');
  const [confidence, setConfidence] = useState(initialConfidence || 'LOW' as const);
  const hasArtisan = !!artisanId;

  // Correction mode state — auto-open search when no artisan assigned
  const [showCorrectionSearch, setShowCorrectionSearch] = useState(startInSearchMode && !initialArtisanId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArtisanSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixSuccess, setFixSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cert editing state
  const showCertSection = certTypeProp !== undefined;
  const [currentCert, setCurrentCert] = useState<string | null>(normalizeCertValue(certTypeProp));
  const [certSaving, setCertSaving] = useState(false);
  const [certSuccess, setCertSuccess] = useState(false);

  // Suppress scroll-close briefly after mutations that trigger card re-renders
  const suppressScrollCloseRef = useRef(false);
  const suppressScrollClose = useCallback(() => {
    suppressScrollCloseRef.current = true;
    setTimeout(() => { suppressScrollCloseRef.current = false; }, 1000);
  }, []);

  // Drag state for repositioning the tooltip
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync verified prop with state
  useEffect(() => {
    setVerified(initialVerified ?? null);
  }, [initialVerified]);

  // Sync artisan ID when prop changes (e.g., after fix)
  useEffect(() => {
    setArtisanId(initialArtisanId || '');
  }, [initialArtisanId]);

  // Sync cert type when prop changes
  useEffect(() => {
    setCurrentCert(normalizeCertValue(certTypeProp));
  }, [certTypeProp]);

  // Focus search input when correction mode opens
  useEffect(() => {
    if (showCorrectionSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showCorrectionSearch]);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const debounceTimeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `/api/artisan/search?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        } else {
          const data = await response.json();
          setSearchError(data.error || 'Search failed');
          setSearchResults([]);
        }
      } catch {
        setSearchError('Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Handle cert change via pill row
  const handleCertChange = async (newCert: string | null) => {
    if (certSaving || newCert === currentCert) return;

    setCertSaving(true);
    setCertSuccess(false);

    // Optimistic update
    const prevCert = currentCert;
    setCurrentCert(newCert);

    try {
      const response = await fetch(`/api/listing/${listingId}/fix-cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert_type: newCert }),
      });

      if (response.ok) {
        setCertSuccess(true);
        suppressScrollClose();
        onCertChanged?.(newCert);

        // Also dispatch listing-refreshed event for browse card updates
        window.dispatchEvent(new CustomEvent('listing-refreshed', {
          detail: { id: listingId, cert_type: newCert },
        }));

        setTimeout(() => setCertSuccess(false), 3000);
      } else {
        // Revert on failure
        setCurrentCert(prevCert);
        const data = await response.json();
        setError(data.error || 'Failed to update designation');
      }
    } catch {
      setCurrentCert(prevCert);
      setError('Failed to update designation');
    } finally {
      setCertSaving(false);
    }
  };

  // Handle setting artisan as UNKNOWN (for later refinement)
  const handleSetUnknown = async () => {
    if (fixing) return;

    setFixing(true);
    try {
      const response = await fetch(`/api/listing/${listingId}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: 'UNKNOWN',
          confidence: 'LOW',
        }),
      });

      if (response.ok) {
        setArtisanId('UNKNOWN');
        setConfidence('LOW');
        setVerified('correct');
        setFixSuccess(true);
        setShowCorrectionSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        setArtisan(null);
        fetchedForRef.current = 'UNKNOWN'; // Prevent fetch loop
        suppressScrollClose();

        if (onArtisanFixed) {
          onArtisanFixed('UNKNOWN');
        } else {
          window.dispatchEvent(new CustomEvent('listing-refreshed', {
            detail: {
              id: listingId,
              artisan_id: 'UNKNOWN',
              artisan_confidence: 'LOW',
              artisan_method: 'ADMIN_CORRECTION',
              artisan_verified: 'correct',
              artisan_display_name: 'Unlisted artist',
            },
          }));
        }
        onVerify?.('correct');

        setTimeout(() => setFixSuccess(false), 3000);
      } else {
        const data = await response.json();
        setSearchError(data.error || 'Failed to mark as unknown');
      }
    } catch {
      setSearchError('Failed to mark as unknown');
    } finally {
      setFixing(false);
    }
  };

  // Handle selecting a search result to fix the artisan
  const handleSelectArtisan = async (result: ArtisanSearchResult) => {
    if (fixing) return;

    setFixing(true);
    try {
      const response = await fetch(`/api/listing/${listingId}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: result.code,
          confidence: 'HIGH',
        }),
      });

      if (response.ok) {
        // Update local state
        setArtisanId(result.code);
        setConfidence('HIGH');
        setVerified('correct');
        setFixSuccess(true);
        setShowCorrectionSearch(false);
        setSearchQuery('');
        setSearchResults([]);

        // Refetch artisan details for the new code
        setArtisan(null);
        fetchedForRef.current = result.code; // Mark as fetched to prevent useEffect loop
        setLoading(true);
        try {
          const artisanResponse = await fetch(`/api/artisan/${encodeURIComponent(result.code)}`);
          if (artisanResponse.ok) {
            const data = await artisanResponse.json();
            setArtisan(data.artisan);
          }
        } finally {
          setLoading(false);
        }

        // Notify parent (QuickView flow) or dispatch event directly (browse card flow)
        suppressScrollClose();
        if (onArtisanFixed) {
          onArtisanFixed(result.code);
        } else {
          // No parent callback (e.g. ArtisanTooltip on browse card) —
          // dispatch event directly so page.tsx handler updates allListings
          window.dispatchEvent(new CustomEvent('listing-refreshed', {
            detail: {
              id: listingId,
              artisan_id: result.code,
              artisan_confidence: 'HIGH',
              artisan_method: 'ADMIN_CORRECTION',
              artisan_verified: 'correct',
              artisan_display_name: result.name_romaji || result.code,
            },
          }));
        }
        onVerify?.('correct');

        // Clear success message after delay
        setTimeout(() => setFixSuccess(false), 3000);
      } else {
        const data = await response.json();
        setSearchError(data.error || 'Failed to update artisan');
      }
    } catch {
      setSearchError('Failed to update artisan');
    } finally {
      setFixing(false);
    }
  };

  // Track which artisanId we've already attempted to fetch (prevents infinite loop on 404)
  const fetchedForRef = useRef<string | null>(null);

  // Reset fetch tracking when artisanId changes (so new codes get fetched)
  const prevArtisanIdRef = useRef(artisanId);
  if (prevArtisanIdRef.current !== artisanId) {
    prevArtisanIdRef.current = artisanId;
    fetchedForRef.current = null;
  }

  // Fetch artisan details when tooltip opens (skip if no artisan assigned or UNKNOWN)
  const fetchArtisan = useCallback(async () => {
    if (!artisanId || artisanId === 'UNKNOWN' || artisan || loading) return;
    if (fetchedForRef.current === artisanId) return; // Already attempted

    fetchedForRef.current = artisanId;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artisan/${encodeURIComponent(artisanId)}`);
      if (response.ok) {
        const data = await response.json();
        setArtisan(data.artisan);
      } else if (response.status === 404) {
        setArtisan(null);
      } else {
        setError('Failed to load artisan details');
      }
    } catch {
      setError('Failed to load artisan details');
    } finally {
      setLoading(false);
    }
  }, [artisanId, artisan, loading]);

  // Fetch on open (only if artisan exists)
  useEffect(() => {
    if (isOpen && artisanId && !artisan && !loading) {
      fetchArtisan();
    }
  }, [isOpen, artisanId, artisan, loading, fetchArtisan]);

  // Auto-open search when tooltip opens in search mode with no artisan
  useEffect(() => {
    if (isOpen && startInSearchMode && !artisanId) {
      setShowCorrectionSearch(true);
    }
  }, [isOpen, startInSearchMode, artisanId]);

  // Position tooltip relative to viewport using fixed positioning.
  // This works correctly even when body scroll is locked (QuickView modal uses
  // position:fixed on body, which breaks absolute positioning offsets).
  useEffect(() => {
    if (isOpen && termRef.current) {
      const rect = termRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // w-80 = 20rem = 320px
      const padding = 12;

      // Calculate horizontal position (viewport-relative)
      let left = rect.left;
      if (rect.left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      // Show below the trigger element
      const top = rect.bottom + 8;

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        zIndex: 10001,
      });
    }
  }, [isOpen, showCorrectionSearch]);

  // Drag-to-reposition handlers (mouse)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from left mouse button, ignore clicks on buttons/inputs
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;

    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;

    const el = tooltipRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  // Drag-to-reposition handlers (touch — press-hold to move on mobile)
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const handleTouchDragStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;

    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Start drag after 200ms hold
    touchHoldTimer.current = setTimeout(() => {
      setIsDragging(true);
      isDraggingRef.current = true;

      const el = tooltipRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        dragOffsetRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
    }, 200);
  }, []);

  const handleTouchDragMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];

    // Cancel hold timer if finger moved before hold threshold
    if (touchHoldTimer.current && !isDraggingRef.current) {
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        clearTimeout(touchHoldTimer.current);
        touchHoldTimer.current = null;
      }
      return;
    }

    if (!isDraggingRef.current) return;
    e.preventDefault();

    const newLeft = touch.clientX - dragOffsetRef.current.x;
    const newTop = touch.clientY - dragOffsetRef.current.y;
    setTooltipStyle(prev => ({ ...prev, top: `${newTop}px`, left: `${newLeft}px` }));
  }, []);

  const handleTouchDragEnd = useCallback(() => {
    if (touchHoldTimer.current) {
      clearTimeout(touchHoldTimer.current);
      touchHoldTimer.current = null;
    }
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newLeft = e.clientX - dragOffsetRef.current.x;
      const newTop = e.clientY - dragOffsetRef.current.y;
      setTooltipStyle(prev => ({ ...prev, top: `${newTop}px`, left: `${newLeft}px` }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Close on escape key or scroll (fixed-position tooltip would float away on scroll)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the tooltip itself (e.g. search results)
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) return;
      // Don't close while dragging
      if (isDraggingRef.current) return;
      // Don't close right after a mutation (card re-render causes layout shift → scroll)
      if (suppressScrollCloseRef.current) return;
      setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    // Listen on capture phase to catch scroll on any container (QuickView panels, etc.)
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
    };
  }, [isOpen]);

  // Handle verification button click
  const handleVerify = async (newStatus: 'correct' | 'incorrect') => {
    if (verifying) return;

    // Toggle if clicking the same button
    const status = verified === newStatus ? null : newStatus;

    setVerifying(true);
    try {
      const response = await fetch(`/api/listing/${listingId}/verify-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: status }),
      });

      if (response.ok) {
        setVerified(status);
        suppressScrollClose();
        onVerify?.(status);

        // Show correction search when marked as incorrect
        if (status === 'incorrect') {
          setShowCorrectionSearch(true);
        } else {
          setShowCorrectionSearch(false);
          setSearchQuery('');
          setSearchResults([]);
        }
      } else {
        console.error('Failed to save verification');
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  // Confidence badge color
  const confidenceColor = {
    HIGH: 'bg-artisan-high-bg text-artisan-high',
    MEDIUM: 'bg-artisan-medium-bg text-artisan-medium',
    LOW: 'bg-artisan-low-bg text-artisan-low',
  }[confidence];

  // Create tooltip portal
  const tooltip =
    isOpen && mounted
      ? createPortal(
          <div
            ref={tooltipRef}
            style={tooltipStyle}
            className="rounded-lg bg-surface-elevated border border-border shadow-xl animate-fadeIn flex flex-col"
            role="tooltip"
            aria-live="polite"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Draggable header — grab to reposition (mouse or touch-hold) */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleTouchDragStart}
              onTouchMove={handleTouchDragMove}
              onTouchEnd={handleTouchDragEnd}
              className={`flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ touchAction: isDragging ? 'none' : 'auto' }}
            >
              <div className="flex items-center gap-2">
                {/* Drag grip */}
                <svg className="w-3 h-4 text-muted/40 shrink-0" viewBox="0 0 6 10" fill="currentColor">
                  <circle cx="1" cy="1" r="1" /><circle cx="5" cy="1" r="1" />
                  <circle cx="1" cy="5" r="1" /><circle cx="5" cy="5" r="1" />
                  <circle cx="1" cy="9" r="1" /><circle cx="5" cy="9" r="1" />
                </svg>
                <span className="text-sm font-mono font-semibold text-ink">
                  {hasArtisan ? artisanId : 'Assign Artisan'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasArtisan && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${confidenceColor}`}>
                    {confidence}
                  </span>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 -mr-1 text-muted hover:text-ink transition-colors rounded hover:bg-surface"
                  aria-label="Close tooltip"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>

            {/* Cert designation pill row — shown when certType prop is passed */}
            {showCertSection && (
              <div className="mb-3 pb-3 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                  Designation
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CERT_OPTIONS.map((opt) => {
                    const isActive = currentCert === opt.value;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleCertChange(opt.value)}
                        disabled={certSaving}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ring-1 ${
                          isActive
                            ? `${CERT_TIER_COLORS[opt.tier]} ring-2`
                            : 'bg-surface text-muted ring-border hover:ring-gold/40 hover:text-ink'
                        } ${certSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {certSuccess && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Designation updated
                  </div>
                )}
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-muted border-t-gold rounded-full animate-spin" />
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <p className="text-xs text-red-500 py-2">{error}</p>
            )}

            {/* Artisan details (skip when no artisan — show search only) */}
            {!loading && !error && hasArtisan && (
              <>
                {/* === WORKSPACE: verification, correction, UNKNOWN === */}

                {/* Verification buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleVerify('correct')}
                    disabled={verifying}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      verified === 'correct'
                        ? 'bg-green-500/20 text-green-500 border border-green-500/50'
                        : 'bg-surface border border-border text-muted hover:text-ink hover:border-green-500/50'
                    } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Correct
                  </button>
                  <button
                    onClick={() => handleVerify('incorrect')}
                    disabled={verifying}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      verified === 'incorrect'
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                        : 'bg-surface border border-border text-muted hover:text-ink hover:border-red-500/50'
                    } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Incorrect
                  </button>
                </div>

                {/* Hide/unhide listing button */}
                {onToggleHidden && (
                  <div className="mb-3">
                    <button
                      onClick={onToggleHidden}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                        adminHidden
                          ? 'bg-surface border border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400'
                          : 'bg-surface border border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400'
                      }`}
                    >
                      {adminHidden ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Unhide Listing
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          Hide Listing
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Success message after fix */}
                {fixSuccess && (
                  <div className="mb-3 py-2 px-3 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-500 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Artisan updated successfully
                  </div>
                )}

                {/* Correction search panel */}
                {showCorrectionSearch && !fixSuccess && (
                  <div className="mb-3 pb-3 border-b border-border">
                    <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                      Search for correct artisan:
                    </div>

                    {/* Search input */}
                    <div className="relative mb-2">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, code, or school..."
                        className="w-full px-3 py-2 text-xs bg-surface border border-border rounded focus:outline-none focus:border-gold/50 text-ink placeholder:text-muted"
                      />
                      {searchLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-muted border-t-gold rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Search error */}
                    {searchError && (
                      <p className="text-[10px] text-red-500 mb-2">{searchError}</p>
                    )}

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
                        {searchResults.map((result) => (
                          <button
                            key={result.code}
                            onClick={() => handleSelectArtisan(result)}
                            disabled={fixing}
                            className={`w-full text-left p-2 rounded border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                              fixing ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-mono text-xs font-medium text-gold">
                                {result.code}
                              </span>
                              <span className="text-[9px] text-muted uppercase">
                                {result.type === 'smith' ? 'Smith' : 'Tosogu'}
                              </span>
                            </div>
                            <div className="text-xs text-ink">
                              {result.name_kanji && (
                                <span className="font-jp mr-1">{result.name_kanji}</span>
                              )}
                              {result.name_romaji && (
                                <span>{result.name_romaji}</span>
                              )}
                              {result.generation && (
                                <span className="text-muted ml-1">({result.generation})</span>
                              )}
                            </div>
                            {(result.school || result.province || result.era) && (
                              <div className="text-[10px] text-muted mt-0.5">
                                {[result.school, result.province, result.era].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {(result.juyo_count > 0 || result.tokuju_count > 0) && (
                              <div className="text-[10px] text-muted mt-0.5">
                                {result.tokuju_count > 0 && `${result.tokuju_count} Tokuju`}
                                {result.tokuju_count > 0 && result.juyo_count > 0 && ' · '}
                                {result.juyo_count > 0 && `${result.juyo_count} Juyo`}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && !searchError && (
                      <p className="text-[10px] text-muted text-center py-2">
                        No artisans found for &quot;{searchQuery}&quot;
                      </p>
                    )}

                    {/* UNKNOWN option */}
                    <div className="pt-2 mt-2 border-t border-border/50">
                      <button
                        onClick={handleSetUnknown}
                        disabled={fixing}
                        className={`w-full text-left p-2 rounded border border-dashed border-muted/40 hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                          fixing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted">?</span>
                          <span className="text-[11px] text-muted">
                            Mark as <span className="font-mono font-medium">UNKNOWN</span>
                          </span>
                        </div>
                        <p className="text-[9px] text-muted/70 mt-0.5 ml-5">
                          Flag for later identification
                        </p>
                      </button>
                    </div>

                    {/* Cancel button */}
                    <button
                      onClick={() => {
                        setShowCorrectionSearch(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="mt-2 w-full py-1.5 text-[10px] text-muted hover:text-ink transition-colors"
                    >
                      Cancel search
                    </button>
                  </div>
                )}

                {/* === ARTISAN INFO & STATS === */}

                {/* Name (kanji + romaji) */}
                {artisan ? (
                  <div className="mb-3">
                    {artisan.name_kanji && (
                      <span className="text-lg font-jp text-gold mr-2">{artisan.name_kanji}</span>
                    )}
                    {artisan.name_romaji && (
                      <span className="text-sm text-ink">{artisan.name_romaji}</span>
                    )}
                    {artisan.is_school_code && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider text-muted bg-surface px-1.5 py-0.5 rounded">
                        School
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted mb-3">No artisan data found</p>
                )}

                {/* Details grid */}
                {artisan && (artisan.school || artisan.province || artisan.era) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-xs">
                    {artisan.school && (
                      <>
                        <span className="text-muted">School</span>
                        <span className="text-ink">{artisan.school}</span>
                      </>
                    )}
                    {artisan.province && (
                      <>
                        <span className="text-muted">Province</span>
                        <span className="text-ink">{artisan.province}</span>
                      </>
                    )}
                    {artisan.era && (
                      <>
                        <span className="text-muted">Era</span>
                        <span className="text-ink">{artisan.era}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Elite Standing */}
                {artisan && artisan.elite_factor !== null && artisan.elite_factor !== undefined && (
                  <div className="mb-3 py-2 border-t border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted">Elite Standing</span>
                      <span className="text-sm font-semibold text-gold">
                        {(artisan.elite_factor * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold/60 to-gold rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(artisan.elite_factor * 100 * 2, 100)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-muted mt-1">
                      {artisan.elite_count || 0} elite works / {artisan.total_items || 0} total
                    </div>
                  </div>
                )}

                {/* Certification Counts - 2 rows of 3 */}
                {artisan && (
                  artisan.kokuho_count > 0 || artisan.jubun_count > 0 || artisan.jubi_count > 0 ||
                  artisan.gyobutsu_count > 0 || artisan.tokuju_count > 0 || artisan.juyo_count > 0
                ) && (
                  <div className="mb-3 py-2 border-t border-b border-border">
                    {/* Row 1: Kokuho, Jubun, Jubi */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.kokuho_count > 0 ? 'text-gold' : 'text-muted/30'}`}>
                          {artisan.kokuho_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Kokuho</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.jubun_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                          {artisan.jubun_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Jubun</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.jubi_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                          {artisan.jubi_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Jubi</div>
                      </div>
                    </div>
                    {/* Row 2: Imperial, Tokuju, Juyo */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.gyobutsu_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                          {artisan.gyobutsu_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Imperial</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.tokuju_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                          {artisan.tokuju_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Tokuju</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${artisan.juyo_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                          {artisan.juyo_count || 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Juyo</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Match method */}
                {method && (
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Match: </span>
                    <span className="text-[10px] font-mono text-ink">{method}</span>
                  </div>
                )}

                {/* Alternative Candidates (for QA) */}
                {candidates && candidates.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                      Alternative candidates:
                    </div>
                    <div className="space-y-1.5">
                      {candidates.slice(0, 3).map((c, i) => {
                        const displayName = c.name_romaji || c.name_kanji || '';
                        const genSuffix = c.generation ? ` (${c.generation})` : '';
                        return (
                          <div key={i} className="text-[10px] border-l-2 border-border pl-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-ink">{c.artisan_id}</span>
                              {c.is_school_code && (
                                <span className="text-[8px] uppercase text-muted bg-surface px-1 rounded">school</span>
                              )}
                            </div>
                            {displayName && (
                              <div className="text-ink/80">{displayName}{genSuffix}</div>
                            )}
                            {c.school && (
                              <div className="text-muted">{c.school}</div>
                            )}
                            {c.retrieval_method && (
                              <div className="text-[9px] text-muted/70 italic">via {c.retrieval_method.replace(/_/g, ' ')}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* View Profile link */}
                <Link
                  href={`/artists/${artisanId}`}
                  onClick={() => setIsOpen(false)}
                  className="block pt-3 border-t border-border text-center text-xs font-medium text-gold hover:text-gold-light transition-colors"
                >
                  View Profile →
                </Link>
              </>
            )}

            {/* No artisan assigned — show search directly */}
            {!loading && !error && !hasArtisan && (
              <>
                <p className="text-xs text-muted mb-3">No artisan assigned to this listing.</p>

                {/* Success message after fix */}
                {fixSuccess && (
                  <div className="py-2 px-3 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-500 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Artisan assigned successfully
                  </div>
                )}

                {/* Search panel (always visible when no artisan) */}
                {!fixSuccess && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                      Search for artisan:
                    </div>

                    <div className="relative mb-2">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, code, or school..."
                        className="w-full px-3 py-2 text-xs bg-surface border border-border rounded focus:outline-none focus:border-gold/50 text-ink placeholder:text-muted"
                      />
                      {searchLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-muted border-t-gold rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {searchError && (
                      <p className="text-[10px] text-red-500 mb-2">{searchError}</p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
                        {searchResults.map((result) => (
                          <button
                            key={result.code}
                            onClick={() => handleSelectArtisan(result)}
                            disabled={fixing}
                            className={`w-full text-left p-2 rounded border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                              fixing ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-mono text-xs font-medium text-gold">
                                {result.code}
                              </span>
                              <span className="text-[9px] text-muted uppercase">
                                {result.type === 'smith' ? 'Smith' : 'Tosogu'}
                              </span>
                            </div>
                            <div className="text-xs text-ink">
                              {result.name_kanji && (
                                <span className="font-jp mr-1">{result.name_kanji}</span>
                              )}
                              {result.name_romaji && (
                                <span>{result.name_romaji}</span>
                              )}
                              {result.generation && (
                                <span className="text-muted ml-1">({result.generation})</span>
                              )}
                            </div>
                            {(result.school || result.province || result.era) && (
                              <div className="text-[10px] text-muted mt-0.5">
                                {[result.school, result.province, result.era].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {(result.juyo_count > 0 || result.tokuju_count > 0) && (
                              <div className="text-[10px] text-muted mt-0.5">
                                {result.tokuju_count > 0 && `${result.tokuju_count} Tokuju`}
                                {result.tokuju_count > 0 && result.juyo_count > 0 && ' · '}
                                {result.juyo_count > 0 && `${result.juyo_count} Juyo`}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && !searchError && (
                      <p className="text-[10px] text-muted text-center py-2">
                        No artisans found for &quot;{searchQuery}&quot;
                      </p>
                    )}

                    {/* UNKNOWN option */}
                    <div className="pt-2 mt-2 border-t border-border/50">
                      <button
                        onClick={handleSetUnknown}
                        disabled={fixing}
                        className={`w-full text-left p-2 rounded border border-dashed border-muted/40 hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                          fixing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted">?</span>
                          <span className="text-[11px] text-muted">
                            Mark as <span className="font-mono font-medium">UNKNOWN</span>
                          </span>
                        </div>
                        <p className="text-[9px] text-muted/70 mt-0.5 ml-5">
                          Flag for later identification
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>{/* end scrollable content */}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={termRef}
        type="button"
        data-artisan-tooltip
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {children}
      </button>
      {tooltip}
    </>
  );
}

export default ArtisanTooltip;
