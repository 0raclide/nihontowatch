import type { SavedSearch, Listing } from '@/types';
import { criteriaToHumanReadable, criteriaToUrl } from '@/lib/savedSearches/urlToCriteria';
import { getImageUrl } from '@/lib/images';
import { getUnsubscribeUrl } from '@/app/api/unsubscribe/route';
import { t, type Locale } from '@/i18n';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';

/**
 * Generate a Nihontowatch quickview URL for a listing.
 * When clicked, this opens the quickview modal via the DeepLinkHandler.
 *
 * @param listingId - The listing ID
 * @returns URL like https://nihontowatch.com/?listing=12345
 */
export function getListingQuickViewUrl(listingId: number): string {
  return `${BASE_URL}/?listing=${listingId}`;
}

/**
 * Generate a multi-listing QuickView carousel URL.
 * Opens all matched listings in a focused slideshow with prev/next navigation.
 *
 * @param listingIds - Array of listing IDs to include in the carousel
 * @param searchName - Optional search name for context display in the banner
 * @returns URL like https://nihontowatch.com/?listings=123,456,789&alert_search=Juyo+Katana
 */
export function getMultiListingQuickViewUrl(listingIds: number[], searchName?: string): string {
  const ids = listingIds.slice(0, 50).join(',');
  const url = new URL(`${BASE_URL}/`);
  url.searchParams.set('listings', ids);
  if (searchName) {
    url.searchParams.set('alert_search', searchName);
  }
  return url.toString();
}

interface EmailRecipient {
  userId: string;
  email: string;
}

/**
 * Format price for display in email
 */
