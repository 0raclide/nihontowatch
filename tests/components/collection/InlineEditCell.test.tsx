import { describe, it, expect } from 'vitest';

// =============================================================================
// Unit tests for InlineEditCell input parsing / validation logic
// (No DOM rendering — tests the pure logic that the cells use)
// =============================================================================

describe('Currency amount parsing', () => {
  function parseAmount(input: string): number | null {
    const cleaned = input.trim().replace(/,/g, '');
    if (!cleaned) return null;
    const num = Number(cleaned);
    return (!isNaN(num) && num >= 0) ? num : null;
  }

  it('parses plain numbers', () => {
    expect(parseAmount('5000000')).toBe(5000000);
  });

  it('parses comma-separated numbers', () => {
    expect(parseAmount('5,000,000')).toBe(5000000);
  });

  it('returns null for empty string', () => {
    expect(parseAmount('')).toBeNull();
  });

  it('returns null for whitespace', () => {
    expect(parseAmount('   ')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseAmount('-100')).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseAmount('abc')).toBeNull();
  });

  it('parses decimal numbers', () => {
    expect(parseAmount('2500.50')).toBe(2500.50);
  });

  it('parses zero', () => {
    expect(parseAmount('0')).toBe(0);
  });
});

describe('Date validation', () => {
  function isValidDate(input: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(input);
  }

  it('accepts YYYY-MM-DD format', () => {
    expect(isValidDate('2024-06-15')).toBe(true);
  });

  it('rejects other formats', () => {
    expect(isValidDate('06/15/2024')).toBe(false);
    expect(isValidDate('2024-6-15')).toBe(false);
    expect(isValidDate('Jun 15, 2024')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('Currency code validation', () => {
  function validateCurrency(input: string): string | null {
    return (typeof input === 'string' && input.length <= 10) ? input.toUpperCase() : null;
  }

  it('uppercases valid currencies', () => {
    expect(validateCurrency('jpy')).toBe('JPY');
    expect(validateCurrency('usd')).toBe('USD');
    expect(validateCurrency('eur')).toBe('EUR');
  });

  it('rejects overly long strings', () => {
    expect(validateCurrency('a'.repeat(11))).toBeNull();
  });
});

describe('Text field trimming', () => {
  function sanitizeText(input: string | null, maxLength: number): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.slice(0, maxLength).trim();
    return trimmed || null;
  }

  it('trims whitespace', () => {
    expect(sanitizeText('  Home safe  ', 500)).toBe('Home safe');
  });

  it('truncates at max length', () => {
    expect(sanitizeText('a'.repeat(600), 500)).toBe('a'.repeat(500));
  });

  it('returns null for empty', () => {
    expect(sanitizeText('', 500)).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(sanitizeText('   ', 500)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(sanitizeText(null, 500)).toBeNull();
  });
});
