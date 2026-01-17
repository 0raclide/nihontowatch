'use client';

import { useState, useMemo } from 'react';
import { AlertCard } from './AlertCard';
import type { Alert, AlertType } from '@/types';

interface AlertsListProps {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  onToggle: (id: number, isActive: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onCreateClick: () => void;
}

type FilterType = 'all' | AlertType;

export function AlertsList({
  alerts,
  isLoading,
  error,
  onToggle,
  onDelete,
  onCreateClick,
}: AlertsListProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter alerts based on selected type
  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((alert) => alert.alert_type === filter);
  }, [alerts, filter]);

  // Count alerts by type
  const counts = useMemo(() => {
    const result = {
      all: alerts.length,
      price_drop: 0,
      new_listing: 0,
      back_in_stock: 0,
    };
    alerts.forEach((alert) => {
      result[alert.alert_type]++;
    });
    return result;
  }, [alerts]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[14px] text-muted">Loading alerts...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[14px] text-error mb-2">Failed to load alerts</p>
        <p className="text-[12px] text-muted">{error}</p>
      </div>
    );
  }

  // Empty state
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-ink mb-2">No alerts yet</h3>
        <p className="text-[14px] text-muted text-center max-w-sm mb-6">
          Create alerts to get notified about price drops, new listings, and items back in stock.
        </p>
        <button
          onClick={onCreateClick}
          className="px-5 py-2.5 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
        >
          Create Your First Alert
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            filter === 'all'
              ? 'bg-gold text-white'
              : 'bg-linen text-charcoal hover:bg-hover'
          }`}
        >
          All
          <span className={`ml-1.5 text-[11px] ${filter === 'all' ? 'text-white/70' : 'text-muted'}`}>
            {counts.all}
          </span>
        </button>
        <button
          onClick={() => setFilter('price_drop')}
          className={`flex-shrink-0 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            filter === 'price_drop'
              ? 'bg-gold text-white'
              : 'bg-linen text-charcoal hover:bg-hover'
          }`}
        >
          Price Drops
          <span className={`ml-1.5 text-[11px] ${filter === 'price_drop' ? 'text-white/70' : 'text-muted'}`}>
            {counts.price_drop}
          </span>
        </button>
        <button
          onClick={() => setFilter('new_listing')}
          className={`flex-shrink-0 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            filter === 'new_listing'
              ? 'bg-gold text-white'
              : 'bg-linen text-charcoal hover:bg-hover'
          }`}
        >
          New Listings
          <span className={`ml-1.5 text-[11px] ${filter === 'new_listing' ? 'text-white/70' : 'text-muted'}`}>
            {counts.new_listing}
          </span>
        </button>
        <button
          onClick={() => setFilter('back_in_stock')}
          className={`flex-shrink-0 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            filter === 'back_in_stock'
              ? 'bg-gold text-white'
              : 'bg-linen text-charcoal hover:bg-hover'
          }`}
        >
          Back in Stock
          <span className={`ml-1.5 text-[11px] ${filter === 'back_in_stock' ? 'text-white/70' : 'text-muted'}`}>
            {counts.back_in_stock}
          </span>
        </button>
      </div>

      {/* Alerts Grid */}
      {filteredAlerts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-linen/50 rounded-lg">
          <p className="text-[14px] text-muted">
            No {filter.replace('_', ' ')} alerts
          </p>
        </div>
      )}
    </div>
  );
}
