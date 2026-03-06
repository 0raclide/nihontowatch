'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleContext';
import { DealerProfileView } from '@/components/dealer/DealerProfileView';
import { ProfileCompleteness } from '@/components/dealer/ProfileCompleteness';
import type { Dealer, Listing } from '@/types';

interface ProfileData {
  dealer: Dealer;
  profileCompleteness: { score: number; missing: string[] };
}

interface PreviewData {
  stats: { totalListings: number; typeCounts: { type: string; count: number }[] };
  featuredListings: Listing[];
}

export function DealerPreviewClient() {
  const { t } = useLocale();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, previewRes] = await Promise.all([
          fetch('/api/dealer/profile'),
          fetch('/api/dealer/preview'),
        ]);

        if (!profileRes.ok) {
          setError(profileRes.status === 401 ? 'Unauthorized' : 'Failed to load profile');
          return;
        }
        if (!previewRes.ok) {
          setError('Failed to load preview data');
          return;
        }

        const [profile, preview] = await Promise.all([
          profileRes.json() as Promise<ProfileData>,
          previewRes.json() as Promise<PreviewData>,
        ]);

        setProfileData(profile);
        setPreviewData(preview);
      } catch {
        setError('Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profileData || !previewData) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted text-[14px]">{error || 'Failed to load preview'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Preview Banner */}
      <div className="sticky top-0 lg:top-[var(--header-visible-h,80px)] z-30 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 transition-[top] duration-0">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[13px] text-amber-800 dark:text-amber-300 font-medium">
              {t('dealer.previewBanner')}
            </span>
          </div>
          <Link
            href="/dealer/profile"
            className="text-[12px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            {t('dealer.previewEditProfile')}
          </Link>
        </div>
      </div>

      {/* Profile View */}
      <DealerProfileView
        dealer={profileData.dealer}
        stats={previewData.stats}
        featuredListings={previewData.featuredListings}
      />

      {/* Profile Completeness (preview-only) */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <ProfileCompleteness
          score={profileData.profileCompleteness.score}
          missing={profileData.profileCompleteness.missing}
        />
      </div>
    </div>
  );
}
