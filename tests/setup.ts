import '@testing-library/jest-dom';

// =============================================================================
// Warning Suppression for Known Harmless Test Environment Warnings
// =============================================================================

const originalError = console.error;
const originalWarn = console.warn;

// Patterns for warnings that are safe to suppress in test environment
const SUPPRESSED_ERRORS = [
  /not wrapped in act/,                    // React async state update warnings
  /for a non-boolean attribute `fill`/,    // Next.js Image component internals
  /for a non-boolean attribute `priority`/, // Next.js Image component internals
  /`blurDataURL` prop on a DOM element/,   // Next.js Image component internals
  /\[Supabase\].*is not configured/,       // Expected in test env - mocked anyway
];

const SUPPRESSED_WARNINGS = [
  /NEXT_PUBLIC_SUPABASE_URL is not configured/,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured/,
];

console.error = (...args: Parameters<typeof console.error>) => {
  const message = args[0]?.toString() || '';
  if (SUPPRESSED_ERRORS.some(pattern => pattern.test(message))) {
    return;
  }
  originalError.apply(console, args);
};

console.warn = (...args: Parameters<typeof console.warn>) => {
  const message = args[0]?.toString() || '';
  if (SUPPRESSED_WARNINGS.some(pattern => pattern.test(message))) {
    return;
  }
  originalWarn.apply(console, args);
};

// Mock window.scrollTo to prevent "Not implemented" jsdom warnings
Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});