function formatPrice(value: number | null | undefined, currency: string, locale: Locale = 'en'): string {
  if (value === null || value === undefined) {
    return t(locale, 'email.ask');
  }
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currency || 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Generate HTML email for saved search notification
 */
export function generateSavedSearchNotificationHtml(
  savedSearch: SavedSearch,
  matchedListings: Listing[],
  frequency: 'instant' | 'daily',
  recipient?: EmailRecipient,
  locale: Locale = 'en'
): string {
  const searchName = savedSearch.name || t(locale, 'email.yourSavedSearch');
  const criteriaSummary = criteriaToHumanReadable(savedSearch.search_criteria);
  const searchUrl = `${BASE_URL}${criteriaToUrl(savedSearch.search_criteria)}`;
  const manageUrl = `${BASE_URL}/saved`;

  // Generate unsubscribe URLs if recipient info provided
  const unsubscribeSearchUrl = recipient
    ? getUnsubscribeUrl({ userId: recipient.userId, email: recipient.email, type: 'saved_search', savedSearchId: savedSearch.id })
    : null;
  const unsubscribeAllUrl = recipient
    ? getUnsubscribeUrl({ userId: recipient.userId, email: recipient.email, type: 'all' })
    : null;

  const listingsHtml = matchedListings
    .slice(0, 10) // Limit to 10 in email
    .map(
      (listing) => `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e5e5;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="80" valign="top" style="padding-right: 16px;">
                ${
                  getImageUrl(listing)
                    ? `<img src="${getImageUrl(listing)}" alt="${listing.title}" width="80" height="80" style="display: block; border-radius: 4px; object-fit: cover;" />`
                    : `<div style="width: 80px; height: 80px; background-color: #f5f5f5; border-radius: 4px;"></div>`
                }
              </td>
              <td valign="top">
                <a href="${getListingQuickViewUrl(listing.id)}" style="color: #1a1a1a; text-decoration: none; font-weight: 500; font-size: 14px; line-height: 1.4;">
                  ${listing.title || t(locale, 'email.untitled')}
                </a>
                <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
                  ${listing.item_type ? listing.item_type.charAt(0).toUpperCase() + listing.item_type.slice(1) : t(locale, 'email.item')}
                  ${listing.cert_type ? ` · ${listing.cert_type}` : ''}
                </p>
                <p style="margin: 8px 0 0; color: #b8860b; font-weight: 600; font-size: 14px;">
                  ${formatPrice(listing.price_value, listing.price_currency || 'JPY', locale)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    )
    .join('');

  const moreCount = matchedListings.length - 10;
  const moreHtml =
    moreCount > 0
      ? `
      <tr>
        <td style="padding: 16px; text-align: center;">
          <a href="${searchUrl}" style="color: #b8860b; text-decoration: none; font-size: 14px;">
            ${moreCount === 1 ? t(locale, 'email.viewMoreSingular', { count: moreCount }) : t(locale, 'email.viewMore', { count: moreCount })}
          </a>
        </td>
      </tr>
    `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${frequency === 'instant' ? t(locale, 'email.newMatches') : t(locale, 'email.dailyDigest')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e5e5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; color: #1a1a1a;">
                      Nihonto<span style="color: #b8860b;">watch</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px;">
              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 500; color: #1a1a1a;">
                ${frequency === 'instant' ? t(locale, 'email.newMatchesFound') : t(locale, 'email.yourDailyDigest')}
              </h1>
              <p style="margin: 0 0 16px; color: #666; font-size: 14px;">
                ${matchedListings.length === 1 ? t(locale, 'email.itemMatch', { count: matchedListings.length }) : t(locale, 'email.itemsMatch', { count: matchedListings.length })} <strong>${searchName}</strong>
              </p>
              <p style="margin: 0; padding: 12px; background-color: #faf9f6; border-radius: 4px; color: #666; font-size: 12px;">
                <strong style="color: #1a1a1a;">${t(locale, 'email.searchCriteria')}</strong> ${criteriaSummary}
              </p>
            </td>
          </tr>

          <!-- Listings -->
          <tr>
            <td style="padding: 0 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
                ${listingsHtml}
                ${moreHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              ${matchedListings.length <= 50
                ? `<a href="${getMultiListingQuickViewUrl(matchedListings.map(l => l.id), savedSearch.name || undefined)}" style="display: inline-block; padding: 12px 24px; background-color: #b8860b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                ${matchedListings.length === 1 ? t(locale, 'email.viewMatchButton', { count: matchedListings.length }) : t(locale, 'email.viewMatchesButton', { count: matchedListings.length })}
              </a>`
                : `<a href="${searchUrl}" style="display: inline-block; padding: 12px 24px; background-color: #b8860b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                ${t(locale, 'email.viewMatchesButton', { count: matchedListings.length })}
              </a>`
              }
              <p style="margin: 12px 0 0; font-size: 12px;">
                <a href="${searchUrl}" style="color: #666; text-decoration: none;">
                  ${t(locale, 'email.orBrowseAll')}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #faf9f6; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-align: center;">
                ${t(locale, 'email.savedSearchFooter')}
              </p>
              <p style="margin: 0 0 12px; text-align: center;">
                <a href="${manageUrl}" style="color: #b8860b; text-decoration: none; font-size: 12px;">
                  ${t(locale, 'email.manageSavedSearches')}
                </a>
                <span style="color: #ccc; margin: 0 8px;">|</span>
                <a href="${BASE_URL}" style="color: #666; text-decoration: none; font-size: 12px;">
                  ${t(locale, 'email.visitSite')}
                </a>
              </p>
              ${unsubscribeSearchUrl ? `
              <p style="margin: 0; text-align: center; border-top: 1px solid #e5e5e5; padding-top: 12px;">
                <a href="${unsubscribeSearchUrl}" style="color: #999; text-decoration: none; font-size: 11px;">
                  ${t(locale, 'email.unsubscribeAlert')}
                </a>
                ${unsubscribeAllUrl ? `
                <span style="color: #ccc; margin: 0 8px;">|</span>
                <a href="${unsubscribeAllUrl}" style="color: #999; text-decoration: none; font-size: 11px;">
                  ${t(locale, 'email.unsubscribeAll')}
                </a>
                ` : ''}
              </p>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for saved search notification
 */
export function generateSavedSearchNotificationText(
  savedSearch: SavedSearch,
  matchedListings: Listing[],
  frequency: 'instant' | 'daily',
  recipient?: EmailRecipient,
  locale: Locale = 'en'
): string {
  const searchName = savedSearch.name || t(locale, 'email.yourSavedSearch');
  const criteriaSummary = criteriaToHumanReadable(savedSearch.search_criteria);
  const searchUrl = `${BASE_URL}${criteriaToUrl(savedSearch.search_criteria)}`;
  const manageUrl = `${BASE_URL}/saved`;

  // Generate unsubscribe URLs if recipient info provided
  const unsubscribeSearchUrl = recipient
    ? getUnsubscribeUrl({ userId: recipient.userId, email: recipient.email, type: 'saved_search', savedSearchId: savedSearch.id })
    : null;
  const unsubscribeAllUrl = recipient
    ? getUnsubscribeUrl({ userId: recipient.userId, email: recipient.email, type: 'all' })
    : null;

  const listingsText = matchedListings
    .slice(0, 10)
    .map((listing, i) => {
      const title = listing.title || t(locale, 'email.untitled');
      const price = formatPrice(listing.price_value, listing.price_currency || 'JPY', locale);
      return `${i + 1}. ${title}\n   ${price}\n   ${getListingQuickViewUrl(listing.id)}`;
    })
    .join('\n\n');

  const moreCount = matchedListings.length - 10;
  const moreText = moreCount > 0 ? `\n\n${t(locale, 'email.andMore', { count: moreCount })}` : '';

  const unsubscribeText = unsubscribeSearchUrl
    ? `\n\n${t(locale, 'email.unsubscribeAlert')}: ${unsubscribeSearchUrl}${unsubscribeAllUrl ? `\n${t(locale, 'email.unsubscribeAll')}: ${unsubscribeAllUrl}` : ''}`
    : '';

  return `
${frequency === 'instant' ? t(locale, 'email.newMatchesFoundText') : t(locale, 'email.yourDailyDigestText')}

${matchedListings.length === 1 ? t(locale, 'email.itemMatch', { count: matchedListings.length }) : t(locale, 'email.itemsMatch', { count: matchedListings.length })} "${searchName}"

${t(locale, 'email.searchCriteria')} ${criteriaSummary}

---

${listingsText}${moreText}

---

${matchedListings.length <= 50
    ? `${matchedListings.length === 1 ? t(locale, 'email.viewMatch', { count: matchedListings.length }) : t(locale, 'email.viewMatches', { count: matchedListings.length })}: ${getMultiListingQuickViewUrl(matchedListings.map(l => l.id), savedSearch.name || undefined)}`
    : `${t(locale, 'email.viewMatches', { count: matchedListings.length })}: ${searchUrl}`}
${t(locale, 'email.browseAllResults')}: ${searchUrl}
${t(locale, 'email.manageSavedSearches')}: ${manageUrl}

---

${t(locale, 'email.savedSearchFooter')}${unsubscribeText}
  `.trim();
}
