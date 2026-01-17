'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { AlertType, CreateAlertInput, Listing, AlertSearchCriteria } from '@/types';

interface DealerOption {
  id: number;
  name: string;
}

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAlertInput) => Promise<boolean>;
  isSubmitting?: boolean;
  // Pre-populated data when creating from a listing
  listing?: Listing | null;
  // Available dealers for new listing alerts
  dealers?: DealerOption[];
}

// Item type options for new listing alerts
const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'Any type' },
  { value: 'katana', label: 'Katana' },
  { value: 'wakizashi', label: 'Wakizashi' },
  { value: 'tanto', label: 'Tanto' },
  { value: 'tachi', label: 'Tachi' },
  { value: 'naginata', label: 'Naginata' },
  { value: 'yari', label: 'Yari' },
  { value: 'tsuba', label: 'Tsuba' },
  { value: 'fuchi-kashira', label: 'Fuchi-Kashira' },
  { value: 'kozuka', label: 'Kozuka' },
  { value: 'menuki', label: 'Menuki' },
  { value: 'koshirae', label: 'Koshirae' },
];

// Certification options for new listing alerts
const CERT_OPTIONS = [
  { value: '', label: 'Any certification' },
  { value: 'Juyo', label: 'Juyo' },
  { value: 'Tokuju', label: 'Tokubetsu Juyo' },
  { value: 'TokuHozon', label: 'Tokubetsu Hozon' },
  { value: 'Hozon', label: 'Hozon' },
];

