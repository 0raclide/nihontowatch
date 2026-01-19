/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - Supabase types have issues with profiles table updates
'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const { user, profile, isLoading: authLoading, isAdmin, signOut, refreshProfile } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleEditClick = useCallback(() => {
    setDisplayName(profile?.display_name || '');
    setIsEditing(true);
    setSaveError(null);
  }, [profile?.display_name]);

  const handleSaveDisplayName = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null, updated_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', user.id);

      if (error) {
        setSaveError(error.message);
        return;
      }

      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [user, displayName, refreshProfile]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // Authentication loading state - also show loading if we have cached profile but no user yet
  // This handles the case where auth is still initializing during page navigation
  if (authLoading || (profile && !user)) {
    return (
      <div className="min-h-screen bg-cream transition-colors">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not authenticated state - only show if we definitely have no user AND no cached profile
  if (!user && !profile) {
    return (
      <>
        <div className="min-h-screen bg-cream transition-colors">
          <Header />
          <main className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="font-serif text-xl text-ink mb-2">Sign in to view your profile</h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                Create an account or sign in to manage your profile and preferences.
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

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[800px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="font-serif text-xl lg:text-2xl text-ink tracking-tight">
            My Profile
          </h1>
          <p className="text-[12px] lg:text-[13px] text-muted mt-1">
            Manage your account settings
          </p>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6 lg:mb-8" />

        {/* Profile Card */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8 mb-6">
          {/* Avatar & Name */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-gold/20 to-gold/40 flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl lg:text-3xl font-serif text-gold">
                  {(profile?.display_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isEditing ? (
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter display name"
                      className="w-full px-3 py-2 text-[15px] border border-border rounded-lg bg-cream dark:bg-ink/10 text-ink focus:outline-none focus:ring-2 focus:ring-gold/50"
                      autoFocus
                    />
                    {saveError && (
                      <p className="text-[12px] text-red-500 mt-1">{saveError}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSaveDisplayName}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="font-serif text-lg lg:text-xl text-ink truncate">
                      {profile?.display_name || 'No display name'}
                    </h2>
                    {isAdmin && (
                      <span className="px-2 py-0.5 text-[11px] font-medium text-gold bg-gold/10 rounded-full">
                        Admin
                      </span>
                    )}
                    <button
                      onClick={handleEditClick}
                      className="text-[12px] text-muted hover:text-gold transition-colors"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
              <p className="text-[14px] text-muted mt-1 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Info Rows */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted">Email</span>
              <span className="text-[14px] text-ink">{user?.email || profile?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted">Member since</span>
              <span className="text-[14px] text-ink">{memberSince}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted">Account type</span>
              <span className="text-[14px] text-ink capitalize">{profile?.role || 'User'}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8 mb-6">
          <h3 className="font-serif text-[15px] text-ink mb-4">Quick Links</h3>
          <div className="space-y-3">
            <Link
              href="/saved"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span className="text-[14px] text-ink">Saved Searches & Watchlist</span>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[14px] text-ink">Admin Dashboard</span>
                </div>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Sign Out */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8">
          <h3 className="font-serif text-[15px] text-ink mb-4">Account Actions</h3>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[14px] text-red-600 hover:text-red-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
