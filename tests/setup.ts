import '@testing-library/jest-dom';

// =============================================================================
// Warning Suppression for Known Harmless Test Environment Warnings
// =============================================================================

const originalError = console.error;
const originalWarn = console.warn;

// Patterns for warnings that are safe to suppress in test environment
const SUPPRESSED_ERRORS = [
  /not wrapped in act/,                         // React async state update warnings
  /non-boolean attribute.*fill/i,               // Next.js Image component internals
  /non-boolean attribute.*priority/i,           // Next.js Image component internals
  /blurDataURL.*prop.*DOM element/i,            // Next.js Image component internals
  /blurdataurl/i,                               // Next.js Image component lowercase
  /\[Supabase\].*is not configured/,            // Expected in test env - mocked anyway
  /Received.*for a non-boolean/i,               // React DOM boolean attribute warnings
  /React does not recognize.*prop/i,            // React unrecognized prop warnings
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
