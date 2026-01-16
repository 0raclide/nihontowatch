import { describe, it, expect } from 'vitest';
import * as searchModule from '@/lib/search';

describe('Debug: Search Module Exports', () => {
  it('should list all exports', () => {
    console.log('Search module exports:', Object.keys(searchModule));
    expect(Object.keys(searchModule).length).toBeGreaterThan(0);
  });
});
