import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime } from '@/lib/time';

// Simple mock translator that returns the key + params for assertion
function mockT(key: string, params?: Record<string, string | number>): string {
  if (params) {
    let result = key;
    for (const [k, v] of Object.entries(params)) {
      result += `|${k}=${v}`;
    }
    return result;
  }
  return key;
}

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns justNow for timestamps less than 1 minute ago', () => {
    const thirtySecsAgo = new Date('2026-02-22T11:59:30Z').toISOString();
    expect(formatRelativeTime(thirtySecsAgo, mockT)).toBe('card.justNow');
  });

  it('returns justNow for timestamps exactly now', () => {
    const now = new Date('2026-02-22T12:00:00Z').toISOString();
    expect(formatRelativeTime(now, mockT)).toBe('card.justNow');
  });

  it('returns justNow for future timestamps', () => {
    const future = new Date('2026-02-22T13:00:00Z').toISOString();
    expect(formatRelativeTime(future, mockT)).toBe('card.justNow');
  });

  it('returns minutesAgo for 1 minute ago', () => {
    const oneMinAgo = new Date('2026-02-22T11:59:00Z').toISOString();
    expect(formatRelativeTime(oneMinAgo, mockT)).toBe('card.minutesAgo|n=1');
  });

  it('returns minutesAgo for 59 minutes ago', () => {
    const fiftyNineMinAgo = new Date('2026-02-22T11:01:00Z').toISOString();
    expect(formatRelativeTime(fiftyNineMinAgo, mockT)).toBe('card.minutesAgo|n=59');
  });

  it('returns hoursAgo at exactly 60 minutes', () => {
    const sixtyMinAgo = new Date('2026-02-22T11:00:00Z').toISOString();
    expect(formatRelativeTime(sixtyMinAgo, mockT)).toBe('card.hoursAgo|n=1');
  });

  it('returns hoursAgo for 23 hours ago', () => {
    const twentyThreeHrsAgo = new Date('2026-02-21T13:00:00Z').toISOString();
    expect(formatRelativeTime(twentyThreeHrsAgo, mockT)).toBe('card.hoursAgo|n=23');
  });

  it('returns daysAgo at exactly 24 hours', () => {
    const twentyFourHrsAgo = new Date('2026-02-21T12:00:00Z').toISOString();
    expect(formatRelativeTime(twentyFourHrsAgo, mockT)).toBe('card.daysAgo|n=1');
  });

  it('returns daysAgo for 7 days ago', () => {
    const sevenDaysAgo = new Date('2026-02-15T12:00:00Z').toISOString();
    expect(formatRelativeTime(sevenDaysAgo, mockT)).toBe('card.daysAgo|n=7');
  });

  it('returns daysAgo for 30 days ago', () => {
    const thirtyDaysAgo = new Date('2026-01-23T12:00:00Z').toISOString();
    expect(formatRelativeTime(thirtyDaysAgo, mockT)).toBe('card.daysAgo|n=30');
  });

  it('handles sub-second precision correctly', () => {
    // 500ms ago — still less than 1 minute
    const halfSecAgo = new Date('2026-02-22T11:59:59.500Z').toISOString();
    expect(formatRelativeTime(halfSecAgo, mockT)).toBe('card.justNow');
  });

  it('floors minutes (does not round up)', () => {
    // 1 min 59 sec ago → still 1 minute
    const almostTwoMin = new Date('2026-02-22T11:58:01Z').toISOString();
    expect(formatRelativeTime(almostTwoMin, mockT)).toBe('card.minutesAgo|n=1');
  });

  it('floors hours (does not round up)', () => {
    // 1 hr 59 min ago → still 1 hour
    const almostTwoHrs = new Date('2026-02-22T10:01:00Z').toISOString();
    expect(formatRelativeTime(almostTwoHrs, mockT)).toBe('card.hoursAgo|n=1');
  });

  it('floors days (does not round up)', () => {
    // 1 day 23 hrs ago → still 1 day
    const almostTwoDays = new Date('2026-02-20T13:00:00Z').toISOString();
    expect(formatRelativeTime(almostTwoDays, mockT)).toBe('card.daysAgo|n=1');
  });
});
