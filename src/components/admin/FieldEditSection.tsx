'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Listing } from '@/types';
import { isBlade, isTosogu } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface FieldEditSectionProps {
  listing: Listing;
  onRefresh: (optimisticFields?: Partial<Listing>) => void;
}

// Dropdown options for constrained fields
const ERA_OPTIONS = ['', 'Koto', 'Shinto', 'Shinshinto', 'Gendaito', 'Shinsakuto'];
const MEI_OPTIONS = ['', 'signed', 'unsigned', 'attributed', 'orikaeshi-mei', 'kinzogan-mei'];
const CURRENCY_OPTIONS = ['JPY', 'USD', 'EUR', 'GBP'];

const ITEM_TYPE_OPTIONS = [
  { group: 'Blades', options: ['katana', 'wakizashi', 'tanto', 'tachi', 'kodachi', 'naginata', 'naginata naoshi', 'yari', 'ken', 'daisho'] },
  { group: 'Tosogu', options: ['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi_kashira', 'futatokoro', 'mitokoromono', 'tosogu'] },
  { group: 'Other', options: ['armor', 'helmet', 'koshirae', 'stand', 'book', 'other', 'unknown'] },
];

// Fields to display in each group
interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'item_type';
  options?: string[];
  step?: string;
}

const SWORD_ATTRIBUTION: FieldDef[] = [
  { key: 'smith', label: 'Smith', type: 'text' },
  { key: 'school', label: 'School', type: 'text' },
];

const TOSOGU_ATTRIBUTION: FieldDef[] = [
  { key: 'tosogu_maker', label: 'Tosogu Maker', type: 'text' },
  { key: 'tosogu_school', label: 'Tosogu School', type: 'text' },
];

const SHARED_ATTRIBUTION: FieldDef[] = [
  { key: 'province', label: 'Province', type: 'text' },
  { key: 'era', label: 'Period', type: 'select', options: ERA_OPTIONS },
  { key: 'mei_type', label: 'Signature', type: 'select', options: MEI_OPTIONS },
];

// All attribution fields — used for value initialization and diff (includes hidden fields)
const ALL_ATTRIBUTION_FIELDS: FieldDef[] = [
  ...SWORD_ATTRIBUTION,
  ...TOSOGU_ATTRIBUTION,
  ...SHARED_ATTRIBUTION,
];

const SPEC_FIELDS: FieldDef[] = [
  { key: 'nagasa_cm', label: 'Nagasa (cm)', type: 'number', step: '0.01' },
  { key: 'sori_cm', label: 'Sori (cm)', type: 'number', step: '0.01' },
  { key: 'motohaba_cm', label: 'Motohaba (cm)', type: 'number', step: '0.01' },
  { key: 'sakihaba_cm', label: 'Sakihaba (cm)', type: 'number', step: '0.01' },
  { key: 'kasane_cm', label: 'Kasane (cm)', type: 'number', step: '0.01' },
  { key: 'weight_g', label: 'Weight (g)', type: 'number', step: '1' },
];

const PRICE_FIELDS: FieldDef[] = [
  { key: 'price_value', label: 'Price', type: 'number', step: '1' },
  { key: 'price_currency', label: 'Currency', type: 'select', options: CURRENCY_OPTIONS },
];

// =============================================================================
// LOCK ICON
// =============================================================================

