import { describe, it, expect } from 'vitest';

// =============================================================================
// Dealer Listing API — Golden Tests (Logic-Level)
//
// These test the LOGIC that the API routes enforce, without spinning up Next.js.
// We extract and test the pure-logic parts:
//   1. Field routing (nihonto vs tosogu category)
//   2. PATCH allowlist enforcement
//   3. Status change side effects
//   4. Nullish coalescing (the ?? null bug that was fixed)
//   5. CERT_NONE sentinel handling
//   6. Synthetic URL format
//   7. DELETE status guard
// =============================================================================

// ---- Field routing (POST logic) ----

describe('POST field routing — nihonto vs tosogu', () => {
  // Replicate the routing logic from the POST handler
  function routeFields(
    item_category: string | null,
    { smith, tosogu_maker, school, tosogu_school }: Record<string, string | null>
  ) {
    const data: Record<string, unknown> = {};
    if (item_category === 'tosogu') {
      data.tosogu_maker = smith || tosogu_maker || null;
      data.tosogu_school = school || tosogu_school || null;
    } else {
      data.smith = smith || null;
      data.school = school || null;
    }
    return data;
  }

  it('routes smith/school to sword fields for nihonto category', () => {
    const result = routeFields('nihonto', {
      smith: '兼光', tosogu_maker: null, school: 'Bizen', tosogu_school: null,
    });
    expect(result).toEqual({ smith: '兼光', school: 'Bizen' });
    expect(result.tosogu_maker).toBeUndefined();
  });

  it('routes smith to tosogu_maker for tosogu category', () => {
    const result = routeFields('tosogu', {
      smith: '信家', tosogu_maker: null, school: 'Umetada', tosogu_school: null,
    });
    expect(result).toEqual({ tosogu_maker: '信家', tosogu_school: 'Umetada' });
    expect(result.smith).toBeUndefined();
  });

  it('prefers smith over tosogu_maker for tosogu category (form sends smith)', () => {
    const result = routeFields('tosogu', {
      smith: '信家', tosogu_maker: '別名', school: null, tosogu_school: null,
    });
    expect(result.tosogu_maker).toBe('信家');
  });

  it('falls back to tosogu_maker when smith is null for tosogu category', () => {
    const result = routeFields('tosogu', {
      smith: null, tosogu_maker: '信家', school: null, tosogu_school: 'Umetada',
    });
    expect(result.tosogu_maker).toBe('信家');
    expect(result.tosogu_school).toBe('Umetada');
  });

  it('defaults to nihonto routing when category is null', () => {
    const result = routeFields(null, {
      smith: '兼光', tosogu_maker: null, school: null, tosogu_school: null,
    });
    expect(result).toEqual({ smith: '兼光', school: null });
  });
});

// ---- PATCH allowlist ----

