'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleContext';
import { ProfileImageUpload } from '@/components/dealer/ProfileImageUpload';
import { AccentColorPicker } from '@/components/dealer/AccentColorPicker';
import { SpecializationPills } from '@/components/dealer/SpecializationPills';
import { ProfileCompleteness } from '@/components/dealer/ProfileCompleteness';
import type { Dealer } from '@/types';

const DEBOUNCE_MS = 800;

interface ProfileData {
  dealer: Dealer;
  profileCompleteness: { score: number; missing: string[] };
}

export function DealerProfileClient() {
  const { t } = useLocale();
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const lastSavedRef = useRef<Partial<Dealer>>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch profile data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dealer/profile');
        if (!res.ok) {
          setFetchError(res.status === 401 ? 'Unauthorized' : 'Failed to load profile');
          return;
        }
        const json: ProfileData = await res.json();
        setData(json);
        lastSavedRef.current = { ...json.dealer };
      } catch {
        setFetchError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const saveChanges = useCallback(async (dealer: Partial<Dealer>) => {
    // Compute diff from lastSaved
    const diff: Record<string, unknown> = {};
    const saved = lastSavedRef.current;
    for (const key of Object.keys(dealer) as (keyof Dealer)[]) {
      const newVal = dealer[key];
      const oldVal = saved[key];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        diff[key] = newVal;
      }
    }

    if (Object.keys(diff).length === 0) return;

    try {
      const res = await fetch('/api/dealer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      });

      if (!res.ok) {
        showToast('error', t('dealer.saveFailed'));
        return;
      }

      const json: ProfileData = await res.json();
      lastSavedRef.current = { ...json.dealer };
      setData((prev) => prev ? { ...prev, profileCompleteness: json.profileCompleteness } : null);
      showToast('success', t('dealer.saved'));
    } catch {
      showToast('error', t('dealer.saveFailed'));
    }
  }, [showToast, t]);

  const updateField = useCallback(<K extends keyof Dealer>(field: K, value: Dealer[K]) => {
    setData((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, dealer: { ...prev.dealer, [field]: value } };

      // Debounce auto-save
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        saveChanges(updated.dealer);
      }, DEBOUNCE_MS);

      return updated;
    });
  }, [saveChanges]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted text-[14px]">{fetchError || 'Failed to load profile'}</p>
      </div>
    );
  }

  const { dealer, profileCompleteness } = data;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 lg:top-[var(--header-visible-h,80px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border/30 transition-[top] duration-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dealer"
              className="text-muted hover:text-gold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-[16px] font-medium">{t('dealer.profileSettings')}</h1>
          </div>
        </div>
      </div>

      {/* Form sections */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-36 lg:pb-8 space-y-4">

        {/* Section 1: Visual Identity */}
        <details open className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 text-[13px] font-semibold text-text-secondary select-none">
            {t('dealer.visualIdentity')}
            <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-4">
            <ProfileImageUpload
              type="banner"
              currentUrl={dealer.banner_url ?? null}
              onUploaded={(url) => updateField('banner_url', url)}
              onRemoved={() => updateField('banner_url', null)}
              maxSizeMb={5}
              aspectHint="16:9"
            />
            <ProfileImageUpload
              type="logo"
              currentUrl={dealer.logo_url ?? null}
              onUploaded={(url) => updateField('logo_url', url)}
              onRemoved={() => updateField('logo_url', null)}
              maxSizeMb={2}
              aspectHint="1:1"
            />
            <AccentColorPicker
              value={dealer.accent_color || '#c4a35a'}
              onChange={(hex) => updateField('accent_color', hex)}
            />
          </div>
        </details>

        <div className="h-px bg-border/30" />

        {/* Section 2: About Your Shop */}
        <details open className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 text-[13px] font-semibold text-text-secondary select-none">
            {t('dealer.aboutYourShop')}
            <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1 block">{t('dealer.bioEn')}</label>
              <textarea
                value={dealer.bio_en || ''}
                onChange={(e) => updateField('bio_en', e.target.value || null)}
                placeholder={t('dealer.bioEnPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 text-[13px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1 block">{t('dealer.bioJa')}</label>
              <textarea
                value={dealer.bio_ja || ''}
                onChange={(e) => updateField('bio_ja', e.target.value || null)}
                placeholder={t('dealer.bioJaPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 text-[13px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1 block">{t('dealer.foundedYear')}</label>
              <input
                type="number"
                value={dealer.founded_year ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  updateField('founded_year', val);
                }}
                min={1600}
                max={2026}
                className="w-32 px-3 py-2 text-[13px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none"
              />
            </div>
            <SpecializationPills
              selected={dealer.specializations || []}
              onChange={(values) => updateField('specializations', values)}
            />
          </div>
        </details>

        <div className="h-px bg-border/30" />

        {/* Section 3: Contact & Location */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 text-[13px] font-semibold text-text-secondary select-none">
            {t('dealer.contactLocation')}
            <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-3">
            <FieldInput label={t('dealer.email')} value={dealer.contact_email} onChange={(v) => updateField('contact_email', v)} type="email" />
            <FieldInput label={t('dealer.phoneNumber')} value={dealer.phone} onChange={(v) => updateField('phone', v)} type="tel" />
            <div>
              <FieldInput label={t('dealer.lineId')} value={dealer.line_id} onChange={(v) => updateField('line_id', v)} />
              <p className="text-[10px] text-muted mt-0.5">{t('dealer.lineIdHelp')}</p>
            </div>
            <FieldInput label={t('dealer.website')} value={dealer.contact_page_url} onChange={(v) => updateField('contact_page_url', v)} type="url" />
            <FieldInput label={t('dealer.instagram')} value={dealer.instagram_url} onChange={(v) => updateField('instagram_url', v)} placeholder="@handle or URL" />
            <div className="h-px bg-border/20 my-2" />
            <FieldInput label={t('dealer.cityLabel')} value={dealer.city} onChange={(v) => updateField('city', v)} placeholder={t('dealer.cityPlaceholder')} />
            <FieldInput label={t('dealer.addressLabel')} value={dealer.address} onChange={(v) => updateField('address', v)} />
            <FieldInput label="Postal Code" value={dealer.postal_code} onChange={(v) => updateField('postal_code', v)} />
            <label className="flex items-center gap-2 text-[12px] text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={dealer.address_visible ?? false}
                onChange={(e) => updateField('address_visible', e.target.checked)}
                className="rounded border-border/50"
              />
              {t('dealer.showAddressOnPage')}
            </label>
          </div>
        </details>

        <div className="h-px bg-border/30" />

        {/* Section 4: Policies */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 text-[13px] font-semibold text-text-secondary select-none">
            {t('dealer.policies')}
            <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-4">
            {/* Ships international */}
            <TriStatePills
              label={t('dealer.shipsInternational')}
              value={dealer.ships_international}
              onChange={(v) => updateField('ships_international', v)}
            />

            {/* Payment methods */}
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">{t('dealer.paymentMethods')}</label>
              <div className="space-y-1.5">
                <CheckboxField label={t('dealer.wireTransfer')} checked={dealer.accepts_wire_transfer ?? false} onChange={(v) => updateField('accepts_wire_transfer', v)} />
                <CheckboxField label="PayPal" checked={dealer.accepts_paypal ?? false} onChange={(v) => updateField('accepts_paypal', v)} />
                <CheckboxField label="Credit Card" checked={dealer.accepts_credit_card ?? false} onChange={(v) => updateField('accepts_credit_card', v)} />
              </div>
            </div>

            {/* Deposit */}
            <div>
              <CheckboxField
                label={t('dealer.depositRequired')}
                checked={dealer.requires_deposit ?? false}
                onChange={(v) => updateField('requires_deposit', v)}
              />
              {dealer.requires_deposit && (
                <div className="mt-2 ml-6">
                  <label className="text-[11px] text-muted">{t('dealer.depositPercentage')}</label>
                  <input
                    type="number"
                    value={dealer.deposit_percentage ?? ''}
                    onChange={(e) => updateField('deposit_percentage', e.target.value ? Number(e.target.value) : null)}
                    min={0}
                    max={100}
                    className="w-20 ml-2 px-2 py-1 text-[12px] bg-hover border border-border/50 rounded focus:border-gold/50 focus:outline-none"
                  />
                  <span className="text-[11px] text-muted ml-1">%</span>
                </div>
              )}
            </div>

            {/* English support */}
            <TriStatePills
              label={t('dealer.englishSupport')}
              value={dealer.english_support}
              onChange={(v) => updateField('english_support', v)}
            />

            {/* Return policy */}
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1 block">{t('dealer.returnPolicy')}</label>
              <textarea
                value={dealer.return_policy || ''}
                onChange={(e) => updateField('return_policy', e.target.value || null)}
                rows={3}
                className="w-full px-3 py-2 text-[13px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none resize-none"
              />
            </div>
          </div>
        </details>

        <div className="h-px bg-border/30" />

        {/* Section 5: Credentials */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 text-[13px] font-semibold text-text-secondary select-none">
            {t('dealer.membershipsCreds')}
            <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-4">
            <MembershipTags
              values={dealer.memberships || []}
              onChange={(values) => updateField('memberships', values)}
              helpText={t('dealer.membershipsHelp')}
            />
            <ProfileImageUpload
              type="shop"
              currentUrl={dealer.shop_photo_url ?? null}
              onUploaded={(url) => updateField('shop_photo_url', url)}
              onRemoved={() => updateField('shop_photo_url', null)}
              maxSizeMb={5}
              aspectHint="4:3"
            />
          </div>
        </details>

        <div className="h-px bg-border/30" />

        {/* Profile completeness — always visible */}
        <ProfileCompleteness score={profileCompleteness.score} missing={profileCompleteness.missing} />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-[13px] font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ──── Reusable sub-components ──── */

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value?: string | null;
  onChange: (val: string | null) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-text-secondary mb-1 block">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-[13px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none"
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-text-secondary cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border/50"
      />
      {label}
    </label>
  );
}

function TriStatePills({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: boolean | null;
  onChange: (val: boolean | null) => void;
}) {
  const options: { v: boolean | null; text: string }[] = [
    { v: true, text: 'Yes' },
    { v: false, text: 'No' },
    { v: null, text: 'Not set' },
  ];

  return (
    <div>
      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">{label}</label>
      <div className="flex gap-1.5">
        {options.map(({ v, text }) => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
              value === v
                ? 'bg-gold/10 text-gold border-gold/30'
                : 'text-muted border-border/50 hover:border-gold/30'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function MembershipTags({
  values,
  onChange,
  helpText,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
  helpText: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  const remove = (val: string) => {
    onChange(values.filter((v) => v !== val));
  };

  return (
    <div>
      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">Memberships</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 bg-gold/10 text-gold text-[11px] rounded-full">
            {v}
            <button onClick={() => remove(v)} className="text-gold/60 hover:text-gold">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="NBTHK, NTHK, etc."
          className="flex-1 px-3 py-1.5 text-[12px] bg-hover border border-border/50 rounded-lg focus:border-gold/50 focus:outline-none"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-[11px] font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors"
        >
          Add
        </button>
      </div>
      <p className="text-[10px] text-muted mt-1">{helpText}</p>
    </div>
  );
}
