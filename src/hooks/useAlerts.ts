'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Alert, AlertType, CreateAlertInput, UpdateAlertInput } from '@/types';

interface UseAlertsOptions {
  type?: AlertType;
  activeOnly?: boolean;
  autoFetch?: boolean;
}

interface UseAlertsReturn {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  fetchAlerts: () => Promise<void>;
  createAlert: (input: CreateAlertInput) => Promise<Alert | null>;
  toggleAlert: (id: number, isActive: boolean) => Promise<Alert | null>;
  updateAlert: (id: number, updates: UpdateAlertInput) => Promise<Alert | null>;
  deleteAlert: (id: number) => Promise<boolean>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useAlerts(options: UseAlertsOptions = {}): UseAlertsReturn {
  const { type, activeOnly = false, autoFetch = true } = options;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (activeOnly) params.set('active', 'true');

      const url = `/api/alerts${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.alerts || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [type, activeOnly]);

  // Auto-fetch on mount and when options change
  useEffect(() => {
    if (autoFetch) {
      fetchAlerts();
    }
  }, [autoFetch, fetchAlerts]);

  // Create alert
  const createAlert = useCallback(async (input: CreateAlertInput): Promise<Alert | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create alert');
      }

      // Add to local state
      setAlerts((prev) => [data.alert, ...prev]);
      return data.alert;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Toggle alert active state
  const toggleAlert = useCallback(async (id: number, isActive: boolean): Promise<Alert | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: isActive }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update alert');
      }

      // Update local state
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? data.alert : alert))
      );
      return data.alert;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Update alert
  const updateAlert = useCallback(async (id: number, updates: UpdateAlertInput): Promise<Alert | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update alert');
      }

      // Update local state
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? data.alert : alert))
      );
      return data.alert;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Delete alert
  const deleteAlert = useCallback(async (id: number): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/alerts?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete alert');
      }

      // Remove from local state
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    alerts,
    isLoading,
    error,
    fetchAlerts,
    createAlert,
    toggleAlert,
    updateAlert,
    deleteAlert,
    isCreating,
    isUpdating,
    isDeleting,
  };
}
