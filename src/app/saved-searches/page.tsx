import { redirect } from 'next/navigation';

/**
 * Redirect from old /saved-searches to new unified /saved page
 */
export default function SavedSearchesRedirect() {
  redirect('/saved');
}
