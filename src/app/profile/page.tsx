'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { createClient } from '@/lib/supabase/client';
import { useConsent } from '@/contexts/ConsentContext';
import { useLocale } from '@/i18n/LocaleContext';

export default function ProfilePage() {
  const { user, profile, isLoading: authLoading, isAdmin, signOut, refreshProfile } = useAuth();
  const { openPreferences } = useConsent();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAllPrices, setShowAllPrices] = useState(false);
  const [isTogglingPrices, setIsTogglingPrices] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { t, locale } = useLocale();

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
      // Type assertion needed - profiles table update has partial typing issues
      type ProfilesTable = ReturnType<typeof supabase.from>;
      const { error } = await (supabase
        .from('profiles') as unknown as ProfilesTable)
        .update({ display_name: displayName.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', user.id) as { error: { message: string } | null };

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

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/user/data-export');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      const data = await response.json();

      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nihontowatch-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert(t('profile.exportError'));
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Initialize showAllPrices from profile preferences
  useEffect(() => {
    if (profile?.preferences) {
      const prefs = profile.preferences as Record<string, unknown>;
      setShowAllPrices(prefs.showAllPrices === true);
    }
  }, [profile?.preferences]);

  const handleToggleShowAllPrices = useCallback(async () => {
    const newValue = !showAllPrices;
    setShowAllPrices(newValue); // Optimistic update
    setIsTogglingPrices(true);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showAllPrices: newValue }),
      });

      if (!response.ok) {
        setShowAllPrices(!newValue); // Revert on error
      } else {
        await refreshProfile();
      }
    } catch {
      setShowAllPrices(!newValue); // Revert on error
    } finally {
      setIsTogglingPrices(false);
    }
  }, [showAllPrices, refreshProfile]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user?.email) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: deleteEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.message || data.error || 'Failed to delete account');
        return;
      }

      // Account deleted - redirect to home
      window.location.href = '/';
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  }, [user?.email, deleteEmail]);

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
              <h2 className="font-serif text-xl text-ink mb-2">{t('profile.signInToView')}</h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                {t('profile.signInDescription')}
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
              >
                {t('profile.signIn')}
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
    ? new Date(profile.created_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
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
            {t('profile.title')}
          </h1>
          <p className="text-[12px] lg:text-[13px] text-muted mt-1">
            {t('profile.subtitle')}
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
                      placeholder={t('profile.displayNamePlaceholder')}
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
                        {isSaving ? t('profile.saving') : t('profile.save')}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink transition-colors"
                      >
                        {t('profile.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="font-serif text-lg lg:text-xl text-ink truncate">
                      {profile?.display_name || t('profile.noDisplayName')}
                    </h2>
                    {isAdmin && (
                      <span className="px-2 py-0.5 text-[11px] font-medium text-gold bg-gold/10 rounded-full">
                        {t('profile.admin')}
                      </span>
                    )}
                    <button
                      onClick={handleEditClick}
                      className="text-[12px] text-muted hover:text-gold transition-colors"
                    >
                      {t('profile.edit')}
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
              <span className="text-[13px] text-muted">{t('profile.email')}</span>
              <span className="text-[14px] text-ink">{user?.email || profile?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted">{t('profile.memberSince')}</span>
              <span className="text-[14px] text-ink">{memberSince}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted">{t('profile.accountType')}</span>
              <span className="text-[14px] text-ink capitalize">{profile?.role || t('profile.user')}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8 mb-6">
          <h3 className="font-serif text-[15px] text-ink mb-4">{t('profile.quickLinks')}</h3>
          <div className="space-y-3">
            <Link
              href="/saved"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span className="text-[14px] text-ink">{t('profile.savedSearches')}</span>
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
                  <span className="text-[14px] text-ink">{t('profile.adminDashboard')}</span>
                </div>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8 mb-6">
          <h3 className="font-serif text-[15px] text-ink mb-4">{t('profile.preferences')}</h3>
          <div className="space-y-3">
            <button
              onClick={handleToggleShowAllPrices}
              disabled={isTogglingPrices}
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="text-[14px] text-ink block">{t('profile.showAllPrices')}</span>
                  <span className="text-[12px] text-muted">{t('profile.showAllPricesDesc')}</span>
                </div>
              </div>
              {/* Toggle switch */}
              <div
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  showAllPrices ? 'bg-gold' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform duration-200 ease-in-out ${
                    showAllPrices ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Privacy & Data */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8 mb-6">
          <h3 className="font-serif text-[15px] text-ink mb-4">{t('profile.privacyData')}</h3>
          <div className="space-y-3">
            {/* Cookie Preferences */}
            <button
              onClick={openPreferences}
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group text-left"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <span className="text-[14px] text-ink block">{t('profile.cookiePreferences')}</span>
                  <span className="text-[12px] text-muted">{t('profile.cookiePreferencesDesc')}</span>
                </div>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Export Data */}
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <div>
                  <span className="text-[14px] text-ink block">
                    {isExporting ? t('profile.exporting') : t('profile.exportData')}
                  </span>
                  <span className="text-[12px] text-muted">{t('profile.exportGDPR')}</span>
                </div>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Privacy Policy Link */}
            <Link
              href="/privacy"
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-linen dark:hover:bg-ink/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-muted group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <span className="text-[14px] text-ink block">{t('profile.privacyPolicy')}</span>
                  <span className="text-[12px] text-muted">{t('profile.privacyPolicyDesc')}</span>
                </div>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white dark:bg-ink/5 rounded-xl border border-border p-6 lg:p-8">
          <h3 className="font-serif text-[15px] text-ink mb-4">{t('profile.accountActions')}</h3>
          <div className="space-y-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-[14px] text-muted hover:text-ink transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('profile.signOut')}
            </button>

            <div className="pt-4 border-t border-border">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-[14px] text-red-600 hover:text-red-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('profile.deleteAccount')}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[13px] text-red-600">
                    {t('profile.deleteWarning')}
                  </p>
                  <div>
                    <label className="text-[12px] text-muted block mb-1">
                      {t('profile.typeEmailConfirm', { email: user?.email || '' })}
                    </label>
                    <input
                      type="email"
                      value={deleteEmail}
                      onChange={(e) => setDeleteEmail(e.target.value)}
                      placeholder={t('profile.emailPlaceholder')}
                      className="w-full px-3 py-2 text-[14px] border border-border rounded-lg bg-cream dark:bg-ink/10 text-ink focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                    {deleteError && (
                      <p className="text-[12px] text-red-500 mt-1">{deleteError}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteEmail.toLowerCase() !== user?.email?.toLowerCase()}
                      className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? t('profile.deleting') : t('profile.permanentlyDelete')}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteEmail('');
                        setDeleteError(null);
                      }}
                      disabled={isDeleting}
                      className="px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition-colors"
                    >
                      {t('profile.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
