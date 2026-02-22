'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleContext';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { notifications, unreadCount, hasSavedSearches, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handleBellClick = useCallback(() => {
    if (!user) {
      // Navigate to /saved for non-logged-in users
      window.location.href = '/saved';
      return;
    }
    setOpen((prev) => !prev);
  }, [user]);

  const handleOpenDropdown = useCallback(() => {
    if (open && unreadCount > 0) {
      markAsRead();
    }
  }, [open, unreadCount, markAsRead]);

  // Mark as read when dropdown opens
  useEffect(() => {
    handleOpenDropdown();
  }, [handleOpenDropdown]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="relative p-1 text-muted hover:text-gold transition-colors"
        aria-label={t('notifications.title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center bg-gold text-white text-[9px] font-bold rounded-full px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && user && (
        <div className="absolute right-0 mt-2 w-80 bg-cream rounded-lg shadow-lg border border-border z-50 animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h3 className="text-[13px] font-medium text-ink">{t('notifications.title')}</h3>
            <Link
              href="/saved"
              onClick={() => setOpen(false)}
              className="text-[11px] text-gold hover:underline"
            >
              {t('notifications.viewAll')}
            </Link>
          </div>

          {/* Content */}
          <div className="max-h-[320px] overflow-y-auto">
            {!hasSavedSearches ? (
              // State: No saved searches
              <EmptyState message={t('notifications.emptyNoSearches')} />
            ) : notifications.length === 0 ? (
              // State: Has searches but no notifications
              <EmptyState message={t('notifications.emptyNoMatches')} />
            ) : (
              // State: Has notifications
              <div className="divide-y divide-border/50">
                {notifications.slice(0, 5).map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onClose={() => setOpen(false)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <svg className="w-8 h-8 mx-auto mb-2 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <p className="text-[12px] text-muted leading-relaxed">{message}</p>
    </div>
  );
}

function NotificationItem({
  notification,
  onClose,
  t,
}: {
  notification: Notification;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const searchName = notification.searchName || 'Unnamed search';

  return (
    <Link
      href="/saved"
      onClick={onClose}
      className="flex gap-3 px-4 py-3 hover:bg-linen/50 transition-colors"
    >
      {/* Thumbnails */}
      <div className="flex shrink-0 -space-x-2">
        {notification.listings.length > 0 ? (
          notification.listings.slice(0, 2).map((listing, i) => (
            <div
              key={listing.id}
              className="w-10 h-10 rounded bg-linen border border-cream overflow-hidden"
              style={{ zIndex: 2 - i }}
            >
              {listing.thumbnail ? (
                <img
                  src={listing.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="w-10 h-10 rounded bg-linen flex items-center justify-center">
            <svg className="w-4 h-4 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-ink truncate">
          {t('notifications.matchedSearch', { name: searchName })}
        </p>
        {notification.listings[0] && (
          <p className="text-[11px] text-muted truncate mt-0.5">
            {notification.listings[0].title || notification.listings[0].item_type || ''}
            {notification.listings[0].dealer_name && ` · ${notification.listings[0].dealer_name}`}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted/60">
            {timeAgo(notification.created_at)}
          </span>
          {notification.matchCount > 2 && (
            <span className="text-[10px] text-gold">
              +{notification.matchCount - 2} more
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
