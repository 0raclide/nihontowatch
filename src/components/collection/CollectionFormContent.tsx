'use client';

import { useState, useCallback } from 'react';
import type { CollectionItem, CreateCollectionItemInput, UpdateCollectionItemInput } from '@/types/collection';
import { useLocale } from '@/i18n/LocaleContext';
import { CatalogSearchBar } from './CatalogSearchBar';
import { ImageUploadZone, uploadPendingFiles } from './ImageUploadZone';

interface CollectionFormContentProps {
  mode: 'add' | 'edit';
  item: CollectionItem | null;
  prefillData: Partial<CollectionItem> | null;
  onSaved: () => void;
  onCancel: () => void;
}

const ITEM_TYPES = [
  { value: '', label: 'Select type...' },
  { value: 'katana', label: 'Katana' }, { value: 'wakizashi', label: 'Wakizashi' },
  { value: 'tanto', label: 'Tanto' }, { value: 'tachi', label: 'Tachi' },
  { value: 'naginata', label: 'Naginata' }, { value: 'yari', label: 'Yari' },
  { value: 'ken', label: 'Ken' }, { value: 'kodachi', label: 'Kodachi' },
  { value: 'tsuba', label: 'Tsuba' }, { value: 'kozuka', label: 'Kozuka' },
  { value: 'kogai', label: 'Kogai' }, { value: 'menuki', label: 'Menuki' },
  { value: 'fuchi-kashira', label: 'Fuchi-Kashira' },
  { value: 'koshirae', label: 'Koshirae' }, { value: 'armor', label: 'Armor' },
  { value: 'tosogu', label: 'Tosogu' },
];

const CERT_TYPES = [
  { value: '', label: 'None' },
  { value: 'Tokubetsu Juyo', label: 'Tokubetsu Juyo' }, { value: 'Juyo', label: 'Juyo' },
  { value: 'Tokubetsu Hozon', label: 'Tokubetsu Hozon' }, { value: 'Hozon', label: 'Hozon' },
  { value: 'Kokuho', label: 'Kokuho' }, { value: 'Juyo Bijutsuhin', label: 'Juyo Bijutsuhin' },
  { value: 'Juyo Bunkazai', label: 'Juyo Bunkazai' },
  { value: 'Kantei', label: 'Kantei' }, { value: 'NTHK', label: 'NTHK' },
];

const MEI_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'mei', label: 'Mei (signed)' }, { value: 'mumei', label: 'Mumei (unsigned)' },
  { value: 'gimei', label: 'Gimei (false sig)' }, { value: 'orikaeshi-mei', label: 'Orikaeshi Mei' },
  { value: 'gaku-mei', label: 'Gaku Mei' }, { value: 'kinzogan-mei', label: 'Kinzogan Mei' },
];

