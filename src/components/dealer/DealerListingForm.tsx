'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadZone, uploadPendingFiles } from '@/components/collection/ImageUploadZone';
import { CategorySelector } from './CategorySelector';
import { TypePills } from './TypePills';
import { CertPills, CERT_NONE } from './CertPills';
import { ArtisanSearchPanel } from '@/components/admin/ArtisanSearchPanel';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';
import { generateListingTitle } from '@/lib/dealer/titleGenerator';
import { SayagakiSection } from './SayagakiSection';
import { HakogakiSection } from './HakogakiSection';
import { KoshiraeSection, createEmptyKoshirae } from './KoshiraeSection';
import { KoshiraeMakerSection } from './KoshiraeMakerSection';
import { ProvenanceSection } from './ProvenanceSection';
import { KiwameSection } from './KiwameSection';
import { CatalogMatchPanel } from './CatalogMatchPanel';
import type { CatalogPrefillFields } from './CatalogMatchPanel';
import { SetsumeiPreview } from './SetsumeiPreview';
import { CATALOG_CERT_TYPES } from '@/lib/collection/catalogMapping';
import type { SayagakiEntry, HakogakiEntry, KoshiraeData, ProvenanceEntry, KiwameEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY_CATEGORY = 'nw-dealer-category';
const STORAGE_KEY_TYPE = 'nw-dealer-type';
const DRAFT_STORAGE_KEY = 'nw-dealer-draft';
const DRAFT_DEBOUNCE_MS = 1000;

interface DealerDraft {
  category: 'nihonto' | 'tosogu';
  itemType: string | null;
  certType: string | null;
  artisanId: string | null;
  artisanName: string | null;
  artisanKanji: string | null;
  priceValue: string;
  priceCurrency: string;
  isAsk: boolean;
  description: string;
  nagasaCm: string;
  motohabaCm: string;
  sakihabaCm: string;
  soriCm: string;
  meiType: string | null;
  nakagoType: string[];
  era: string;
  province: string;
  heightCm: string;
  widthCm: string;
  material: string | null;
  artisanSchool: string | null;
  titleOverride: string | null;
  images: string[]; // only server URLs, no blob:
  sayagaki: SayagakiEntry[];
  hakogaki: HakogakiEntry[];
  koshirae: KoshiraeData | null;
  provenance: ProvenanceEntry[];
  kiwame: KiwameEntry[];
  certSession: number | null;
  catalogObjectUuid: string | null;
  setsumeiTextEn: string | null;
  setsumeiTextJa: string | null;
  savedAt: number;
}

function isDraftSubstantive(d: DealerDraft): boolean {
  return !!(
    d.itemType || d.certType || d.artisanId || d.artisanName ||
    d.priceValue || d.description || d.titleOverride || d.images?.length ||
    d.nagasaCm || d.motohabaCm || d.sakihabaCm || d.soriCm ||
    d.heightCm || d.widthCm || d.material ||
    d.meiType || d.era || d.province || d.artisanSchool ||
    d.sayagaki?.length || d.hakogaki?.length || d.koshirae ||
    d.provenance?.length || d.kiwame?.length
  );
}

function readDraft(): DealerDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DealerDraft;
    // Don't treat an empty form (all defaults) as a restorable draft
    if (!isDraftSubstantive(draft)) return null;
    return draft;
  } catch {
    return null;
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  // Clean up legacy keys
  localStorage.removeItem(STORAGE_KEY_CATEGORY);
  localStorage.removeItem(STORAGE_KEY_TYPE);
}

export interface DealerListingInitialData {
  id: number;
  title?: string | null;
  item_type?: string | null;
  item_category?: string | null;
  cert_type?: string | null;
  price_value?: number | null;
  price_currency?: string | null;
  description?: string | null;
  artisan_id?: string | null;
  artisan_display_name?: string | null;
  artisan_name_kanji?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  school?: string | null;
  tosogu_school?: string | null;
  era?: string | null;
  province?: string | null;
  mei_type?: string | null;
  nakago_type?: string | null;
  nagasa_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  sori_cm?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  material?: string | null;
  images?: string[];
  sayagaki?: SayagakiEntry[] | null;
  hakogaki?: HakogakiEntry[] | null;
  koshirae?: KoshiraeData | null;
  provenance?: ProvenanceEntry[] | null;
  kiwame?: KiwameEntry[] | null;
  cert_session?: number | null;
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;
  status?: string | null;
}

interface DealerListingFormProps {
  mode: 'add' | 'edit';
  initialData?: DealerListingInitialData;
}

const MEI_TYPES = [
  { value: 'zaimei', labelKey: 'meiType.zaimei' },
  { value: 'mumei', labelKey: 'meiType.mumei' },
  { value: 'kinzogan-mei', labelKey: 'meiType.kinzogan-mei' },
  { value: 'shumei', labelKey: 'meiType.shumei' },
  { value: 'kinpunmei', labelKey: 'meiType.kinpunmei' },
  { value: 'gakumei', labelKey: 'meiType.gakumei' },
  { value: 'orikaeshi-mei', labelKey: 'meiType.orikaeshi-mei' },
];

