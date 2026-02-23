/**
 * Tests for validateCriteria — server-side saved search validation.
 *
 * Regression: category-only criteria was rejected because validateCriteria
 * did not check criteria.category, while the client-side hasFilters check did.
 * This caused the MobileAlertBar save button to silently fail.
 */

import { describe, it, expect } from 'vitest';
import { validateCriteria } from '@/lib/savedSearches/validateCriteria';
import type { SavedSearchCriteria } from '@/types';

const empty: SavedSearchCriteria = {
  tab: 'available',
  itemTypes: [],
  certifications: [],
  dealers: [],
  schools: [],
  sort: 'featured',
};

describe('validateCriteria', () => {
  // ---------------------------------------------------------------------------
  // Valid criteria (should return null)
  // ---------------------------------------------------------------------------

  it('accepts criteria with itemTypes', () => {
    expect(validateCriteria({ ...empty, itemTypes: ['katana'] })).toBeNull();
  });

  it('accepts criteria with certifications', () => {
    expect(validateCriteria({ ...empty, certifications: ['Juyo'] })).toBeNull();
  });

  it('accepts criteria with dealers', () => {
    expect(validateCriteria({ ...empty, dealers: ['aoi-art'] })).toBeNull();
  });

  it('accepts criteria with schools', () => {
    expect(validateCriteria({ ...empty, schools: ['Bizen'] })).toBeNull();
  });

  it('accepts criteria with query', () => {
    expect(validateCriteria({ ...empty, query: 'masamune' })).toBeNull();
  });

  it('accepts criteria with minPrice', () => {
    expect(validateCriteria({ ...empty, minPrice: 100000 })).toBeNull();
  });

  it('accepts criteria with maxPrice', () => {
    expect(validateCriteria({ ...empty, maxPrice: 500000 })).toBeNull();
  });

  it('accepts criteria with askOnly', () => {
    expect(validateCriteria({ ...empty, askOnly: true })).toBeNull();
  });

  it('accepts criteria with category (regression test)', () => {
    expect(validateCriteria({ ...empty, category: 'nihonto' })).toBeNull();
  });

  it('accepts criteria with category as the only filter', () => {
    expect(validateCriteria({ ...empty, category: 'tosogu' })).toBeNull();
  });

  it('accepts criteria with multiple filters', () => {
    expect(
      validateCriteria({
        ...empty,
        category: 'nihonto',
        itemTypes: ['katana'],
        certifications: ['Juyo'],
      })
    ).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Invalid criteria (should return error string)
  // ---------------------------------------------------------------------------

  it('rejects empty criteria with no filters', () => {
    expect(validateCriteria(empty)).toBe('At least one search filter is required');
  });

  it('rejects criteria with empty arrays only', () => {
    expect(
      validateCriteria({
        ...empty,
        itemTypes: [],
        certifications: [],
        dealers: [],
        schools: [],
      })
    ).toBe('At least one search filter is required');
  });

  it('rejects invalid itemTypes (not array)', () => {
    expect(
      validateCriteria({ ...empty, itemTypes: 'katana' as unknown as string[] })
    ).toBe('itemTypes must be an array');
  });

  it('rejects invalid certifications (not array)', () => {
    expect(
      validateCriteria({ ...empty, certifications: 'Juyo' as unknown as string[] })
    ).toBe('certifications must be an array');
  });

  it('rejects invalid dealers (not array)', () => {
    expect(
      validateCriteria({ ...empty, dealers: 'aoi' as unknown as string[] })
    ).toBe('dealers must be an array');
  });

  it('rejects inverted price range', () => {
    expect(
      validateCriteria({ ...empty, minPrice: 500000, maxPrice: 100000 })
    ).toBe('minPrice cannot be greater than maxPrice');
  });
});
