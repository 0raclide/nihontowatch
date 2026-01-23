/**
 * Stripe Utilities
 *
 * Re-exports for convenience. Use specific imports for tree-shaking:
 * - Server-side: import from '@/lib/stripe/server'
 * - Client-side: import from '@/lib/stripe/client'
 */

// Client-side exports (safe for browser)
export {
  getStripe,
  startCheckout,
  openBillingPortal,
  type CheckoutOptions,
} from './client';

// Note: Server-side exports should be imported directly from '@/lib/stripe/server'
// to avoid bundling server-only code in client bundles.