const NAKAGO_TYPES = [
  { value: 'ubu', labelKey: 'meiType.ubu' },
  { value: 'suriage', labelKey: 'meiType.suriage' },
];

const ERA_OPTIONS = [
  { value: 'Heian', labelKey: 'period.Heian' },
  { value: 'Kamakura', labelKey: 'period.Kamakura' },
  { value: 'Nanbokucho', labelKey: 'period.Nanbokucho' },
  { value: 'Muromachi', labelKey: 'period.Muromachi' },
  { value: 'Momoyama', labelKey: 'period.Momoyama' },
  { value: 'Edo', labelKey: 'period.Edo' },
  { value: 'Meiji', labelKey: 'period.Meiji' },
  { value: 'Taisho', labelKey: 'period.Taisho' },
  { value: 'Showa', labelKey: 'period.Showa' },
  { value: 'Heisei', labelKey: 'period.Heisei' },
  { value: 'Reiwa', labelKey: 'period.Reiwa' },
];

const MATERIAL_OPTIONS = [
  { value: 'iron', labelKey: 'dealer.materialIron' },
  { value: 'shakudo', labelKey: 'dealer.materialShakudo' },
  { value: 'shibuichi', labelKey: 'dealer.materialShibuichi' },
  { value: 'copper', labelKey: 'dealer.materialCopper' },
  { value: 'gold', labelKey: 'dealer.materialGold' },
  { value: 'silver', labelKey: 'dealer.materialSilver' },
  { value: 'sentoku', labelKey: 'dealer.materialSentoku' },
  { value: 'mixed', labelKey: 'dealer.materialMixed' },
];

function sanitizeDecimal(value: string): string {
  const stripped = value.replace(/[^0-9.]/g, '');
  const parts = stripped.split('.');
  if (parts.length <= 2) return stripped;
  return parts[0] + '.' + parts.slice(1).join('');
}

// SetsumeiPreview moved to ./SetsumeiPreview.tsx

function getStickyValue(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) || fallback;
}

