'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

// ============================================================================
// Component
// ============================================================================

export function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Navigate and close menu - use window.location for reliable navigation
  const navigateTo = useCallback((href: string) => {
    setIsOpen(false);
    // Use window.location for reliable navigation that bypasses React state issues
    window.location.href = href;
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  if (!user) return null;

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-hover transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
            <span className="text-xs font-medium text-gold">{initials}</span>
          </div>
        )}

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-cream rounded-lg shadow-lg border border-border py-1 z-50 animate-fadeIn">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-ink truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <MenuButton
              icon={<UserIcon />}
              onClick={() => navigateTo('/profile')}
            >
              Profile
            </MenuButton>

            <MenuButton
              icon={<HeartIcon />}
              onClick={() => navigateTo('/favorites')}
            >
              Favorites
            </MenuButton>

            <MenuButton
              icon={<BellIcon />}
              onClick={() => navigateTo('/alerts')}
            >
              Alerts
            </MenuButton>

            {isAdmin && (
              <>
                <div className="h-px bg-border my-1" />
                <MenuButton
                  icon={<ShieldIcon />}
                  onClick={() => navigateTo('/admin')}
                >
                  Admin
                </MenuButton>
              </>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t border-border py-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogoutIcon />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Menu Button Component
// ============================================================================

interface MenuButtonProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}

function MenuButton({ icon, children, onClick }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors text-left"
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================================
// Icons
// ============================================================================

function UserIcon() {
  return (
    <svg
      className="w-4 h-4"
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
      className="w-4 h-4"
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

function BellIcon() {
  return (
    <svg
      className="w-4 h-4"
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
      className="w-4 h-4"
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

function LogoutIcon() {
  return (
    <svg
      className="w-4 h-4"
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
