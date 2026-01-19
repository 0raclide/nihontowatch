import { redirect } from 'next/navigation';

/**
 * Redirect from old /alerts to new unified /saved page (watchlist tab)
 * Price drop and back-in-stock alerts are now managed in the Watchlist tab
 */
export default function AlertsRedirect() {
  redirect('/saved?tab=watchlist');
}
