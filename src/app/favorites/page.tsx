import { redirect } from 'next/navigation';

/**
 * Redirect from old /favorites to new unified /saved page (watchlist tab)
 */
export default function FavoritesRedirect() {
  redirect('/saved?tab=watchlist');
}
