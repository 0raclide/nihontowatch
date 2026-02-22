'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

interface NotificationListing {
  id: number;
  title: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  dealer_name: string | null;
  thumbnail: string | null;
}

export interface Notification {
  id: string;
  savedSearchId: string;
  searchName: string | null;
  listings: NotificationListing[];
  matchCount: number;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  hasSavedSearches: boolean;
  isLoading: boolean;
  /** ISO timestamp of when user last marked notifications as read (null = never) */
  readSince: string | null;
  markAsRead: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'lastSavedPageVisit';
const POLL_INTERVAL = 60_000; // 60 seconds

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasSavedSearches, setHasSavedSearches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [readSince, setReadSince] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  );
  const [didInitialFetch, setDidInitialFetch] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSavedSearchesRef = useRef(false);

  // Keep ref in sync so the interval callback sees the latest value
  hasSavedSearchesRef.current = hasSavedSearches;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const since = localStorage.getItem(STORAGE_KEY) || '';
      const url = `/api/notifications/recent${since ? `?since=${encodeURIComponent(since)}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) return;

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setHasSavedSearches(data.hasSavedSearches || false);
    } catch {
      // Silently fail — notification polling shouldn't crash the app
    } finally {
      setIsLoading(false);
      setDidInitialFetch(true);
    }
  }, [user]);

  const markAsRead = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    setReadSince(now);
    setUnreadCount(0);
  }, []);

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setHasSavedSearches(false);
      setDidInitialFetch(false);
      return;
    }

    // Fetch on mount when logged in
    fetchNotifications();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, fetchNotifications]);

  // Start polling only after initial fetch confirms user has saved searches
  useEffect(() => {
    if (!user || !didInitialFetch) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only poll if user actually has saved searches
    if (!hasSavedSearches) return;

    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, didInitialFetch, hasSavedSearches, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    hasSavedSearches,
    isLoading,
    readSince,
    markAsRead,
    refresh: fetchNotifications,
  };
}