function LockIcon({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      className="text-amber-400 hover:text-amber-300 transition-colors"
      title={title}
    >
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldEditSection({ listing, onRefresh }: FieldEditSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedFields, setLockedFields] = useState<Record<string, boolean>>(
    listing.admin_locked_fields || {}
  );

  // Show only relevant attribution fields based on item_type
  const visibleAttributionFields = useMemo(() => {
    const itemType = listing.item_type;
    if (itemType && isBlade(itemType)) {
      return [...SWORD_ATTRIBUTION, ...SHARED_ATTRIBUTION];
    }
    if (itemType && isTosogu(itemType)) {
      return [...TOSOGU_ATTRIBUTION, ...SHARED_ATTRIBUTION];
    }
    // Armor, unknown, etc. — show all fields as safe fallback
    return ALL_ATTRIBUTION_FIELDS;
  }, [listing.item_type]);

  // Sync locked fields when listing changes
  useEffect(() => {
    setLockedFields(listing.admin_locked_fields || {});
    setEditMode(false);
    setSuccess(false);
    setError(null);
  }, [listing.id, listing.admin_locked_fields]);

  // Get current value from listing for a field key
  const getListingValue = useCallback((key: string): string => {
    const val = (listing as unknown as Record<string, unknown>)[key];
    if (val === null || val === undefined) return '';
    return String(val);
  }, [listing]);

  // Open edit mode — populate form with current values
  const openEditMode = useCallback(() => {
    const allFields = [...ALL_ATTRIBUTION_FIELDS, ...SPEC_FIELDS, ...PRICE_FIELDS, { key: 'item_type' }];
    const values: Record<string, string> = {};
    for (const f of allFields) {
      values[f.key] = getListingValue(f.key);
    }
    setEditValues(values);
    setEditMode(true);
    setError(null);
    setSuccess(false);
  }, [getListingValue]);

  // Save only changed fields
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      // Build payload of only changed fields (diff all fields, including hidden ones)
      const allFields = [...ALL_ATTRIBUTION_FIELDS, ...SPEC_FIELDS, ...PRICE_FIELDS, { key: 'item_type' }];
      const payload: Record<string, unknown> = {};

      for (const f of allFields) {
        const editedStr = editValues[f.key] ?? '';
        const originalStr = getListingValue(f.key);

        if (editedStr !== originalStr) {
          payload[f.key] = editedStr === '' ? null : editedStr;
        }
      }

      if (Object.keys(payload).length === 0) {
        setEditMode(false);
        return;
      }

      const res = await fetch(`/api/listing/${listing.id}/fix-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const result = await res.json();
      setLockedFields(result.lockedFields || {});
      setEditMode(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Optimistic update + event dispatch
      const optimistic: Record<string, unknown> = { ...payload, admin_locked_fields: result.lockedFields };
      onRefresh(optimistic as Partial<Listing>);
      window.dispatchEvent(new CustomEvent('listing-refreshed', {
        detail: { id: listing.id, ...optimistic },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Unlock a single field
  const handleUnlock = async (fieldName: string) => {
    try {
      const res = await fetch(`/api/listing/${listing.id}/unlock-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: [fieldName] }),
      });

      if (!res.ok) throw new Error('Failed to unlock');

      const result = await res.json();
      setLockedFields(result.lockedFields || {});
      onRefresh({ admin_locked_fields: result.lockedFields } as Partial<Listing>);
    } catch (err) {
      console.error('Failed to unlock field:', err);
    }
  };

  // Render a single field row
  const renderField = (field: FieldDef) => {
    const isLocked = lockedFields[field.key];
    const value = editMode ? (editValues[field.key] ?? '') : getListingValue(field.key);

    return (
      <div key={field.key}>
        <div className="flex items-center gap-1 mb-0.5">
          <label className="text-[9px] uppercase tracking-wider text-muted">{field.label}</label>
          {isLocked && (
            <LockIcon
              onClick={() => handleUnlock(field.key)}
              title="Locked — click to unlock (allows scraper to overwrite)"
            />
          )}
        </div>
        {editMode ? (
          field.type === 'select' ? (
            <select
              value={editValues[field.key] ?? ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-ink focus:outline-none focus:border-gold"
            >
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt || '—'}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              step={field.step}
              value={editValues[field.key] ?? ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-ink placeholder:text-muted focus:outline-none focus:border-gold"
              placeholder={field.label}
            />
          )
        ) : (
          <div className="text-xs text-ink min-h-[1.75rem] flex items-center px-1">
            {value || <span className="text-muted italic">—</span>}
          </div>
        )}
      </div>
    );
  };

  // Render item_type as a special grouped select
  const renderItemType = () => {
    const isLocked = lockedFields['item_type'];
    const value = editMode ? (editValues['item_type'] ?? '') : getListingValue('item_type');

    return (
      <div>
        <div className="flex items-center gap-1 mb-0.5">
          <label className="text-[9px] uppercase tracking-wider text-muted">Item Type</label>
          {isLocked && (
            <LockIcon
              onClick={() => handleUnlock('item_type')}
              title="Locked — click to unlock (allows scraper to overwrite)"
            />
          )}
        </div>
        {editMode ? (
          <select
            value={editValues['item_type'] ?? ''}
            onChange={(e) => setEditValues(prev => ({ ...prev, item_type: e.target.value }))}
            className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-ink focus:outline-none focus:border-gold"
          >
            <option value="">—</option>
            {ITEM_TYPE_OPTIONS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <div className="text-xs text-ink min-h-[1.75rem] flex items-center px-1">
            {value || <span className="text-muted italic">—</span>}
          </div>
        )}
      </div>
    );
  };

  const hasAnyLock = Object.keys(lockedFields).length > 0;

  return (
    <div className="pb-4 border-b border-border">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          Fields
          {hasAnyLock && (
            <span className="ml-1.5 text-amber-400">
              ({Object.keys(lockedFields).length} locked)
            </span>
          )}
        </div>
        {!editMode ? (
          <button
            onClick={openEditMode}
            className="text-[10px] text-gold hover:text-gold-light font-medium transition-colors"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditMode(false); setError(null); }}
              disabled={saving}
              className="text-[10px] text-muted hover:text-ink font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`text-[10px] text-gold hover:text-gold-light font-medium transition-colors ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Success flash */}
      {success && (
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] text-green-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Fields updated
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-2.5 text-[10px] text-red-500">{error}</div>
      )}

      {/* Attribution */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wider text-muted/60 mb-1.5">Attribution</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {visibleAttributionFields.map(renderField)}
        </div>
      </div>

      {/* Specs */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wider text-muted/60 mb-1.5">Specifications</div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          {SPEC_FIELDS.map(renderField)}
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wider text-muted/60 mb-1.5">Price</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {PRICE_FIELDS.map(renderField)}
        </div>
      </div>

      {/* Item Type */}
      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted/60 mb-1.5">Classification</div>
        {renderItemType()}
      </div>
    </div>
  );
}

export default FieldEditSection;
