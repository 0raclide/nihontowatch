import sgMail from '@sendgrid/mail';

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@nihontowatch.com';
const FROM_NAME = 'NihontoWatch';

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send a P0 pipeline-down alert to admin email(s).
 * Bypasses email budget — this is an ops alert, not a user notification.
 */
export async function sendPipelineAlert(
  to: string[],
  hoursSince: number,
  details: string
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[pipeline-alert] SENDGRID_API_KEY not configured');
    return { success: false, error: 'SendGrid not configured' };
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const hoursLabel = hoursSince < 0
    ? 'unknown duration'
    : `~${hoursSince}h`;

  const subject = `[P0] NihontoWatch scraper pipeline DOWN (${hoursLabel})`;

  const text = [
    'PIPELINE DOWN ALERT',
    '===================',
    '',
    `Status: CRITICAL`,
    `Downtime: ${hoursLabel}`,
    `Details: ${details}`,
    '',
    'Action required:',
    '1. Check GitHub Actions for scraper workflow failures',
    '2. Check Supabase for database connectivity issues',
    '3. Check Oshi-scrapper logs for errors',
    '',
    'This is an automated alert from NihontoWatch pipeline health monitor.',
    'You will not be re-alerted until the pipeline recovers and goes down again.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Pipeline DOWN</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">NihontoWatch Scraper Health Alert</p>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #991b1b; width: 120px;">Status</td>
            <td style="padding: 8px 0; color: #dc2626; font-weight: 700;">CRITICAL</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #991b1b;">Downtime</td>
            <td style="padding: 8px 0;">${hoursLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #991b1b;">Details</td>
            <td style="padding: 8px 0; font-size: 13px;">${details}</td>
          </tr>
        </table>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-top: 12px;">
          <p style="margin: 0 0 8px; font-weight: 600; font-size: 14px;">Action required:</p>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151;">
            <li style="margin-bottom: 4px;">Check GitHub Actions for scraper workflow failures</li>
            <li style="margin-bottom: 4px;">Check Supabase for database connectivity issues</li>
            <li>Check Oshi-scrapper logs for errors</li>
          </ol>
        </div>
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
          Automated alert from NihontoWatch pipeline health monitor.
          You will not be re-alerted until the pipeline recovers and goes down again.
        </p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text,
      html,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[pipeline-alert] SendGrid error:', error);
    return { success: false, error: message };
  }
}
