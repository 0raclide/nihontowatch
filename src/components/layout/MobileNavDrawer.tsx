'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { ThemeSelector } from '@/components/ui/ThemeToggle';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';

export function MobileNavDrawer() {
  const { navDrawerOpen, closeNavDrawer } = useMobileUI();
  const { user, profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

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
      <Drawer isOpen={navDrawerOpen} onClose={closeNavDrawer} title="Menu">
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
                    Profile
                  </Link>
                  <Link
                    href="/favorites"
                    onClick={closeNavDrawer}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <HeartIcon />
                    Favorites
                  </Link>
                  <Link
                    href="/saved-searches"
                    onClick={closeNavDrawer}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <BookmarkIcon />
                    Saved Searches
                  </Link>
                  <Link
                    href="/alerts"
                    onClick={closeNavDrawer}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                  >
                    <BellIcon />
                    Alerts
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={closeNavDrawer}
                      className="flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
                    >
                      <ShieldIcon />
                      Admin
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
                    Sign In
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
            Browse Collection
          </Link>

          <div className="h-px bg-border/50 my-4" />

          <div className="px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted mb-2 block">
              Theme
            </span>
            <ThemeSelector />
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
                Sign Out
              </button>
            </>
          )}
        </nav>
      </Drawer>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
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
