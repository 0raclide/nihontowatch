'use client';

import { useState, useEffect } from 'react';
import { CERT_OPTIONS, CERT_TIER_COLORS, normalizeCertValue } from '@/lib/admin/certConstants';

interface CertPillRowProps {
  listingId: number;
  initialCertType: string | null | undefined;
  onChanged?: (newCert: string | null) => void;
}

export function CertPillRow({ listingId, initialCertType, onChanged }: CertPillRowProps) {
  const [currentCert, setCurrentCert] = useState<string | null>(normalizeCertValue(initialCertType));
  const [certSaving, setCertSaving] = useState(false);
  const [certSuccess, setCertSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when prop changes (e.g., listing navigation in QuickView)
  useEffect(() => {
    setCurrentCert(normalizeCertValue(initialCertType));
    setCertSuccess(false);
    setError(null);
  }, [initialCertType]);

  const handleCertChange = async (newCert: string | null) => {
    if (certSaving || newCert === currentCert) return;

    setCertSaving(true);
    setCertSuccess(false);
    setError(null);
    const prevCert = currentCert;
    setCurrentCert(newCert);

    try {
      const res = await fetch(`/api/listing/${listingId}/fix-cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert_type: newCert }),
      });
      if (res.ok) {
        setCertSuccess(true);
        onChanged?.(newCert);
        setTimeout(() => setCertSuccess(false), 3000);
      } else {
        setCurrentCert(prevCert);
        const data = await res.json();
        setError(data.error || 'Failed to update designation');
      }
    } catch {
      setCurrentCert(prevCert);
      setError('Failed to update designation');
    } finally {
      setCertSaving(false);
    }
  };

  return (
    <div>
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
      {error && (
        <div className="mt-2 text-[10px] text-red-500">{error}</div>
      )}
    </div>
  );
}

export default CertPillRow;
