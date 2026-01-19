import sgMail from '@sendgrid/mail';
import type { SavedSearch, Listing } from '@/types';
import {
  generateSavedSearchNotificationHtml,
  generateSavedSearchNotificationText,
} from './templates/saved-search';
import {
  generatePriceDropNotificationHtml,
  generatePriceDropNotificationText,
} from './templates/price-drop';
import {
  generateBackInStockNotificationHtml,
  generateBackInStockNotificationText,
} from './templates/back-in-stock';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@nihontowatch.com';
const FROM_NAME = 'Nihontowatch';

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Send a saved search notification email
 */
export async function sendSavedSearchNotification(
  to: string,
  savedSearch: SavedSearch,
  matchedListings: Listing[],
  frequency: 'instant' | 'daily'
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const subject =
    frequency === 'instant'
      ? `New matches for "${savedSearch.name || 'your search'}"`
      : `Daily digest: ${matchedListings.length} new matches`;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generateSavedSearchNotificationText(savedSearch, matchedListings, frequency),
      html: generateSavedSearchNotificationHtml(savedSearch, matchedListings, frequency),
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Send a batch of saved search notifications
 * Returns results for each email sent
 */
export async function sendBatchNotifications(
  notifications: Array<{
    to: string;
    savedSearch: SavedSearch;
    matchedListings: Listing[];
    frequency: 'instant' | 'daily';
  }>
): Promise<SendEmailResult[]> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping batch emails');
    return notifications.map(() => ({ success: false, error: 'SendGrid not configured' }));
  }

  const results: SendEmailResult[] = [];

  // SendGrid has a rate limit, so we process in batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((n) =>
        sendSavedSearchNotification(n.to, n.savedSearch, n.matchedListings, n.frequency)
      )
    );

    results.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < notifications.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Send a price drop notification email
 */
export async function sendPriceDropNotification(
  to: string,
  listing: Listing,
  oldPrice: number,
  newPrice: number
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
  const title = listing.title || 'an item you\'re watching';
  const subject = `Price dropped ${Math.abs(percentChange).toFixed(0)}% on ${title}`;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generatePriceDropNotificationText(listing, oldPrice, newPrice, percentChange),
      html: generatePriceDropNotificationHtml(listing, oldPrice, newPrice, percentChange),
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Send a back in stock notification email
 */
export async function sendBackInStockNotification(
  to: string,
  listing: Listing
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const title = listing.title || 'An item you\'re watching';
  const subject = `${title} is back in stock!`;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generateBackInStockNotificationText(listing),
      html: generateBackInStockNotificationHtml(listing),
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
