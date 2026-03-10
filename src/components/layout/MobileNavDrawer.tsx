'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { ThemeSelector } from '@/components/ui/ThemeToggle';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useConsent } from '@/contexts/ConsentContext';
import { useLocale } from '@/i18n/LocaleContext';
import { MobileLocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { useSubscription } from '@/contexts/SubscriptionContext';

export function MobileNavDrawer() {
  const { navDrawerOpen, closeNavDrawer } = useMobileUI();
  const { user, profile, isAdmin, isDealer, signOut, isLoading: authLoading } = useAuth();
  const { openPreferences } = useConsent();
  const { t, locale } = useLocale();
  const { canAccess } = useSubscription();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  const handleSignOut = async () => {
    closeNavDrawer();
    await signOut();
  };

  const handleLoginClick = () => {
    closeNavDrawer();
    setShowLoginModal(true);
  };

  return (
    <>
      <Drawer isOpen={navDrawerOpen} onClose={closeNavDrawer} title={t('menu.title')}>
        <nav className="p-4 space-y-1">
          {/* User Section */}
          {!authLoading && (
            <>
              {user ? (
                <>
                  {/* User Info */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-gold">
                          {displayName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/50 my-2" />

                  {/* User Links */}
                  <Link
                    href="/profile"
                    onClick={closeNavDrawer}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <UserIcon />
                    {t('nav.profile')}
                  </Link>
                  <Link
                    href="/saved"
                    onClick={closeNavDrawer}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <BookmarkIcon />
                    {t('nav.saved')}
                  </Link>
                  <button
                    onClick={() => { closeNavDrawer(); setShowFeedbackModal(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <ChatBubbleIcon />
                    {t('nav.feedback')}
                  </button>
                  {canAccess('collection_access') && (
                    <Link
                      href="/vault"
                      onClick={closeNavDrawer}
                      className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                    >
                      <CollectionIcon />
                      {t('nav.collection')}
                    </Link>
                  )}
                  {canAccess('collection_access') && (
                    <Link
                      href="/showcase"
                      onClick={closeNavDrawer}
                      className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      {t('nav.showcase')}
                    </Link>
                  )}

                  {isDealer && (
                    <>
                      <Link
                        href="/dealer"
                        onClick={closeNavDrawer}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" />
                        </svg>
                        {t('nav.myListings')}
                      </Link>
                      <Link
                        href="/dealer/profile"
                        onClick={closeNavDrawer}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('dealer.profileSettings')}
                      </Link>
                    </>
                  )}

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={closeNavDrawer}
                      className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                    >
                      <ShieldIcon />
                      {t('nav.admin')}
                    </Link>
                  )}

                  <div className="h-px bg-border/50 my-2" />
                </>
              ) : (
                <>
                  {/* Sign In Button */}
                  <button
                    onClick={handleLoginClick}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-gold hover:bg-gold/10 rounded-lg transition-colors"
                  >
                    <LoginIcon />
                    {t('auth.signIn')}
                  </button>

                  <div className="h-px bg-border/50 my-2" />
                </>
              )}
            </>
          )}

          {/* Main Navigation */}
          <Link
            href="/browse"
            onClick={closeNavDrawer}
            className="flex items-center px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-text-secondary hover:bg-hover rounded-lg transition-colors"
          >
            {t('nav.browseCollection')}
          </Link>
          <Link
            href="/artists"
            onClick={closeNavDrawer}
            className="flex items-center px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-text-secondary hover:bg-hover rounded-lg transition-colors"
          >
            {t('nav.artists')}
          </Link>
          {locale !== 'ja' && (
            <Link
              href="/glossary"
              onClick={closeNavDrawer}
              className="flex items-center px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-text-secondary hover:bg-hover rounded-lg transition-colors"
            >
              {t('nav.glossary')}
            </Link>
          )}

          <div className="h-px bg-border/50 my-4" />

          <div className="px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted mb-2 block">
              {t('theme.label')}
            </span>
            <ThemeSelector />
          </div>

          <div className="h-px bg-border/50 my-4" />

          {/* Language Switcher */}
          <MobileLocaleSwitcher />

          <div className="h-px bg-border/50 my-4" />

          {/* Legal Links */}
          <div className="px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted mb-2 block">
              {t('legal.label')}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
              <Link
                href="/terms"
                onClick={closeNavDrawer}
                className="text-[12px] text-muted hover:text-ink transition-colors"
              >
                {t('legal.terms')}
              </Link>
              <Link
                href="/privacy"
                onClick={closeNavDrawer}
                className="text-[12px] text-muted hover:text-ink transition-colors"
              >
                {t('legal.privacy')}
              </Link>
              <Link
                href="/cookies"
                onClick={closeNavDrawer}
                className="text-[12px] text-muted hover:text-ink transition-colors"
              >
                {t('legal.cookies')}
              </Link>
              <button
                onClick={() => {
                  closeNavDrawer();
                  openPreferences();
                }}
                className="text-[12px] text-muted hover:text-ink transition-colors"
              >
                {t('legal.cookiePreferences')}
              </button>
            </div>
          </div>

          {/* Sign Out (at bottom for logged in users) */}
          {user && (
            <>
              <div className="h-px bg-border/50 my-4" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogoutIcon />
                {t('auth.signOut')}
              </button>
            </>
          )}
        </nav>
      </Drawer>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* Feedback Modal */}
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </>
  );
}

// ============================================================================
// Icons
// ============================================================================

function UserIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function CollectionIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
