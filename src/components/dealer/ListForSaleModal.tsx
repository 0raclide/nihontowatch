'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n/LocaleContext';

interface ListForSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  currentPrice?: number | null;
  currentCurrency?: string | null;
  onSuccess: (status: string, patchedFields: { price_value: number | null; price_currency: string }) => void;
}

export function ListForSaleModal({
  isOpen,
  onClose,
  listingId,
  currentPrice,
  currentCurrency,
  onSuccess,
}: ListForSaleModalProps) {
  const { t } = useLocale();
  const [priceCurrency, setPriceCurrency] = useState(currentCurrency || 'JPY');
  const [priceValue, setPriceValue] = useState(currentPrice ? String(currentPrice) : '');
  const [isAsk, setIsAsk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setPriceCurrency(currentCurrency || 'JPY');
      setPriceValue(currentPrice ? String(currentPrice) : '');
      setIsAsk(false);
      setError(null);
    }
  }, [isOpen, currentPrice, currentCurrency]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const canSubmit = isAsk || (priceValue && Number(priceValue) > 0);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/dealer/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'AVAILABLE',
          price_value: isAsk ? null : Number(priceValue),
          price_currency: priceCurrency,
        }),
      });

      if (res.ok) {
        onSuccess('AVAILABLE', {
          price_value: isAsk ? null : Number(priceValue),
          price_currency: priceCurrency,
        });
        onClose();
      } else {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(data.error || 'Request failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, listingId, isAsk, priceValue, priceCurrency, onSuccess, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-cream border border-border rounded-lg shadow-lg w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-sm font-medium text-ink">{t('dealer.setPriceTitle')}</h3>
          <p className="text-xs text-muted mt-1">{t('dealer.setPriceDesc')}</p>
        </div>

        <div className="px-6 pb-5 space-y-3">
          <div className="flex gap-2 items-center">
            <select
              value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              disabled={isAsk}
              className="px-2 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
            >
              <option value="JPY">&yen; JPY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">&euro; EUR</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={isAsk ? '' : priceValue}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setPriceValue(v);
              }}
              placeholder={isAsk ? t('dealer.askPrice') : '0'}
              disabled={isAsk}
              autoFocus
              className="flex-1 px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] disabled:opacity-50"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAsk}
              onChange={e => setIsAsk(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[12px] text-muted">{t('dealer.priceOnRequest')}</span>
          </label>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-gold rounded
                hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('dealer.listForSale')}
                </span>
              ) : (
                t('dealer.listForSale')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
