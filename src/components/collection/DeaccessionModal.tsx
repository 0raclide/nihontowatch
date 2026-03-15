'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n/LocaleContext';

const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'GBP', 'CAD', 'CHF'] as const;

type DispositionType = 'sold' | 'consigned' | 'gifted';

const DISPOSITION_OPTIONS: { value: DispositionType; labelKey: string }[] = [
  { value: 'sold', labelKey: 'vault.deaccession.sold' },
  { value: 'consigned', labelKey: 'vault.deaccession.consigned' },
  { value: 'gifted', labelKey: 'vault.deaccession.gifted' },
];

interface DeaccessionModalProps {
  itemId: string;
  itemTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeaccessionModal({ itemId, itemTitle, onClose, onSuccess }: DeaccessionModalProps) {
  const { t } = useLocale();
  const [disposition, setDisposition] = useState<DispositionType>('sold');
  const [date, setDate] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [buyer, setBuyer] = useState('');
  const [venue, setVenue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError('');

    const updates: Record<string, unknown> = {
      holding_status: disposition,
      sold_date: date || null,
      // Clear current_value — item is leaving the collection, value is now captured by sold_price
      current_value: null,
      current_currency: null,
    };

    if (disposition === 'sold') {
      updates.sold_price = price ? parseFloat(price) : null;
      updates.sold_currency = price ? currency : null;
      updates.sold_to = buyer || null;
      updates.sold_venue = venue || null;
    } else if (disposition === 'consigned') {
      updates.sold_to = buyer || null; // consignee
      updates.sold_venue = venue || null;
    } else if (disposition === 'gifted') {
      updates.sold_to = buyer || null; // recipient
    }

    try {
      const res = await fetch(`/api/collection/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        setError('Failed to save');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  }, [disposition, date, price, currency, buyer, venue, itemId, onSuccess, onClose]);

  // Person label varies by disposition
  const personLabel = disposition === 'consigned'
    ? t('vault.deaccession.consignee')
    : disposition === 'gifted'
      ? t('vault.deaccession.recipient')
      : t('vault.deaccession.buyer');

  const inputClass = 'w-full px-3 py-2 text-sm text-ink bg-paper border border-border rounded placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] transition-all';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-cream border border-border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        {success ? (
          <div className="px-6 py-10 text-center">
            <svg className="w-8 h-8 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-ink">{t('vault.deaccession.title')}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-sm font-medium text-ink">{t('vault.deaccession.title')}</h3>
              <p className="text-xs text-muted mt-1 truncate">{itemTitle}</p>
            </div>

            <div className="px-6 pb-5 space-y-4">
              {/* Disposition pills */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5 block">
                  {t('vault.deaccession.disposition')}
                </label>
                <div className="flex gap-1.5">
                  {DISPOSITION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDisposition(opt.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        disposition === opt.value
                          ? 'bg-gold/10 border-gold text-gold font-medium'
                          : 'border-border text-muted hover:border-gold/40 hover:text-ink'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date — shown for all types */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5 block">
                  {t('vault.deaccession.date')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Price + Currency — sold only */}
              {disposition === 'sold' && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5 block">
                    {t('vault.deaccession.price')}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="px-2 py-2 text-sm text-ink bg-paper border border-border rounded focus:outline-none focus:border-gold/40 transition-all"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0"
                      className={`flex-1 ${inputClass}`}
                    />
                  </div>
                </div>
              )}

              {/* Person field — sold (buyer), consigned (consignee), gifted (recipient) */}
              <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5 block">
                    {personLabel}
                  </label>
                  <input
                    type="text"
                    value={buyer}
                    onChange={e => setBuyer(e.target.value)}
                    className={inputClass}
                  />
                </div>

              {/* Venue — sold and consigned */}
              {(disposition === 'sold' || disposition === 'consigned') && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5 block">
                    {t('vault.deaccession.venue')}
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={e => setVenue(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="text-xs text-muted hover:text-ink transition-colors"
                >
                  {t('feedback.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-gold rounded hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('vault.deaccession.confirm')}
                    </span>
                  ) : (
                    t('vault.deaccession.confirm')
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * Simple confirm dialog for returning a deaccessioned item back to the collection.
 * Only for consigned/gifted/lost items (not sold — the financial record is locked).
 */
interface ReaccessionConfirmProps {
  itemId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReaccessionConfirm({ itemId, onClose, onSuccess }: ReaccessionConfirmProps) {
  const { t } = useLocale();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/collection/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holding_status: 'owned',
          sold_date: null,
          sold_to: null,
          sold_venue: null,
        }),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setSubmitting(false);
    }
  }, [itemId, onSuccess, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-cream border border-border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 text-center">
        <p className="text-sm text-ink mb-5">{t('vault.deaccession.returnConfirm')}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            {t('feedback.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-white bg-gold rounded hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {t('vault.deaccession.returnToCollection')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
