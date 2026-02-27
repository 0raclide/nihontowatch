import sgMail from '@sendgrid/mail';
import type { SavedSearch, Listing } from '@/types';
import { t, type Locale } from '@/i18n';
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
import {
  generateFeedbackAdminHtml,
  generateFeedbackAdminText,
} from './templates/feedback-admin';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@nihontowatch.com';
const ADMIN_EMAIL = process.env.SENDGRID_ADMIN_EMAIL || 'admin@nihontowatch.com';
const FROM_NAME = 'NihontoWatch';

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
  frequency: 'instant' | 'daily',
  userId?: string,
  locale: Locale = 'en'
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const searchName = savedSearch.name || t(locale, 'email.yourSavedSearch');
  const subject =
    frequency === 'instant'
      ? t(locale, 'email.newMatchesFound') + `: "${searchName}"`
      : t(locale, 'email.yourDailyDigest') + `: ${matchedListings.length} ${t(locale, matchedListings.length === 1 ? 'email.itemMatch' : 'email.itemsMatch', { count: matchedListings.length })}`;

  // Recipient info for unsubscribe links
  const recipient = userId ? { userId, email: to } : undefined;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generateSavedSearchNotificationText(savedSearch, matchedListings, frequency, recipient, locale),
      html: generateSavedSearchNotificationHtml(savedSearch, matchedListings, frequency, recipient, locale),
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
    userId?: string;
    locale?: Locale;
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
        sendSavedSearchNotification(n.to, n.savedSearch, n.matchedListings, n.frequency, n.userId, n.locale)
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
  newPrice: number,
  locale: Locale = 'en'
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
  const title = listing.title || t(locale, 'email.untitled');
  const formattedPercent = Math.abs(percentChange).toFixed(0);
  const subject = t(locale, 'email.priceDropTitle', { percent: formattedPercent }) + ` — ${title}`;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generatePriceDropNotificationText(listing, oldPrice, newPrice, percentChange, locale),
      html: generatePriceDropNotificationHtml(listing, oldPrice, newPrice, percentChange, locale),
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
  listing: Listing,
  locale: Locale = 'en'
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const title = listing.title || t(locale, 'email.untitled');
  const subject = `${title} — ${t(locale, 'email.backInStockTitle')}`;

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generateBackInStockNotificationText(listing, locale),
      html: generateBackInStockNotificationHtml(listing, locale),
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
 * Send admin notification when new user feedback is submitted
 */
export async function sendFeedbackAdminNotification(
  feedback: {
    feedback_type: import('@/types/feedback').FeedbackType;
    target_type?: import('@/types/feedback').FeedbackTargetType | null;
    target_id?: string | null;
    target_label?: string | null;
    message: string;
    page_url?: string | null;
    user_display_name: string;
  }
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping admin feedback email');
    return { success: false, error: 'SendGrid not configured' };
  }

  const TYPE_LABELS: Record<string, string> = {
    data_report: 'Data Report',
    bug: 'Bug Report',
    feature_request: 'Feature Request',
    other: 'Feedback',
  };
  const typeLabel = TYPE_LABELS[feedback.feedback_type] || 'Feedback';
  const subject = `[NihontoWatch] New ${typeLabel} from ${feedback.user_display_name}`;

  try {
    const [response] = await sgMail.send({
      to: ADMIN_EMAIL,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text: generateFeedbackAdminText(feedback),
      html: generateFeedbackAdminHtml(feedback),
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    };
  } catch (error) {
    console.error('SendGrid admin feedback notification error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