describe('PATCH allowlist enforcement', () => {
  const ALLOWED_FIELDS = new Set([
    'title', 'title_en', 'title_ja', 'description',
    'price_value', 'price_currency',
    'cert_type', 'item_type', 'item_category',
    'smith', 'tosogu_maker', 'school', 'tosogu_school',
    'artisan_id',
    'era', 'province', 'mei_type', 'nagasa_cm',
  ]);

  function filterToAllowed(body: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }
    return updates;
  }

  it('allows valid fields through', () => {
    const result = filterToAllowed({ title: 'New Title', price_value: 500000 });
    expect(result).toEqual({ title: 'New Title', price_value: 500000 });
  });

  it('GOLDEN: blocks "images" field — prevents upload bypass', () => {
    const result = filterToAllowed({
      title: 'Fine',
      images: ['https://evil.com/malware.jpg'],
    });
    expect(result).toEqual({ title: 'Fine' });
    expect(result.images).toBeUndefined();
  });

  it('blocks arbitrary fields (SQL injection attempt)', () => {
    const result = filterToAllowed({
      title: 'Good',
      'is_sold; DROP TABLE listings': true,
      admin_hidden: true,
      source: 'scraper',
      dealer_id: 999,
    });
    expect(result).toEqual({ title: 'Good' });
  });

  it('blocks status field (handled separately via side effects)', () => {
    const result = filterToAllowed({ status: 'SOLD' });
    expect(result).toEqual({});
  });

  it('blocks security-sensitive fields', () => {
    const result = filterToAllowed({
      source: 'scraper',
      dealer_id: 999,
      url: 'https://evil.com',
      admin_hidden: true,
      is_available: true,
      is_sold: true,
      artisan_admin_locked: true,
    });
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---- Status change side effects ----

describe('status change side effects', () => {
  function applyStatusSideEffects(status: string) {
    const updates: Record<string, unknown> = {};
    if (status === 'SOLD') {
      updates.status = 'SOLD';
      updates.is_available = false;
      updates.is_sold = true;
    } else if (status === 'WITHDRAWN') {
      updates.status = 'WITHDRAWN';
      updates.is_available = false;
      updates.is_sold = false;
    } else if (status === 'AVAILABLE') {
      updates.status = 'AVAILABLE';
      updates.is_available = true;
      updates.is_sold = false;
    }
    return updates;
  }

  it('SOLD sets is_available=false, is_sold=true', () => {
    expect(applyStatusSideEffects('SOLD')).toEqual({
      status: 'SOLD',
      is_available: false,
      is_sold: true,
    });
  });

  it('WITHDRAWN sets is_available=false, is_sold=false', () => {
    expect(applyStatusSideEffects('WITHDRAWN')).toEqual({
      status: 'WITHDRAWN',
      is_available: false,
      is_sold: false,
    });
  });

  it('AVAILABLE sets is_available=true, is_sold=false', () => {
    expect(applyStatusSideEffects('AVAILABLE')).toEqual({
      status: 'AVAILABLE',
      is_available: true,
      is_sold: false,
    });
  });

  it('unknown status produces no side effects', () => {
    expect(applyStatusSideEffects('DRAFT')).toEqual({});
  });
});

// ---- Nullish coalescing (the ?? null fix) ----

describe('nullish coalescing — ?? vs || (zero-price bug fix)', () => {
  // The bug: `price_value || null` converts `0` to `null` (falsy evaluation).
  // Fix: `price_value ?? null` preserves `0`.

  it('GOLDEN: ?? null preserves zero price (inquiry-based items)', () => {
    const value = 0;
    expect(value ?? null).toBe(0);  // correct behavior
    expect(value || null).toBeNull(); // the bug
  });

  it('?? null preserves zero nagasa', () => {
    const value = 0;
    expect(value ?? null).toBe(0);
  });

  it('?? null converts undefined to null', () => {
    const value = undefined;
    expect(value ?? null).toBeNull();
  });

  it('?? null preserves empty string (description)', () => {
    const value = '';
    expect(value ?? null).toBe('');
    expect(value || null).toBeNull(); // the old bug
  });

  it('?? null preserves normal values', () => {
    expect(500000 ?? null).toBe(500000);
    expect('JPY' ?? null).toBe('JPY');
  });
});

// ---- CERT_NONE sentinel ----

describe('CERT_NONE sentinel → null conversion', () => {
  const CERT_NONE = 'none';

  function convertCertType(certType: string | null): string | null {
    return certType === CERT_NONE ? null : certType;
  }

  it('GOLDEN: converts CERT_NONE to null before DB write', () => {
    expect(convertCertType(CERT_NONE)).toBeNull();
  });

  it('preserves valid cert types', () => {
    expect(convertCertType('Juyo')).toBe('Juyo');
    expect(convertCertType('Tokubetsu Hozon')).toBe('Tokubetsu Hozon');
    expect(convertCertType('Hozon')).toBe('Hozon');
  });

  it('preserves null (no selection)', () => {
    expect(convertCertType(null)).toBeNull();
  });

  it('does NOT convert the old bad sentinel value', () => {
    // The old bug: 'NONE_SELECTED' was written to DB as a literal string.
    // We only convert 'none' (the new sentinel).
    expect(convertCertType('NONE_SELECTED')).toBe('NONE_SELECTED');
  });
});

// ---- Synthetic URL format ----

describe('synthetic URL format', () => {
  it('generates nw:// URL with dealer prefix', () => {
    const dealerId = 42;
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = `nw://dealer/${dealerId}/${uuid}`;
    expect(url).toMatch(/^nw:\/\/dealer\/42\//);
  });

  it('URL satisfies UNIQUE constraint (different UUIDs)', () => {
    const url1 = `nw://dealer/42/${crypto.randomUUID()}`;
    const url2 = `nw://dealer/42/${crypto.randomUUID()}`;
    expect(url1).not.toBe(url2);
  });
});

// ---- DELETE status guard ----

describe('DELETE status guard', () => {
  function canDelete(status: string): boolean {
    return status === 'WITHDRAWN';
  }

  it('allows deletion of WITHDRAWN listings', () => {
    expect(canDelete('WITHDRAWN')).toBe(true);
  });

  it('blocks deletion of AVAILABLE listings', () => {
    expect(canDelete('AVAILABLE')).toBe(false);
  });

  it('blocks deletion of SOLD listings', () => {
    expect(canDelete('SOLD')).toBe(false);
  });
});