export function CreateAlertModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  listing,
  dealers = [],
}: CreateAlertModalProps) {
  // Determine initial alert type based on listing state
  const getInitialAlertType = useCallback((): AlertType => {
    if (!listing) return 'new_listing';
    // If item is sold, suggest back_in_stock
    if (listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold') {
      return 'back_in_stock';
    }
    return 'price_drop';
  }, [listing]);

  const [alertType, setAlertType] = useState<AlertType>(getInitialAlertType());
  const [targetPrice, setTargetPrice] = useState<string>('');

  // Search criteria for new_listing alerts
  const [itemType, setItemType] = useState('');
  const [dealerId, setDealerId] = useState<string>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [certType, setCertType] = useState('');

  useBodyScrollLock(isOpen);

  // Reset form when modal opens or listing changes
  useEffect(() => {
    if (isOpen) {
      setAlertType(getInitialAlertType());
      setTargetPrice('');
      setItemType('');
      setDealerId('');
      setMinPrice('');
      setMaxPrice('');
      setCertType('');
    }
  }, [isOpen, getInitialAlertType]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateAlertInput = {
      alert_type: alertType,
    };

    if (alertType === 'price_drop' || alertType === 'back_in_stock') {
      if (!listing) return;
      input.listing_id = listing.id;
      if (alertType === 'price_drop' && targetPrice) {
        input.target_price = parseFloat(targetPrice);
      }
    }

    if (alertType === 'new_listing') {
      const criteria: AlertSearchCriteria = {};
      if (itemType) criteria.item_type = itemType;
      if (dealerId) criteria.dealer_id = parseInt(dealerId);
      if (minPrice) criteria.min_price = parseInt(minPrice);
      if (maxPrice) criteria.max_price = parseInt(maxPrice);
      if (certType) criteria.cert_type = certType;
      input.search_criteria = criteria;
    }

    const success = await onSubmit(input);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isSold = listing && (listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold');

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-cream rounded-lg shadow-xl animate-slideUp max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 id="modal-title" className="font-serif text-lg text-ink">
              Create Alert
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Alert Type Selection */}
              <div>
                <label className="block text-[12px] uppercase tracking-wider text-muted mb-3">
                  Alert Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {listing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setAlertType('price_drop')}
                        disabled={!!isSold}
                        className={`px-3 py-3 text-[13px] font-medium rounded-lg transition-all ${
                          alertType === 'price_drop'
                            ? 'bg-gold text-white'
                            : isSold
                            ? 'bg-linen text-muted/50 cursor-not-allowed'
                            : 'bg-linen text-charcoal hover:bg-hover'
                        }`}
                      >
                        Price Drop
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlertType('back_in_stock')}
                        disabled={!isSold}
                        className={`px-3 py-3 text-[13px] font-medium rounded-lg transition-all ${
                          alertType === 'back_in_stock'
                            ? 'bg-gold text-white'
                            : !isSold
                            ? 'bg-linen text-muted/50 cursor-not-allowed'
                            : 'bg-linen text-charcoal hover:bg-hover'
                        }`}
                      >
                        Back in Stock
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAlertType('new_listing')}
                      className={`col-span-3 px-3 py-3 text-[13px] font-medium rounded-lg transition-all ${
                        alertType === 'new_listing'
                          ? 'bg-gold text-white'
                          : 'bg-linen text-charcoal hover:bg-hover'
                      }`}
                    >
                      New Listing
                    </button>
                  )}
                </div>
              </div>

              {/* Listing Info (for price_drop and back_in_stock) */}
              {listing && (alertType === 'price_drop' || alertType === 'back_in_stock') && (
                <div className="bg-linen rounded-lg p-4">
                  <p className="text-[13px] text-charcoal font-medium line-clamp-2">
                    {listing.title}
                  </p>
                  {listing.price_value && alertType === 'price_drop' && (
                    <p className="text-[12px] text-muted mt-1">
                      Current price: {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: listing.price_currency || 'JPY',
                        maximumFractionDigits: 0,
                      }).format(listing.price_value)}
                    </p>
                  )}
                </div>
              )}

              {/* Target Price (for price_drop) */}
              {alertType === 'price_drop' && (
                <div>
                  <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
                    Target Price (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[14px]">
                      {listing?.price_currency === 'USD' ? '$' : listing?.price_currency === 'EUR' ? 'E' : '¥'}
                    </span>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="Any price drop"
                      className="w-full pl-8 pr-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Leave empty to be notified of any price drop
                  </p>
                </div>
              )}

              {/* Search Criteria (for new_listing) */}
              {alertType === 'new_listing' && (
                <div className="space-y-4">
                  {/* Item Type */}
                  <div>
                    <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
                      Item Type
                    </label>
                    <select
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                      className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink focus:outline-none focus:border-gold"
                    >
                      {ITEM_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dealer */}
                  {dealers.length > 0 && (
                    <div>
                      <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
                        Dealer
                      </label>
                      <select
                        value={dealerId}
                        onChange={(e) => setDealerId(e.target.value)}
                        className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink focus:outline-none focus:border-gold"
                      >
                        <option value="">Any dealer</option>
                        {dealers.map((dealer) => (
                          <option key={dealer.id} value={dealer.id}>
                            {dealer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Price Range */}
                  <div>
                    <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
                      Price Range (JPY)
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="Min"
                        className="flex-1 px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
                      />
                      <span className="flex items-center text-muted">-</span>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="Max"
                        className="flex-1 px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  {/* Certification */}
                  <div>
                    <label className="block text-[12px] uppercase tracking-wider text-muted mb-2">
                      Certification
                    </label>
                    <select
                      value={certType}
                      onChange={(e) => setCertType(e.target.value)}
                      className="w-full px-4 py-3 bg-paper border-2 border-border rounded-lg text-[14px] text-ink focus:outline-none focus:border-gold"
                    >
                      {CERT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Alert Type Description */}
              <div className="bg-linen/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                    {alertType === 'price_drop' && (
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                    {alertType === 'new_listing' && (
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {alertType === 'back_in_stock' && (
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] text-ink font-medium">
                      {alertType === 'price_drop' && 'Price Drop Alert'}
                      {alertType === 'new_listing' && 'New Listing Alert'}
                      {alertType === 'back_in_stock' && 'Back in Stock Alert'}
                    </p>
                    <p className="text-[12px] text-muted mt-0.5">
                      {alertType === 'price_drop' && 'Get notified when the price drops'}
                      {alertType === 'new_listing' && 'Get notified when new items match your criteria'}
                      {alertType === 'back_in_stock' && 'Get notified when this item becomes available again'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border bg-linen/50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border rounded-lg hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Alert'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
