import type { SavedSearch, Listing } from '@/types';
import { criteriaToHumanReadable, criteriaToUrl } from '@/lib/savedSearches/urlToCriteria';
import { getImageUrl } from '@/lib/images';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';

/**
 * Format price for display in email
 */
function formatPrice(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) {
    return 'Ask';
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
  frequency: 'instant' | 'daily'
): string {
  const searchName = savedSearch.name || 'Your saved search';
  const criteriaSummary = criteriaToHumanReadable(savedSearch.search_criteria);
  const searchUrl = `${BASE_URL}${criteriaToUrl(savedSearch.search_criteria)}`;
  const manageUrl = `${BASE_URL}/saved-searches`;

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
                <a href="${listing.url}" style="color: #1a1a1a; text-decoration: none; font-weight: 500; font-size: 14px; line-height: 1.4;">
                  ${listing.title || 'Untitled listing'}
                </a>
                <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
                  ${listing.item_type ? listing.item_type.charAt(0).toUpperCase() + listing.item_type.slice(1) : 'Item'}
                  ${listing.cert_type ? ` · ${listing.cert_type}` : ''}
                </p>
                <p style="margin: 8px 0 0; color: #b8860b; font-weight: 600; font-size: 14px;">
                  ${formatPrice(listing.price_value, listing.price_currency || 'JPY')}
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
            View ${moreCount} more match${moreCount === 1 ? '' : 'es'} →
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
  <title>${frequency === 'instant' ? 'New matches' : 'Daily digest'}</title>
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
                ${frequency === 'instant' ? 'New matches found' : 'Your daily digest'}
              </h1>
              <p style="margin: 0 0 16px; color: #666; font-size: 14px;">
                ${matchedListings.length} new item${matchedListings.length === 1 ? '' : 's'} match${matchedListings.length === 1 ? 'es' : ''} <strong>${searchName}</strong>
              </p>
              <p style="margin: 0; padding: 12px; background-color: #faf9f6; border-radius: 4px; color: #666; font-size: 12px;">
                <strong style="color: #1a1a1a;">Search criteria:</strong> ${criteriaSummary}
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
              <a href="${searchUrl}" style="display: inline-block; padding: 12px 24px; background-color: #b8860b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                View All Results
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #faf9f6; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-align: center;">
                You're receiving this email because you set up a saved search on Nihontowatch.
              </p>
              <p style="margin: 0; text-align: center;">
                <a href="${manageUrl}" style="color: #b8860b; text-decoration: none; font-size: 12px;">
                  Manage saved searches
                </a>
                <span style="color: #ccc; margin: 0 8px;">|</span>
                <a href="${BASE_URL}" style="color: #666; text-decoration: none; font-size: 12px;">
                  Visit Nihontowatch
                </a>
              </p>
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
  frequency: 'instant' | 'daily'
): string {
  const searchName = savedSearch.name || 'Your saved search';
  const criteriaSummary = criteriaToHumanReadable(savedSearch.search_criteria);
  const searchUrl = `${BASE_URL}${criteriaToUrl(savedSearch.search_criteria)}`;
  const manageUrl = `${BASE_URL}/saved-searches`;

  const listingsText = matchedListings
    .slice(0, 10)
    .map((listing, i) => {
      const title = listing.title || 'Untitled listing';
      const price = formatPrice(listing.price_value, listing.price_currency || 'JPY');
      return `${i + 1}. ${title}\n   ${price}\n   ${listing.url}`;
    })
    .join('\n\n');

  const moreCount = matchedListings.length - 10;
  const moreText = moreCount > 0 ? `\n\n... and ${moreCount} more matches` : '';

  return `
${frequency === 'instant' ? 'NEW MATCHES FOUND' : 'YOUR DAILY DIGEST'}

${matchedListings.length} new item${matchedListings.length === 1 ? '' : 's'} match${matchedListings.length === 1 ? 'es' : ''} "${searchName}"

Search criteria: ${criteriaSummary}

---

${listingsText}${moreText}

---

View all results: ${searchUrl}
Manage saved searches: ${manageUrl}

---

You're receiving this email because you set up a saved search on Nihontowatch.
  `.trim();
}
