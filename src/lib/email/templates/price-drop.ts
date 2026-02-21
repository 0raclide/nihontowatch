import type { Listing } from '@/types';
import { getImageUrl } from '@/lib/images';
import { t, type Locale } from '@/i18n';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';

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
 * Generate HTML email for price drop notification
 */
export function generatePriceDropNotificationHtml(
  listing: Listing,
  oldPrice: number,
  newPrice: number,
  percentChange: number,
  locale: Locale = 'en'
): string {
  const title = listing.title || t(locale, 'email.untitled');
  const currency = listing.price_currency || 'JPY';
  const imageUrl = getImageUrl(listing);
  const manageUrl = `${BASE_URL}/alerts`;
  const listingUrl = listing.url;

  const formattedOldPrice = formatPrice(oldPrice, currency, locale);
  const formattedNewPrice = formatPrice(newPrice, currency, locale);
  const formattedPercent = Math.abs(percentChange).toFixed(0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Alert</title>
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
                ${t(locale, 'email.priceDropTitle', { percent: formattedPercent })}
              </h1>
              <p style="margin: 0; color: #666; font-size: 14px;">
                ${t(locale, 'email.priceDropSubtitle')}
              </p>
            </td>
          </tr>

          <!-- Price Change Banner -->
          <tr>
            <td style="padding: 0 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px; text-align: center;">
                    <span style="color: #666; font-size: 14px; text-decoration: line-through;">${formattedOldPrice}</span>
                    <span style="color: #666; font-size: 14px; margin: 0 8px;">→</span>
                    <span style="color: #16a34a; font-size: 20px; font-weight: 600;">${formattedNewPrice}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Listing -->
          <tr>
            <td style="padding: 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="100" valign="top" style="padding-right: 16px;">
                          ${
                            imageUrl
                              ? `<img src="${imageUrl}" alt="${title}" width="100" height="100" style="display: block; border-radius: 4px; object-fit: cover;" />`
                              : `<div style="width: 100px; height: 100px; background-color: #f5f5f5; border-radius: 4px;"></div>`
                          }
                        </td>
                        <td valign="top">
                          <a href="${listingUrl}" style="color: #1a1a1a; text-decoration: none; font-weight: 500; font-size: 16px; line-height: 1.4;">
                            ${title}
                          </a>
                          <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
                            ${listing.item_type ? listing.item_type.charAt(0).toUpperCase() + listing.item_type.slice(1) : t(locale, 'email.item')}
                            ${listing.cert_type ? ` · ${listing.cert_type}` : ''}
                          </p>
                          ${listing.dealer?.name ? `<p style="margin: 4px 0 0; color: #666; font-size: 12px;">${t(locale, 'email.from')} ${listing.dealer.name}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 24px 24px; text-align: center;">
              <a href="${listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #b8860b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                ${t(locale, 'email.viewListing')}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #faf9f6; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-align: center;">
                ${t(locale, 'email.priceDropFooter')}
              </p>
              <p style="margin: 0; text-align: center;">
                <a href="${manageUrl}" style="color: #b8860b; text-decoration: none; font-size: 12px;">
                  ${t(locale, 'email.manageAlerts')}
                </a>
                <span style="color: #ccc; margin: 0 8px;">|</span>
                <a href="${BASE_URL}" style="color: #666; text-decoration: none; font-size: 12px;">
                  ${t(locale, 'email.visitSite')}
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
 * Generate plain text email for price drop notification
 */
export function generatePriceDropNotificationText(
  listing: Listing,
  oldPrice: number,
  newPrice: number,
  percentChange: number,
  locale: Locale = 'en'
): string {
  const title = listing.title || t(locale, 'email.untitled');
  const currency = listing.price_currency || 'JPY';
  const manageUrl = `${BASE_URL}/alerts`;
  const listingUrl = listing.url;

  const formattedOldPrice = formatPrice(oldPrice, currency, locale);
  const formattedNewPrice = formatPrice(newPrice, currency, locale);
  const formattedPercent = Math.abs(percentChange).toFixed(0);

  return `
${t(locale, 'email.priceDropAlert')}

${t(locale, 'email.priceDropText', { percent: formattedPercent })}

${title}

${t(locale, 'email.price')} ${formattedOldPrice} → ${formattedNewPrice}

${listing.item_type ? listing.item_type.charAt(0).toUpperCase() + listing.item_type.slice(1) : t(locale, 'email.item')}${listing.cert_type ? ` · ${listing.cert_type}` : ''}
${listing.dealer?.name ? `${t(locale, 'email.from')} ${listing.dealer.name}` : ''}

---

${t(locale, 'email.viewListingColon')} ${listingUrl}
${t(locale, 'email.manageAlertsColon')} ${manageUrl}

---

${t(locale, 'email.priceDropFooter')}
  `.trim();
}