export function DealerListingForm({ mode, initialData }: DealerListingFormProps) {
  const router = useRouter();
  const { t, locale } = useLocale();

  // Restore draft for add mode (no initialData)
  const restoredDraft = useRef<DealerDraft | null>(null);
  if (mode === 'add' && !initialData) {
    // Only compute once during initial render (ref persists across renders)
    if (restoredDraft.current === undefined || restoredDraft.current === null) {
      restoredDraft.current = readDraft();
    }
  }
  const draft = mode === 'add' && !initialData ? restoredDraft.current : null;

  // Form state — hydrate from draft if available, then initialData, then defaults
  const [category, setCategory] = useState<'nihonto' | 'tosogu'>(
    (initialData?.item_category as 'nihonto' | 'tosogu') ||
    draft?.category ||
    (getStickyValue(STORAGE_KEY_CATEGORY, 'nihonto') as 'nihonto' | 'tosogu')
  );
  const [itemType, setItemType] = useState<string | null>(
    initialData?.item_type || draft?.itemType || getStickyValue(STORAGE_KEY_TYPE, '') || null
  );
  const [certType, setCertType] = useState<string | null>(initialData?.cert_type || draft?.certType || null);
  const [artisanId, setArtisanId] = useState<string | null>(initialData?.artisan_id || draft?.artisanId || null);
  const [artisanName, setArtisanName] = useState<string | null>(initialData?.artisan_display_name || draft?.artisanName || null);
  const [artisanKanji, setArtisanKanji] = useState<string | null>(initialData?.artisan_name_kanji || draft?.artisanKanji || null);
  const [priceValue, setPriceValue] = useState<string>(
    initialData?.price_value != null ? String(initialData.price_value) : (draft?.priceValue ?? '')
  );
  const [priceCurrency, setPriceCurrency] = useState<string>(initialData?.price_currency || draft?.priceCurrency || 'JPY');
  const [isAsk, setIsAsk] = useState(
    initialData?.price_value == null && mode === 'edit' ? true : (draft?.isAsk ?? false)
  );
  const [description, setDescription] = useState(initialData?.description || draft?.description || '');
  const [nagasaCm, setNagasaCm] = useState(initialData?.nagasa_cm != null ? String(initialData.nagasa_cm) : (draft?.nagasaCm ?? ''));
  const [motohabaCm, setMotohabaCm] = useState(initialData?.motohaba_cm != null ? String(initialData.motohaba_cm) : (draft?.motohabaCm ?? ''));
  const [sakihabaCm, setSakihabaCm] = useState(initialData?.sakihaba_cm != null ? String(initialData.sakihaba_cm) : (draft?.sakihabaCm ?? ''));
  const [soriCm, setSoriCm] = useState(initialData?.sori_cm != null ? String(initialData.sori_cm) : (draft?.soriCm ?? ''));
  const [meiType, setMeiType] = useState<string | null>(initialData?.mei_type || draft?.meiType || null);
  const [nakagoType, setNakagoType] = useState<string[]>(
    initialData?.nakago_type ? initialData.nakago_type.split(',') : (draft?.nakagoType ?? [])
  );
  const [era, setEra] = useState(initialData?.era || draft?.era || '');
  const [province, setProvince] = useState(initialData?.province || draft?.province || '');
  const [heightCm, setHeightCm] = useState(initialData?.height_cm != null ? String(initialData.height_cm) : (draft?.heightCm ?? ''));
  const [widthCm, setWidthCm] = useState(initialData?.width_cm != null ? String(initialData.width_cm) : (draft?.widthCm ?? ''));
  const [material, setMaterial] = useState<string | null>(initialData?.material || draft?.material || null);
  const [artisanSchool, setArtisanSchool] = useState<string | null>(
    (initialData?.item_category === 'tosogu' ? initialData?.tosogu_school : initialData?.school) || draft?.artisanSchool || null
  );
  const [images, setImages] = useState<string[]>(initialData?.images || draft?.images || []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sayagaki, setSayagaki] = useState<SayagakiEntry[]>(
    initialData?.sayagaki || draft?.sayagaki || []
  );
  const [pendingSayagakiFiles, setPendingSayagakiFiles] = useState<
    Map<string, File[]>
  >(new Map());
  const [hakogaki, setHakogaki] = useState<HakogakiEntry[]>(
    initialData?.hakogaki || draft?.hakogaki || []
  );
  const [pendingHakogakiFiles, setPendingHakogakiFiles] = useState<
    Map<string, File[]>
  >(new Map());
  const [koshirae, setKoshirae] = useState<KoshiraeData | null>(
    initialData?.koshirae || draft?.koshirae || null
  );
  const [pendingKoshiraeFiles, setPendingKoshiraeFiles] = useState<File[]>([]);
  const [provenance, setProvenance] = useState<ProvenanceEntry[]>(
    initialData?.provenance || draft?.provenance || []
  );
  const [pendingProvenanceFiles, setPendingProvenanceFiles] = useState<
    Map<string, File[]>
  >(new Map());
  const [kiwame, setKiwame] = useState<KiwameEntry[]>(
    initialData?.kiwame || draft?.kiwame || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageUploadFailed, setImageUploadFailed] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(!!draft);
  const [titleOverride, setTitleOverride] = useState<string | null>(
    initialData?.title || draft?.titleOverride || null
  );
  const [certSession, setCertSession] = useState<number | null>(
    initialData?.cert_session ?? draft?.certSession ?? null
  );
  const [catalogObjectUuid, setCatalogObjectUuid] = useState<string | null>(
    draft?.catalogObjectUuid ?? null
  );
  const [setsumeiTextEn, setSetsumeiTextEn] = useState<string | null>(
    initialData?.setsumei_text_en ?? draft?.setsumeiTextEn ?? null
  );
  const [setsumeiTextJa, setSetsumeiTextJa] = useState<string | null>(
    initialData?.setsumei_text_ja ?? draft?.setsumeiTextJa ?? null
  );
  const moreDetailsRef = useRef<HTMLDetailsElement>(null);

  // Guarded category switch — confirms before clearing filled cross-category fields
  const handleCategoryChange = useCallback((newCategory: 'nihonto' | 'tosogu') => {
    if (newCategory === category) return;
    const wouldLoseData = newCategory === 'nihonto'
      ? !!(heightCm || widthCm || material || hakogaki.length)
      : !!(nagasaCm || motohabaCm || sakihabaCm || soriCm || meiType || nakagoType.length || sayagaki.length);
    if (wouldLoseData && !window.confirm(t('dealer.confirmCategorySwitch'))) return;
    setCategory(newCategory);
    if (newCategory === 'nihonto') {
      setHeightCm('');
      setWidthCm('');
      setMaterial(null);
      setHakogaki([]);
    } else {
      setNagasaCm('');
      setMotohabaCm('');
      setSakihabaCm('');
      setSoriCm('');
      setMeiType(null);
      setNakagoType([]);
      setSayagaki([]);
    }
  }, [category, heightCm, widthCm, material, hakogaki, nagasaCm, motohabaCm, sakihabaCm, soriCm, meiType, nakagoType, sayagaki, t]);

  const canDelete = mode === 'edit' && initialData?.id &&
    (initialData?.status === 'INVENTORY' || initialData?.status === 'WITHDRAWN');

  // Auto-init koshirae state when itemType becomes 'koshirae'
  useEffect(() => {
    if (itemType === 'koshirae' && !koshirae) {
      setKoshirae(createEmptyKoshirae());
    }
  }, [itemType, koshirae]);

  // Debounced draft save (add mode only)
  useEffect(() => {
    if (mode !== 'add') return;

    const timer = setTimeout(() => {
      const draftData: DealerDraft = {
        category, itemType, certType, artisanId, artisanName, artisanKanji,
        priceValue, priceCurrency, isAsk, description,
        nagasaCm, motohabaCm, sakihabaCm, soriCm,
        meiType, nakagoType, era, province,
        heightCm, widthCm, material, artisanSchool, titleOverride,
        certSession, catalogObjectUuid,
        setsumeiTextEn, setsumeiTextJa,
        images: images.filter(url => !url.startsWith('blob:')),
        sayagaki: sayagaki.map(e => ({
          ...e,
          images: (e.images || []).filter(url => !url.startsWith('blob:')),
        })),
        hakogaki: hakogaki.map(e => ({
          ...e,
          images: (e.images || []).filter(url => !url.startsWith('blob:')),
        })),
        koshirae: koshirae ? {
          ...koshirae,
          images: (koshirae.images || []).filter(url => !url.startsWith('blob:')),
        } : null,
        provenance: provenance.map(e => ({
          ...e,
          images: (e.images || []).filter(url => !url.startsWith('blob:')),
        })),
        kiwame,
        savedAt: Date.now(),
      };
      // Only persist if the form has substantive content
      if (isDraftSubstantive(draftData)) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    mode, category, itemType, certType, artisanId, artisanName, artisanKanji,
    priceValue, priceCurrency, isAsk, description,
    nagasaCm, motohabaCm, sakihabaCm, soriCm, meiType, nakagoType, era, province,
    heightCm, widthCm, material, artisanSchool, titleOverride,
    certSession, catalogObjectUuid, setsumeiTextEn, setsumeiTextJa,
    images, sayagaki, hakogaki, koshirae, provenance, kiwame,
  ]);

  // Auto-generated title
  const generatedTitle = useMemo(
    () => generateListingTitle(certType, itemType, artisanName, artisanKanji),
    [certType, itemType, artisanName, artisanKanji]
  );

  const handleArtisanSelect = useCallback((result: ArtisanSearchResult) => {
    setArtisanId(result.code);
    setArtisanName(result.name_romaji || result.display_name || null);
    setArtisanKanji(result.name_kanji || null);
    setArtisanSchool(result.school || null);
  }, []);

  const handleArtisanClear = useCallback(() => {
    setArtisanId(null);
    setArtisanName(null);
    setArtisanKanji(null);
    setArtisanSchool(null);
  }, []);

  const showCatalogPanel = !!artisanId && !!certType && CATALOG_CERT_TYPES.has(certType);

  const handleCatalogPrefill = useCallback((fields: CatalogPrefillFields) => {
    // Catalog selection is an explicit user action — always overwrite with catalog data.
    // Only skip fields the catalog doesn't have (undefined).
    if (fields.itemType !== undefined) setItemType(fields.itemType);
    if (fields.nagasaCm !== undefined) setNagasaCm(fields.nagasaCm);
    if (fields.soriCm !== undefined) setSoriCm(fields.soriCm);
    if (fields.motohabaCm !== undefined) setMotohabaCm(fields.motohabaCm);
    if (fields.sakihabaCm !== undefined) setSakihabaCm(fields.sakihabaCm);
    if (fields.meiType !== undefined) setMeiType(fields.meiType);
    if (fields.era !== undefined) setEra(fields.era);
    if (fields.certSession != null) setCertSession(fields.certSession);
    if (fields.catalogObjectUuid) setCatalogObjectUuid(fields.catalogObjectUuid);
    if (fields.setsumeiTextEn !== undefined) setSetsumeiTextEn(fields.setsumeiTextEn ?? null);
    if (fields.setsumeiTextJa !== undefined) setSetsumeiTextJa(fields.setsumeiTextJa ?? null);
    if (fields.province !== undefined) setProvince(fields.province);
    if (fields.nakagoType !== undefined) setNakagoType(fields.nakagoType);
    if (fields.school !== undefined) setArtisanSchool(fields.school);

    // Prepend catalog images (oshigata + setsumei) to the photo gallery.
    // Replace any previously-added catalog images (from a prior card selection),
    // preserving user-uploaded photos. Catalog images are identifiable by the
    // Yuhinkai storage domain.
    if (fields.catalogImages?.length) {
      const isCatalogImage = (url: string) => url.includes('itbhfhyptogxcjbjfzwx.supabase.co');
      setImages(prev => {
        const userImages = prev.filter(url => !isCatalogImage(url));
        return [...fields.catalogImages!, ...userImages];
      });
    }

    // Auto-expand "More Details" if any detail fields were written
    const wroteDetails = !!(fields.nagasaCm || fields.soriCm || fields.motohabaCm || fields.sakihabaCm || fields.meiType || fields.era || fields.nakagoType?.length || fields.province);
    if (wroteDetails && moreDetailsRef.current && !moreDetailsRef.current.open) {
      moreDetailsRef.current.open = true;
    }
  }, []);

  const handleSubmit = useCallback(async (targetStatus?: 'INVENTORY' | 'AVAILABLE') => {
    setIsSubmitting(true);
    setError(null);

    try {
      const effectiveTitle = titleOverride?.trim() || generatedTitle.en;
      const payload: Record<string, unknown> = {
        title: effectiveTitle,
        title_en: titleOverride?.trim() ? effectiveTitle : generatedTitle.en,
        title_ja: titleOverride?.trim() ? null : generatedTitle.ja,
        item_type: itemType,
        item_category: category,
        cert_type: certType === CERT_NONE ? null : certType,
        price_value: isAsk ? null : (priceValue ? Number(priceValue) : null),
        price_currency: priceCurrency,
        description: description || null,
        artisan_id: artisanId,
        smith: category === 'nihonto' ? (artisanKanji || artisanName || null) : null,
        tosogu_maker: category === 'tosogu' ? (artisanKanji || artisanName || null) : null,
        school: category === 'nihonto' ? (artisanSchool || null) : null,
        tosogu_school: category === 'tosogu' ? (artisanSchool || null) : null,
        nagasa_cm: nagasaCm ? Number(nagasaCm) : null,
        motohaba_cm: motohabaCm ? Number(motohabaCm) : null,
        sakihaba_cm: sakihabaCm ? Number(sakihabaCm) : null,
        sori_cm: soriCm ? Number(soriCm) : null,
        mei_type: meiType,
        nakago_type: nakagoType.length ? nakagoType.join(',') : null,
        height_cm: category === 'tosogu' && heightCm ? Number(heightCm) : null,
        width_cm: category === 'tosogu' && widthCm ? Number(widthCm) : null,
        material: category === 'tosogu' ? material : null,
        era: era || null,
        province: province || null,
        cert_session: certSession,
        sayagaki: category === 'nihonto' && sayagaki.length > 0
          ? sayagaki.map(e => ({
              ...e,
              images: (e.images || []).filter(url => !url.startsWith('blob:')),
            }))
          : null,
        hakogaki: category === 'tosogu' && hakogaki.length > 0
          ? hakogaki.map(e => ({
              ...e,
              images: (e.images || []).filter(url => !url.startsWith('blob:')),
            }))
          : null,
        koshirae: koshirae ? {
          ...koshirae,
          images: (koshirae.images || []).filter(url => !url.startsWith('blob:')),
        } : null,
        provenance: provenance.length > 0
          ? provenance.map(e => ({
              ...e,
              images: (e.images || []).filter(url => !url.startsWith('blob:')),
            }))
          : null,
        kiwame: kiwame.length > 0 ? kiwame : null,
        setsumei_text_en: setsumeiTextEn || null,
        setsumei_text_ja: setsumeiTextJa || null,
        images: images.filter(url => !url.startsWith('blob:')),
      };

      if (mode === 'add') {
        // Add status to payload for new listings
        payload.status = targetStatus || 'INVENTORY';

        // Create listing
        const res = await fetch('/api/dealer/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create listing');
        }

        const listing = await res.json();

        // Upload pending images — catch failures separately
        if (pendingFiles.length > 0) {
          try {
            await uploadPendingFiles(pendingFiles, String(listing.id), '/api/dealer/images');
          } catch {
            setCreatedListingId(String(listing.id));
            setImageUploadFailed(true);
            setIsSubmitting(false);
            return;
          }
        }

        // Upload pending sayagaki images
        if (pendingSayagakiFiles.size > 0) {
          for (const [sayagakiId, files] of pendingSayagakiFiles) {
            for (const file of files) {
              const formData = new FormData();
              formData.append('file', file, file.name);
              formData.append('itemId', String(listing.id));
              formData.append('sayagakiId', sayagakiId);
              try {
                await fetch('/api/dealer/sayagaki-images', {
                  method: 'POST',
                  body: formData,
                });
              } catch {
                // Best effort — don't block success
              }
            }
          }
        }

        // Upload pending hakogaki images
        if (pendingHakogakiFiles.size > 0) {
          for (const [hakogakiId, files] of pendingHakogakiFiles) {
            for (const file of files) {
              const formData = new FormData();
              formData.append('file', file, file.name);
              formData.append('itemId', String(listing.id));
              formData.append('hakogakiId', hakogakiId);
              try {
                await fetch('/api/dealer/hakogaki-images', {
                  method: 'POST',
                  body: formData,
                });
              } catch {
                // Best effort — don't block success
              }
            }
          }
        }

        // Upload pending koshirae images
        if (pendingKoshiraeFiles.length > 0) {
          for (const file of pendingKoshiraeFiles) {
            const formData = new FormData();
            formData.append('file', file, file.name);
            formData.append('itemId', String(listing.id));
            try {
              await fetch('/api/dealer/koshirae-images', {
                method: 'POST',
                body: formData,
              });
            } catch {
              // Best effort — don't block success
            }
          }
        }

        // Upload pending provenance images
        if (pendingProvenanceFiles.size > 0) {
          for (const [provenanceId, files] of pendingProvenanceFiles) {
            for (const file of files) {
              const formData = new FormData();
              formData.append('file', file, file.name);
              formData.append('itemId', String(listing.id));
              formData.append('provenanceId', provenanceId);
              try {
                await fetch('/api/dealer/provenance-images', {
                  method: 'POST',
                  body: formData,
                });
              } catch {
                // Best effort — don't block success
              }
            }
          }
        }

        clearDraft();
        setShowSuccess(true);
      } else if (mode === 'edit' && initialData?.id) {
        const res = await fetch(`/api/dealer/listings/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update listing');
        }

        router.push('/dealer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode, initialData, category, itemType, certType, artisanId, artisanName,
    artisanKanji, artisanSchool, priceValue, priceCurrency, isAsk, description,
    nagasaCm, motohabaCm, sakihabaCm, soriCm, meiType, nakagoType, era, province,
    heightCm, widthCm, material, pendingFiles, pendingSayagakiFiles, sayagaki,
    pendingHakogakiFiles, hakogaki, koshirae, pendingKoshiraeFiles, provenance,
    pendingProvenanceFiles, kiwame,
    certSession, setsumeiTextEn, setsumeiTextJa, generatedTitle, titleOverride,
    router,
  ]);

  const handleRetryUpload = useCallback(async () => {
    if (!createdListingId || pendingFiles.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await uploadPendingFiles(pendingFiles, createdListingId, '/api/dealer/images');
      setImageUploadFailed(false);
      setShowSuccess(true);
    } catch {
      setError(t('dealer.imageUploadFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [createdListingId, pendingFiles, t]);

  const handleReset = useCallback(() => {
    setItemType(null);
    setCertType(null);
    setArtisanId(null);
    setArtisanName(null);
    setArtisanKanji(null);
    setPriceValue('');
    setIsAsk(false);
    setDescription('');
    setNagasaCm('');
    setMotohabaCm('');
    setSakihabaCm('');
    setSoriCm('');
    setMeiType(null);
    setNakagoType([]);
    setEra('');
    setProvince('');
    setHeightCm('');
    setWidthCm('');
    setMaterial(null);
    setArtisanSchool(null);
    setTitleOverride(null);
    setCertSession(null);
    setCatalogObjectUuid(null);
    setSetsumeiTextEn(null);
    setSetsumeiTextJa(null);
    setImages([]);
    setPendingFiles([]);
    setSayagaki([]);
    setPendingSayagakiFiles(new Map());
    setKoshirae(null);
    setPendingKoshiraeFiles([]);
    setProvenance([]);
    setPendingProvenanceFiles(new Map());
    setKiwame([]);
    setShowSuccess(false);
    setImageUploadFailed(false);
    setCreatedListingId(null);
    setError(null);
    setShowDraftBanner(false);
    clearDraft();
  }, []);

  const handleDelete = useCallback(async () => {
    if (!initialData?.id) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dealer/listings/${initialData.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      router.push('/dealer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }, [initialData?.id, router]);

  // Image upload retry screen
  if (imageUploadFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium mb-2">{t('dealer.imageUploadFailed')}</h2>
        {error && (
          <p className="text-[12px] text-red-500 mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleRetryUpload}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('dealer.retryUpload')}
              </span>
            ) : (
              t('dealer.retryUpload')
            )}
          </button>
          <button
            onClick={() => { setImageUploadFailed(false); setShowSuccess(true); }}
            className="px-4 py-2 rounded-lg bg-surface text-muted text-[13px] font-medium hover:bg-hover transition-colors"
          >
            {t('dealer.skipImages')}
          </button>
        </div>
      </div>
    );
  }

  // Success screen after add
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-medium mb-2">{t('dealer.savedToInventory')}</h2>
        <p className="text-[13px] text-muted mb-6">{t('dealer.savedToInventoryDesc')}</p>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors"
          >
            {t('dealer.addAnother')}
          </button>
          <button
            onClick={() => router.push('/dealer')}
            className="px-4 py-2 rounded-lg bg-surface text-muted text-[13px] font-medium hover:bg-hover transition-colors"
          >
            {t('dealer.backToListings')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      <div className="space-y-6 px-4 py-4">
        {/* Draft restored banner */}
        {showDraftBanner && (
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg text-[12px] text-blue-700 dark:text-blue-300">
            <span>{t('dealer.draftRestored')}</span>
            <button
              type="button"
              onClick={() => {
                setShowDraftBanner(false);
                clearDraft();
                handleReset();
              }}
              className="font-medium underline hover:no-underline"
            >
              {t('dealer.discardDraft')}
            </button>
          </div>
        )}

        {/* 1. Images */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.photos')}
          </label>
          <ImageUploadZone
            images={images}
            itemId={mode === 'edit' && initialData?.id ? String(initialData.id) : undefined}
            onChange={setImages}
            onPendingFilesChange={setPendingFiles}
            apiEndpoint="/api/dealer/images"
          />
        </section>

        {/* 2. Category */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.category')}
          </label>
          <CategorySelector value={category} onChange={handleCategoryChange} />
        </section>

        {/* 3. Type */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.type')}
          </label>
          <TypePills category={category} value={itemType} onChange={setItemType} />
        </section>

        {/* 4. Certification */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.certification')}
          </label>
          <CertPills value={certType} onChange={setCertType} />
        </section>

        {/* 4b. Sayagaki (nihonto) / Hakogaki (tosogu) */}
        {category === 'nihonto' ? (
          <SayagakiSection
            entries={sayagaki}
            itemId={mode === 'edit' && initialData?.id ? String(initialData.id) : undefined}
            onChange={setSayagaki}
            onPendingFilesChange={(sayagakiId, files) => {
              setPendingSayagakiFiles(prev => {
                const next = new Map(prev);
                if (files.length === 0) {
                  next.delete(sayagakiId);
                } else {
                  next.set(sayagakiId, files);
                }
                return next;
              });
            }}
          />
        ) : (
          <HakogakiSection
            entries={hakogaki}
            itemId={mode === 'edit' && initialData?.id ? String(initialData.id) : undefined}
            onChange={setHakogaki}
            onPendingFilesChange={(hakogakiId, files) => {
              setPendingHakogakiFiles(prev => {
                const next = new Map(prev);
                if (files.length === 0) {
                  next.delete(hakogakiId);
                } else {
                  next.set(hakogakiId, files);
                }
                return next;
              });
            }}
          />
        )}

        {/* 4c. Koshirae (companion — hidden when item IS a koshirae) */}
        {itemType !== 'koshirae' && (
          <KoshiraeSection
            koshirae={koshirae}
            itemId={mode === 'edit' && initialData?.id ? String(initialData.id) : undefined}
            onChange={setKoshirae}
            onPendingFilesChange={setPendingKoshiraeFiles}
          />
        )}

        {/* 4d. Provenance */}
        <ProvenanceSection
          entries={provenance}
          itemId={mode === 'edit' && initialData?.id ? String(initialData.id) : undefined}
          onChange={setProvenance}
          onPendingFilesChange={(provenanceId, files) => {
            setPendingProvenanceFiles(prev => {
              const next = new Map(prev);
              if (files.length === 0) {
                next.delete(provenanceId);
              } else {
                next.set(provenanceId, files);
              }
              return next;
            });
          }}
        />

        {/* 4e. Kiwame */}
        <KiwameSection
          entries={kiwame}
          onChange={setKiwame}
        />

        {/* 5. Artisan */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.artisan')}
          </label>
          {itemType === 'koshirae' ? (
            <KoshiraeMakerSection
              artisanId={artisanId}
              artisanName={artisanName}
              artisanKanji={artisanKanji}
              components={koshirae?.components ?? []}
              onArtisanChange={(id, name, kanji) => {
                setArtisanId(id);
                setArtisanName(name);
                setArtisanKanji(kanji);
                setKoshirae(prev => {
                  const base = prev ?? createEmptyKoshirae();
                  return { ...base, artisan_id: id, artisan_name: name, artisan_kanji: kanji };
                });
              }}
              onComponentsChange={(components) => {
                // Multi mode: clear single artisan, store components
                setArtisanId(null);
                setArtisanName(null);
                setArtisanKanji(null);
                setKoshirae(prev => {
                  const base = prev ?? createEmptyKoshirae();
                  return { ...base, components, artisan_id: null, artisan_name: null, artisan_kanji: null };
                });
              }}
            />
          ) : artisanId ? (
            <div className="px-3 py-2 bg-surface rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{artisanName || artisanId}</div>
                  {artisanKanji && artisanKanji !== artisanName && (
                    <div className="text-[12px] text-muted">{artisanKanji}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleArtisanClear}
                  className="text-[11px] text-muted hover:text-red-500 transition-colors"
                >
                  {t('dealer.changeArtisan')}
                </button>
              </div>
              {artisanSchool && (
                <div className="mt-1.5">
                  <span className="inline-block px-2 py-0.5 bg-gold/10 text-gold text-[11px] rounded-full border border-gold/20">
                    {artisanSchool}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <ArtisanSearchPanel
              domain={category === 'nihonto' ? 'smith' : 'tosogu'}
              onSelect={handleArtisanSelect}
              onSetUnknown={handleArtisanClear}
              onCancel={handleArtisanClear}
            />
          )}
        </section>

        {/* 5b. Catalog Match — auto-appears when cert + artisan are set */}
        {showCatalogPanel && (
          <CatalogMatchPanel
            certType={certType!}
            artisanId={artisanId!}
            artisanName={artisanName}
            onPrefill={handleCatalogPrefill}
          />
        )}

        {/* 5c. Setsumei preview — auto-filled from catalog */}
        {setsumeiTextEn && (
          <SetsumeiPreview textEn={setsumeiTextEn} textJa={setsumeiTextJa} />
        )}

        {/* 6. Title (auto-generated, editable) */}
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.title')}
          </label>
          <input
            type="text"
            value={titleOverride ?? generatedTitle.en}
            onChange={e => setTitleOverride(e.target.value)}
            placeholder={generatedTitle.en}
            className="w-full px-3 py-2 bg-surface rounded-lg border border-border/50 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {titleOverride !== null && titleOverride.trim() !== generatedTitle.en && (
            <button
              type="button"
              onClick={() => setTitleOverride(null)}
              className="mt-1 text-[11px] text-blue-500 hover:text-blue-400"
            >
              {t('dealer.resetTitle')}
            </button>
          )}
          {!titleOverride && generatedTitle.ja !== generatedTitle.en && (
            <div className="px-3 py-1 text-[12px] text-muted">
              {generatedTitle.ja}
            </div>
          )}
        </section>

        {/* 7. Price — only shown in edit mode for listed items */}
        {mode === 'edit' && (initialData?.status === 'AVAILABLE' || initialData?.status === 'HOLD') && (
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.price')}
          </label>
          <div className="flex gap-2 items-center">
            <select
              value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              className="px-2 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
              disabled={isAsk}
            >
              <option value="JPY">¥ JPY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={isAsk ? '' : priceValue}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setPriceValue(v);
              }}
              placeholder={isAsk ? t('dealer.askPrice') : '0'}
              disabled={isAsk}
              className="flex-1 px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] disabled:opacity-50"
            />
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAsk}
              onChange={e => setIsAsk(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[12px] text-muted">{t('dealer.priceOnRequest')}</span>
          </label>
        </section>
        )}

        {/* 8. Notes (collapsed) */}
        <details>
          <summary className="text-[11px] uppercase tracking-wider text-muted cursor-pointer">
            {t('dealer.notes')}
          </summary>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full mt-2 px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none"
            placeholder={t('dealer.notesPlaceholder')}
          />
        </details>

        {/* 9. More Details (collapsed) */}
        <details ref={moreDetailsRef}>
          <summary className="text-[11px] uppercase tracking-wider text-muted cursor-pointer">
            {t('dealer.moreDetails')}
          </summary>
          <div className="mt-3 space-y-5">
            {/* 9a. Measurements — nihonto only */}
            {category === 'nihonto' && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
                  {t('dealer.measurements')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.nagasa')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={nagasaCm}
                      onChange={e => setNagasaCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.motohaba')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={motohabaCm}
                      onChange={e => setMotohabaCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.sakihaba')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sakihabaCm}
                      onChange={e => setSakihabaCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.sori')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={soriCm}
                      onChange={e => setSoriCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 9a2. Measurements — tosogu only */}
            {category === 'tosogu' && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
                  {t('dealer.measurements')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.height')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={heightCm}
                      onChange={e => setHeightCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">{t('dealer.width')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={widthCm}
                      onChange={e => setWidthCm(sanitizeDecimal(e.target.value))}
                      placeholder="—"
                      className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
                    />
                  </div>
                </div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mt-3 mb-2">
                  {t('dealer.material')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_OPTIONS.map(({ value: v, labelKey }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMaterial(material === v ? null : v)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        material === v
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 9b. Signature (mei_type) — nihonto only */}
            {category === 'nihonto' && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
                  {t('dealer.signature')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {MEI_TYPES.map(({ value: v, labelKey }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMeiType(meiType === v ? null : v)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        meiType === v
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mt-3 mb-2">
                  {t('dealer.nakago')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {NAKAGO_TYPES.map(({ value: v, labelKey }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNakagoType(prev =>
                        prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                      )}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        nakagoType.includes(v)
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 9c. Era */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
                {t('dealer.era')}
              </label>
              <div className="flex flex-wrap gap-2">
                {ERA_OPTIONS.map(({ value: v, labelKey }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEra(era === v ? '' : v)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                      era === v
                        ? 'bg-gold/10 text-gold border border-gold/30'
                        : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* 9d. Province */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
                {t('dealer.province')}
              </label>
              <input
                type="text"
                value={province}
                onChange={e => setProvince(e.target.value)}
                placeholder="—"
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px]"
              />
            </div>
          </div>
        </details>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-[12px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Delete — inventory items only */}
        {canDelete && (
          <div className="pt-4 border-t border-border/30">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[13px] font-medium disabled:opacity-50 transition-colors hover:bg-red-700"
                >
                  {isDeleting ? t('common.loading') : t('common.delete')}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-lg bg-surface text-muted text-[13px] font-medium hover:bg-hover transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[12px] text-red-500 hover:text-red-600 transition-colors"
              >
                {t('common.delete')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit button — sticky on mobile, inline on desktop */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-surface/95 backdrop-blur-sm border-t border-border/30 z-40 lg:static lg:p-0 lg:px-4 lg:mt-6 lg:bg-transparent lg:border-0 lg:backdrop-blur-none">
        <button
          onClick={() => handleSubmit('INVENTORY')}
          disabled={isSubmitting || !itemType}
          className="w-full py-3 rounded-xl bg-gold text-white text-[14px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('dealer.saving')}
            </span>
          ) : (
            t(mode === 'add' ? 'dealer.saveToInventory' : 'dealer.save')
          )}
        </button>
      </div>
    </div>
  );
}
