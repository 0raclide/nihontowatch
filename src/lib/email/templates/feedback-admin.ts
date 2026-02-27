import type { FeedbackType, FeedbackTargetType } from '@/types/feedback';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';

const TYPE_LABELS: Record<FeedbackType, string> = {
  data_report: 'Data Report',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  other: 'Other',
};

function targetLink(targetType: FeedbackTargetType | null, targetId: string | null, targetLabel: string | null): string {
  if (!targetType || !targetId) return '';
  const url = targetType === 'listing'
    ? `${BASE_URL}/listing/${targetId}`
    : `${BASE_URL}/artists/${targetId}`;
  const label = targetLabel || targetId;
  return `<a href="${url}" style="color: #b8860b;">${escapeHtml(label)}</a>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateFeedbackAdminHtml(feedback: {
  feedback_type: FeedbackType;
  target_type?: FeedbackTargetType | null;
  target_id?: string | null;
  target_label?: string | null;
  message: string;
  page_url?: string | null;
  user_display_name: string;
}): string {
  const typeLabel = TYPE_LABELS[feedback.feedback_type] || feedback.feedback_type;
  const target = targetLink(
    feedback.target_type || null,
    feedback.target_id || null,
    feedback.target_label || null
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e5e5;">
              <span style="font-size: 18px; font-weight: 600; color: #1a1a1a;">New ${escapeHtml(typeLabel)}</span>
              <span style="font-size: 13px; color: #888; margin-left: 8px;">from ${escapeHtml(feedback.user_display_name)}</span>
            </td>
          </tr>
          ${target ? `
          <tr>
            <td style="padding: 16px 24px 0;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #888;">Target</span>
              <div style="margin-top: 4px; font-size: 14px;">${target}</div>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 16px 24px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #888;">Message</span>
              <div style="margin-top: 8px; padding: 12px 16px; background: #fafaf5; border-radius: 6px; border: 1px solid #eee; font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(feedback.message)}</div>
            </td>
          </tr>
          ${feedback.page_url ? `
          <tr>
            <td style="padding: 0 24px 16px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #888;">Page</span>
              <div style="margin-top: 4px;"><a href="${escapeHtml(feedback.page_url)}" style="font-size: 12px; color: #b8860b; word-break: break-all;">${escapeHtml(feedback.page_url)}</a></div>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 16px 24px 24px; text-align: center;">
              <a href="${BASE_URL}/admin/feedback" style="display: inline-block; padding: 10px 24px; background-color: #b8860b; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">View in Dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateFeedbackAdminText(feedback: {
  feedback_type: FeedbackType;
  target_type?: FeedbackTargetType | null;
  target_id?: string | null;
  target_label?: string | null;
  message: string;
  page_url?: string | null;
  user_display_name: string;
}): string {
  const typeLabel = TYPE_LABELS[feedback.feedback_type] || feedback.feedback_type;
  const lines = [
    `New ${typeLabel} from ${feedback.user_display_name}`,
    '',
  ];

  if (feedback.target_label) {
    lines.push(`Target: ${feedback.target_label}`);
  }

  lines.push(`Message: ${feedback.message}`);

  if (feedback.page_url) {
    lines.push(`Page: ${feedback.page_url}`);
  }

  lines.push('', `View: ${BASE_URL}/admin/feedback`);

  return lines.join('\n');
}
