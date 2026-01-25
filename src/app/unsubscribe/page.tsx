import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Unsubscribe - Nihontowatch',
  description: 'Manage your email subscription preferences',
  robots: 'noindex',
};

interface PageProps {
  searchParams: Promise<{ status?: string; detail?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status || 'error';
  const detail = params.detail || 'unknown';

  const isSuccess = status === 'success';

  // Determine message based on success type
  const getMessage = () => {
    if (!isSuccess) {
      return {
        title: 'Unsubscribe Failed',
        message: getErrorMessage(detail),
        icon: (
          <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    }

    switch (detail) {
      case 'all':
        return {
          title: 'Successfully Unsubscribed',
          message: 'You have been unsubscribed from all Nihontowatch email notifications. You will no longer receive any alerts or marketing emails from us.',
          icon: (
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'marketing':
        return {
          title: 'Unsubscribed from Marketing',
          message: 'You have been unsubscribed from marketing emails. You will still receive important account notifications and alerts you\'ve set up.',
          icon: (
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'saved_search':
        return {
          title: 'Alert Disabled',
          message: 'Notifications for this saved search have been disabled. You can re-enable them anytime from your saved searches page.',
          icon: (
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      default:
        return {
          title: 'Unsubscribed',
          message: 'Your email preferences have been updated.',
          icon: (
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'Missing unsubscribe token':
      case 'Invalid token format':
      case 'Invalid token signature':
        return 'The unsubscribe link is invalid. Please use the link from your email or contact support.';
      case 'Token expired':
        return 'This unsubscribe link has expired. Please use a more recent email or visit your account settings to manage preferences.';
      case 'User not found':
        return 'We couldn\'t find your account. You may have already deleted it.';
      default:
        return 'Something went wrong while processing your request. Please try again or contact support.';
    }
  };

  const content = getMessage();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {content.icon}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-medium text-ink mb-4">
          {content.title}
        </h1>

        {/* Message */}
        <p className="text-muted mb-8">
          {content.message}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/browse"
            className="inline-flex items-center justify-center px-6 py-3 bg-gold text-white text-sm font-medium rounded-md hover:bg-gold/90 transition-colors"
          >
            Browse Collection
          </Link>
          {isSuccess && (
            <Link
              href="/saved"
              className="inline-flex items-center justify-center px-6 py-3 border border-border text-sm font-medium text-ink rounded-md hover:bg-surface transition-colors"
            >
              Manage Preferences
            </Link>
          )}
        </div>

        {/* Help Text */}
        <p className="mt-8 text-xs text-muted">
          Need help?{' '}
          <a href="mailto:support@nihontowatch.com" className="text-gold hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
