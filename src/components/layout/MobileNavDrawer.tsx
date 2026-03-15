'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useConsent } from '@/contexts/ConsentContext';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { VaultIcon } from '@/components/icons/VaultIcon';
import { useTheme, THEMES, type ThemeName, type ThemeSetting } from '@/contexts/ThemeContext';
import { useCardStyle, type CardStyle } from '@/hooks/useCardStyle';

// Shared link style for nav items
const navItemClass =
  'flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-text-secondary hover:bg-hover rounded-lg transition-colors';

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

                  {/* Vault — compact gold row, right after identity */}
                  {canAccess('collection_access') && (
                    <Link
                      href="/vault"
                      onClick={closeNavDrawer}
                      className="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-gold hover:bg-gold/10 rounded-lg transition-colors"
                    >
                      <VaultIcon className="w-5 h-5" />
                      {t('nav.collection')}
                    </Link>
                  )}

                  <div className="h-px bg-border/50 my-2" />
                </>
              ) : (
                <>
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

          {/* Content Navigation */}
          <Link href="/browse" onClick={closeNavDrawer} className={navItemClass}>
            <BrowseIcon />
            {t('nav.browseCollection')}
          </Link>
          <Link href="/artists" onClick={closeNavDrawer} className={navItemClass}>
            <ArtistsIcon />
            {t('nav.artists')}
          </Link>
          {canAccess('collection_access') && (
            <Link href="/showcase" onClick={closeNavDrawer} className={navItemClass}>
              <GalleryIcon />
              {t('nav.showcase')}
            </Link>
          )}
          {locale !== 'ja' && (
            <Link href="/glossary" onClick={closeNavDrawer} className={navItemClass}>
              <GlossaryIcon />
              {t('nav.glossary')}
            </Link>
          )}

          {/* Activity / engagement section (auth-only) */}
          {user && (
            <>
              <div className="h-px bg-border/50 my-2" />

              <Link href="/saved" onClick={closeNavDrawer} className={navItemClass}>
                <BookmarkIcon />
                {t('nav.saved')}
              </Link>
              <button
                onClick={() => { closeNavDrawer(); setShowFeedbackModal(true); }}
                className={`w-full ${navItemClass}`}
              >
                <ChatBubbleIcon />
                {t('nav.feedback')}
              </button>
            </>
          )}

          {/* Settings & preferences (auth-only) */}
          {user && (
            <>
              <div className="h-px bg-border/50 my-2" />

              <Link href="/profile" onClick={closeNavDrawer} className={navItemClass}>
                <UserIcon />
                {t('nav.profile')}
              </Link>

              {isDealer && (
                <Link href="/dealer/profile" onClick={closeNavDrawer} className={navItemClass}>
                  <SettingsIcon />
                  {t('dealer.profileSettings')}
                </Link>
              )}

              {isAdmin && (
                <Link href="/admin" onClick={closeNavDrawer} className={navItemClass}>
                  <ShieldIcon />
                  {t('nav.admin')}
                </Link>
              )}
            </>
          )}

          {/* Theme & Language — always visible */}
          <CompactThemeRow isAdmin={isAdmin} />
          <CompactLanguageRow />

          <div className="h-px bg-border/50 my-2" />

          {/* Legal — single compact line */}
          <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-muted">
            <Link href="/terms" onClick={closeNavDrawer} className="hover:text-ink transition-colors">
              {t('legal.terms')}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy" onClick={closeNavDrawer} className="hover:text-ink transition-colors">
              {t('legal.privacy')}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/cookies" onClick={closeNavDrawer} className="hover:text-ink transition-colors">
              {t('legal.cookies')}
            </Link>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => { closeNavDrawer(); openPreferences(); }}
              className="hover:text-ink transition-colors"
            >
              {t('legal.cookiePreferences')}
            </button>
          </div>

          {/* Sign Out */}
          {user && (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <LogoutIcon />
              {t('auth.signOut')}
            </button>
          )}
        </nav>
      </Drawer>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </>
  );
}

// ============================================================================
// Inline Components
// ============================================================================

function CompactThemeRow({ isAdmin }: { isAdmin: boolean }) {
  const { themeSetting, setTheme } = useTheme();
  const { cardStyle, setCardStyle } = useCardStyle();
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const currentLabel = !mounted
    ? '...'
    : themeSetting === 'system'
      ? 'System'
      : THEMES[themeSetting as ThemeName]?.label ?? 'System';

  const themeEntries = Object.entries(THEMES) as [ThemeName, (typeof THEMES)[ThemeName]][];

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full ${navItemClass} justify-between`}
      >
        <span className="flex items-center gap-3">
          <PaletteIcon />
          {t('theme.label')}
        </span>
        <span className="flex items-center gap-1.5 text-muted text-[12px]">
          {currentLabel}
          <ChevronIcon expanded={expanded} />
        </span>
      </button>

      {expanded && (
        <div className="ml-8 mr-2 space-y-0.5">
          {/* System option */}
          <ThemeOption
            selected={themeSetting === 'system'}
            onClick={() => { setTheme('system'); setExpanded(false); }}
            label="System"
            preview={
              <div className="w-4 h-4 rounded-full border border-border bg-surface flex items-center justify-center">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            }
          />

          {/* Theme options */}
          {themeEntries.map(([name, config]) => (
            <ThemeOption
              key={name}
              selected={themeSetting === name}
              onClick={() => { setTheme(name); setExpanded(false); }}
              label={config.label}
              preview={
                <div
                  className="w-4 h-4 rounded-full border border-border flex items-center justify-center"
                  style={{ backgroundColor: config.previewBg }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.previewAccent }} />
                </div>
              }
            />
          ))}

          {/* Card Style — admin only */}
          {isAdmin && (
            <>
              <div className="h-px bg-border/30 my-1.5" />
              <div className="px-2 py-1">
                <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
                  {t('cardStyle.label')}
                </span>
              </div>
              {([
                { key: 'standard' as CardStyle, labelKey: 'cardStyle.standard', icon: '▫' },
                { key: 'collector' as CardStyle, labelKey: 'cardStyle.collector', icon: '◆' },
              ]).map(({ key, labelKey, icon }) => (
                <ThemeOption
                  key={key}
                  selected={cardStyle === key}
                  onClick={() => setCardStyle(key)}
                  label={t(labelKey)}
                  preview={
                    <span className="w-4 h-4 flex items-center justify-center text-muted text-xs" aria-hidden="true">
                      {icon}
                    </span>
                  }
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeOption({
  selected,
  onClick,
  label,
  preview,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-[13px] transition-colors ${
        selected ? 'bg-accent/10 text-accent' : 'hover:bg-hover text-text-secondary'
      }`}
    >
      {preview}
      <span>{label}</span>
      {selected && <CheckIcon />}
    </button>
  );
}

function CompactLanguageRow() {
  const { locale, setLocale, t } = useLocale();

  const currentLabel = locale === 'en' ? 'English' : '日本語';

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'ja' : 'en')}
      className={`w-full ${navItemClass} justify-between`}
      aria-label={locale === 'en' ? 'Switch to Japanese' : 'Switch to English'}
    >
      <span className="flex items-center gap-3">
        <LanguageIcon />
        {t('language.label')}
      </span>
      <span className="text-muted text-[12px]">{currentLabel}</span>
    </button>
  );
}

// ============================================================================
// Icons
// ============================================================================

function BrowseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ArtistsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}

function GlossaryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 ml-auto text-accent" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