const CONDITIONS = [
  { value: 'mint', label: 'Mint' }, { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' },
  { value: 'project', label: 'Project' },
];

const STATUSES = [
  { value: 'owned', label: 'Owned' }, { value: 'sold', label: 'Sold' },
  { value: 'lent', label: 'Lent' }, { value: 'consignment', label: 'On Consignment' },
];

const CURRENCIES = [
  { value: 'JPY', label: 'JPY' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' }, { value: 'AUD', label: 'AUD' },
];

type FormData = {
  item_type: string;
  title: string;
  artisan_id: string;
  artisan_display_name: string;
  cert_type: string;
  cert_session: string;
  cert_organization: string;
  smith: string;
  school: string;
  province: string;
  era: string;
  mei_type: string;
  nagasa_cm: string;
  sori_cm: string;
  motohaba_cm: string;
  sakihaba_cm: string;
  price_paid: string;
  price_paid_currency: string;
  current_value: string;
  current_value_currency: string;
  acquired_date: string;
  acquired_from: string;
  condition: string;
  status: string;
  notes: string;
  images: string[];
  source_listing_id: number | null;
  catalog_reference: { collection: string; volume: number; item_number: number; object_uuid: string } | null;
  is_public: boolean;
};

function buildInitialForm(item: CollectionItem | null, prefill: Partial<CollectionItem> | null): FormData {
  const src = item || prefill || {};
  return {
    item_type: (src as Record<string, unknown>).item_type as string || '',
    title: (src as Record<string, unknown>).title as string || '',
    artisan_id: (src as Record<string, unknown>).artisan_id as string || '',
    artisan_display_name: (src as Record<string, unknown>).artisan_display_name as string || '',
    cert_type: (src as Record<string, unknown>).cert_type as string || '',
    cert_session: (src as Record<string, unknown>).cert_session ? String((src as Record<string, unknown>).cert_session) : '',
    cert_organization: (src as Record<string, unknown>).cert_organization as string || '',
    smith: (src as Record<string, unknown>).smith as string || '',
    school: (src as Record<string, unknown>).school as string || '',
    province: (src as Record<string, unknown>).province as string || '',
    era: (src as Record<string, unknown>).era as string || '',
    mei_type: (src as Record<string, unknown>).mei_type as string || '',
    nagasa_cm: (src as Record<string, unknown>).nagasa_cm ? String((src as Record<string, unknown>).nagasa_cm) : '',
    sori_cm: (src as Record<string, unknown>).sori_cm ? String((src as Record<string, unknown>).sori_cm) : '',
    motohaba_cm: (src as Record<string, unknown>).motohaba_cm ? String((src as Record<string, unknown>).motohaba_cm) : '',
    sakihaba_cm: (src as Record<string, unknown>).sakihaba_cm ? String((src as Record<string, unknown>).sakihaba_cm) : '',
    price_paid: (src as Record<string, unknown>).price_paid ? String((src as Record<string, unknown>).price_paid) : '',
    price_paid_currency: (src as Record<string, unknown>).price_paid_currency as string || 'JPY',
    current_value: (src as Record<string, unknown>).current_value ? String((src as Record<string, unknown>).current_value) : '',
    current_value_currency: (src as Record<string, unknown>).current_value_currency as string || 'JPY',
    acquired_date: (src as Record<string, unknown>).acquired_date as string || '',
    acquired_from: (src as Record<string, unknown>).acquired_from as string || '',
    condition: (src as Record<string, unknown>).condition as string || 'good',
    status: (src as Record<string, unknown>).status as string || 'owned',
    notes: (src as Record<string, unknown>).notes as string || '',
    images: ((src as Record<string, unknown>).images as string[]) || [],
    source_listing_id: (src as Record<string, unknown>).source_listing_id as number || null,
    catalog_reference: (src as Record<string, unknown>).catalog_reference as FormData['catalog_reference'] || null,
    is_public: (src as Record<string, unknown>).is_public as boolean || false,
  };
}

export function CollectionFormContent({ mode, item, prefillData, onSaved, onCancel }: CollectionFormContentProps) {
  const { t } = useLocale();
  const [form, setForm] = useState<FormData>(() => buildInitialForm(item, prefillData));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    classification: true,
    attribution: true,
    measurements: false,
    provenance: true,
    valuation: false,
    status: false,
    notes: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // Apply catalog/artisan prefill from search
  const handleCatalogSelect = useCallback((data: Partial<CreateCollectionItemInput>) => {
    setForm(prev => ({
      ...prev,
      item_type: data.item_type || prev.item_type,
      artisan_id: data.artisan_id || prev.artisan_id,
      artisan_display_name: data.artisan_display_name || prev.artisan_display_name,
      smith: data.smith || prev.smith,
      school: data.school || prev.school,
      province: data.province || prev.province,
      era: data.era || prev.era,
      cert_type: data.cert_type || prev.cert_type,
      cert_session: data.cert_session ? String(data.cert_session) : prev.cert_session,
      cert_organization: data.cert_organization || prev.cert_organization,
      nagasa_cm: data.nagasa_cm ? String(data.nagasa_cm) : prev.nagasa_cm,
      sori_cm: data.sori_cm ? String(data.sori_cm) : prev.sori_cm,
      motohaba_cm: data.motohaba_cm ? String(data.motohaba_cm) : prev.motohaba_cm,
      sakihaba_cm: data.sakihaba_cm ? String(data.sakihaba_cm) : prev.sakihaba_cm,
      mei_type: data.mei_type || prev.mei_type,
      catalog_reference: data.catalog_reference || prev.catalog_reference,
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const body: Record<string, unknown> = {};
      // Only send non-empty fields
      if (form.item_type) body.item_type = form.item_type;
      if (form.title) body.title = form.title;
      if (form.artisan_id) body.artisan_id = form.artisan_id;
      if (form.artisan_display_name) body.artisan_display_name = form.artisan_display_name;
      if (form.cert_type) body.cert_type = form.cert_type;
      if (form.cert_session) body.cert_session = parseInt(form.cert_session, 10);
      if (form.cert_organization) body.cert_organization = form.cert_organization;
      if (form.smith) body.smith = form.smith;
      if (form.school) body.school = form.school;
      if (form.province) body.province = form.province;
      if (form.era) body.era = form.era;
      if (form.mei_type) body.mei_type = form.mei_type;
      if (form.nagasa_cm) body.nagasa_cm = parseFloat(form.nagasa_cm);
      if (form.sori_cm) body.sori_cm = parseFloat(form.sori_cm);
      if (form.motohaba_cm) body.motohaba_cm = parseFloat(form.motohaba_cm);
      if (form.sakihaba_cm) body.sakihaba_cm = parseFloat(form.sakihaba_cm);
      if (form.price_paid) body.price_paid = parseFloat(form.price_paid);
      body.price_paid_currency = form.price_paid_currency;
      if (form.current_value) body.current_value = parseFloat(form.current_value);
      body.current_value_currency = form.current_value_currency;
      if (form.acquired_date) body.acquired_date = form.acquired_date;
      if (form.acquired_from) body.acquired_from = form.acquired_from;
      body.condition = form.condition;
      body.status = form.status;
      if (form.notes) body.notes = form.notes;
      body.images = form.images;
      if (form.source_listing_id) body.source_listing_id = form.source_listing_id;
      if (form.catalog_reference) body.catalog_reference = form.catalog_reference;
      body.is_public = form.is_public;

      const url = mode === 'edit' && item ? `/api/collection/items/${item.id}` : '/api/collection/items';
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      // In add mode, strip blob: URLs from images (they'll be uploaded after creation)
      if (mode === 'add') {
        body.images = (body.images as string[])?.filter(
          (url: string) => !url.startsWith('blob:')
        ) || [];
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      // In add mode, upload pending files now that item exists
      if (mode === 'add' && pendingFiles.length > 0) {
        const newItemId = result.item?.id;
        if (newItemId) {
          const uploadedPaths = await uploadPendingFiles(pendingFiles, newItemId);
          if (uploadedPaths.length > 0) {
            // Update the item with uploaded image paths
            const existingImages = (body.images as string[]) || [];
            await fetch(`/api/collection/items/${newItemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: [...existingImages, ...uploadedPaths] }),
            });
          }
        }
      }

      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Catalog Search (add mode only, no prefill from listing) */}
      {mode === 'add' && !prefillData?.source_listing_id && (
        <div className="px-4 lg:px-5 py-4 border-b border-border/30 bg-linen/30">
          <CatalogSearchBar onSelect={handleCatalogSelect} />
        </div>
      )}

      {/* Image Upload */}
      <div className="px-4 lg:px-5 py-4 border-b border-border/30">
        <ImageUploadZone
          images={form.images}
          itemId={mode === 'edit' && item ? item.id : undefined}
          onChange={urls => updateField('images', urls)}
          onPendingFilesChange={setPendingFiles}
        />
      </div>

      {/* Form Sections */}
      <div className="flex-1 px-4 lg:px-5 py-4 space-y-1">
        {/* Classification */}
        <FormSection title={t('collection.classification')} isOpen={expandedSections.classification} onToggle={() => toggleSection('classification')}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('collection.itemType')}>
              <select value={form.item_type} onChange={e => updateField('item_type', e.target.value)} className="form-select">
                {ITEM_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.value === '' ? t('collection.selectType') : t(`itemType.${opt.value}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('collection.titleOptional')}>
              <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder={t('collection.customTitle')} className="form-input" />
            </FormField>
            <FormField label={t('collection.certification')}>
              <select value={form.cert_type} onChange={e => updateField('cert_type', e.target.value)} className="form-select">
                {CERT_TYPES.map(c => <option key={c.value} value={c.value}>{c.value === '' ? t('cert.none') : t(`cert.${c.value}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('collection.session')}>
              <input type="number" value={form.cert_session} onChange={e => updateField('cert_session', e.target.value)} placeholder={t('collection.sessionPlaceholder')} className="form-input" />
            </FormField>
          </div>
        </FormSection>

        {/* Attribution */}
        <FormSection title={t('collection.attribution')} isOpen={expandedSections.attribution} onToggle={() => toggleSection('attribution')}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('collection.smithMaker')}>
              <input type="text" value={form.smith} onChange={e => updateField('smith', e.target.value)} placeholder={t('collection.smithPlaceholder')} className="form-input" />
            </FormField>
            <FormField label={t('collection.school')}>
              <input type="text" value={form.school} onChange={e => updateField('school', e.target.value)} placeholder={t('collection.schoolPlaceholder')} className="form-input" />
            </FormField>
            <FormField label={t('collection.province')}>
              <input type="text" value={form.province} onChange={e => updateField('province', e.target.value)} placeholder={t('collection.provincePlaceholder')} className="form-input" />
            </FormField>
            <FormField label={t('collection.era')}>
              <input type="text" value={form.era} onChange={e => updateField('era', e.target.value)} placeholder={t('collection.eraPlaceholder')} className="form-input" />
            </FormField>
            <FormField label={t('collection.meiType')}>
              <select value={form.mei_type} onChange={e => updateField('mei_type', e.target.value)} className="form-select">
                {MEI_TYPES.map(m => <option key={m.value} value={m.value}>{m.value === '' ? t('collection.selectMeiType') : t(`collection.${({'mei':'meiSigned','mumei':'mumei','gimei':'gimei','orikaeshi-mei':'orikaeshi','gaku-mei':'gakuMei','kinzogan-mei':'kinzogan'} as Record<string,string>)[m.value] || m.value}`)}</option>)}
              </select>
            </FormField>
          </div>
        </FormSection>

        {/* Measurements */}
        <FormSection title={t('collection.measurements')} isOpen={expandedSections.measurements} onToggle={() => toggleSection('measurements')}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('collection.nagasa')}>
              <input type="number" step="0.1" value={form.nagasa_cm} onChange={e => updateField('nagasa_cm', e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('collection.sori')}>
              <input type="number" step="0.1" value={form.sori_cm} onChange={e => updateField('sori_cm', e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('collection.motohaba')}>
              <input type="number" step="0.01" value={form.motohaba_cm} onChange={e => updateField('motohaba_cm', e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('collection.sakihaba')}>
              <input type="number" step="0.01" value={form.sakihaba_cm} onChange={e => updateField('sakihaba_cm', e.target.value)} className="form-input" />
            </FormField>
          </div>
        </FormSection>

        {/* Provenance */}
        <FormSection title={t('collection.provenance')} isOpen={expandedSections.provenance} onToggle={() => toggleSection('provenance')}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('collection.acquiredFrom')}>
              <input type="text" value={form.acquired_from} onChange={e => updateField('acquired_from', e.target.value)} placeholder={t('collection.acquiredFromPlaceholder')} className="form-input" />
            </FormField>
            <FormField label={t('collection.acquiredDate')}>
              <input type="date" value={form.acquired_date} onChange={e => updateField('acquired_date', e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('collection.pricePaid')}>
              <div className="flex gap-1">
                <select value={form.price_paid_currency} onChange={e => updateField('price_paid_currency', e.target.value)} className="form-select w-20">
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" value={form.price_paid} onChange={e => updateField('price_paid', e.target.value)} placeholder={t('collection.amountPlaceholder')} className="form-input flex-1" />
              </div>
            </FormField>
          </div>
        </FormSection>

        {/* Valuation */}
        <FormSection title={t('collection.valuation')} isOpen={expandedSections.valuation} onToggle={() => toggleSection('valuation')}>
          <FormField label={t('collection.currentValue')}>
            <div className="flex gap-1">
              <select value={form.current_value_currency} onChange={e => updateField('current_value_currency', e.target.value)} className="form-select w-20">
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" value={form.current_value} onChange={e => updateField('current_value', e.target.value)} placeholder={t('collection.estimatedValue')} className="form-input flex-1" />
            </div>
          </FormField>
        </FormSection>

        {/* Status */}
        <FormSection title={t('collection.statusCondition')} isOpen={expandedSections.status} onToggle={() => toggleSection('status')}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('collection.status')}>
              <select value={form.status} onChange={e => updateField('status', e.target.value)} className="form-select">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{t(`collection.status.${s.value}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('collection.condition')}>
              <select value={form.condition} onChange={e => updateField('condition', e.target.value)} className="form-select">
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{t(`collection.condition.${c.value}`)}</option>)}
              </select>
            </FormField>
          </div>
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={form.is_public} onChange={e => updateField('is_public', e.target.checked)} className="rounded border-border" />
            <span className="text-[12px] text-muted">{t('collection.makeVisible')}</span>
          </label>
        </FormSection>

        {/* Notes */}
        <FormSection title={t('collection.notes')} isOpen={expandedSections.notes} onToggle={() => toggleSection('notes')}>
          <textarea
            value={form.notes}
            onChange={e => updateField('notes', e.target.value)}
            rows={4}
            placeholder={t('collection.notesPlaceholder')}
            className="form-input w-full resize-y"
          />
        </FormSection>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 px-4 lg:px-5 py-3 bg-cream border-t border-border/40 flex items-center gap-3 safe-area-bottom">
        {saveError && (
          <span className="text-[12px] text-red-600 flex-1">{saveError}</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[12px] font-medium text-muted hover:text-ink transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-[12px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? t('collection.saving') : mode === 'add' ? t('collection.addToCollection') : t('collection.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, isOpen, onToggle, children }: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/20 last:border-b-0">
      <button onClick={onToggle} className="flex items-center justify-between w-full py-2.5 text-left">
        <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">{title}</span>
        <svg className={`w-3.5 h-3.5 text-muted/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[2000px] pb-3' : 'max-h-0'}`}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
