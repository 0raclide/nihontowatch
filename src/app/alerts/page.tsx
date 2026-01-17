'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { AlertsList } from '@/components/alerts/AlertsList';
import { CreateAlertModal } from '@/components/alerts/CreateAlertModal';
import { useAlerts } from '@/hooks/useAlerts';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { createClient } from '@/lib/supabase/client';
import type { CreateAlertInput } from '@/types';

interface DealerOption {
  id: number;
  name: string;
}

export default function AlertsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [dealers, setDealers] = useState<DealerOption[]>([]);

  const {
    alerts,
    isLoading,
    error,
    createAlert,
    toggleAlert,
    deleteAlert,
    isCreating,
  } = useAlerts({ autoFetch: !!user });

  // Fetch dealers for the create modal
  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('dealers')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (data) {
          setDealers(data);
        }
      } catch (err) {
        console.error('Failed to fetch dealers:', err);
      }
    };
    fetchDealers();
  }, []);

  const handleCreateAlert = useCallback(async (input: CreateAlertInput): Promise<boolean> => {
    const result = await createAlert(input);
    return !!result;
  }, [createAlert]);

  const handleToggleAlert = useCallback(async (id: number, isActive: boolean) => {
    await toggleAlert(id, isActive);
  }, [toggleAlert]);

  const handleDeleteAlert = useCallback(async (id: number) => {
    await deleteAlert(id);
  }, [deleteAlert]);

  // Authentication loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream transition-colors">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-cream transition-colors">
          <Header />
          <main className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h2 className="font-serif text-xl text-ink mb-2">Sign in to manage alerts</h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                Get notified about price drops, new listings, and items back in stock.
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          </main>
          <BottomTabBar activeFilterCount={0} />
        </div>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-xl lg:text-2xl text-ink tracking-tight">
              My Alerts
            </h1>
            <p className="text-[12px] lg:text-[13px] text-muted mt-1">
              Get notified about price changes and new listings
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Alert
          </button>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6 lg:mb-8" />

        {/* Alerts List */}
        <AlertsList
          alerts={alerts}
          isLoading={isLoading}
          error={error}
          onToggle={handleToggleAlert}
          onDelete={handleDeleteAlert}
          onCreateClick={() => setIsModalOpen(true)}
        />
      </main>

      {/* Create Alert Modal */}
      <CreateAlertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateAlert}
        isSubmitting={isCreating}
        dealers={dealers}
      />

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
