'use client';

import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

const lastUpdated = 'January 25, 2026';

export default function CookiesPage() {
  const { openPreferences } = useConsent();

  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-muted text-sm">Last updated: {lastUpdated}</p>

      <section>
        <h2>1. What Are Cookies?</h2>
        <p>
          Cookies are small text files placed on your device when you visit a website. They are
          widely used to make websites work efficiently and provide information to website owners.
        </p>
        <p>
          In addition to cookies, we also use similar technologies such as:
        </p>
        <ul>
          <li>
            <strong>Local Storage:</strong> Stores data in your browser that persists across sessions
          </li>
          <li>
            <strong>Session Storage:</strong> Stores data that is cleared when you close your browser tab
          </li>
        </ul>
        <p>
          Throughout this policy, we refer to all these technologies collectively as &quot;cookies.&quot;
        </p>
      </section>

      <section>
        <h2>2. How We Use Cookies</h2>
        <p>We use cookies for the following purposes:</p>
        <ul>
          <li>To authenticate you and keep you logged in</li>
          <li>To remember your preferences (theme, currency)</li>
          <li>To understand how you use our Service</li>
          <li>To improve our Service based on usage patterns</li>
          <li>To remember your cookie consent preferences</li>
        </ul>
      </section>

      <section>
        <h2>3. Types of Cookies We Use</h2>

        <h3>3.1 Essential Cookies</h3>
        <p>
          These cookies are necessary for the Service to function and cannot be disabled. They include:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>sb-*</code></td>
                <td>Supabase authentication session</td>
                <td>Session / 1 year</td>
              </tr>
              <tr>
                <td><code>nihontowatch_consent</code></td>
                <td>Stores your cookie consent preferences</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td><code>nihontowatch_session</code></td>
                <td>Current browsing session identifier</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>3.2 Functional Cookies</h3>
        <p>
          These cookies enable personalized features and remember your preferences. They require your
          consent:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>theme</code></td>
                <td>Remembers your light/dark mode preference</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td><code>currency</code></td>
                <td>Remembers your preferred currency (JPY/USD/EUR)</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td><code>nihontowatch_auth_cache</code></td>
                <td>Caches authentication state for performance</td>
                <td>1 hour</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>3.3 Analytics Cookies</h3>
        <p>
          These cookies help us understand how visitors use our Service. They require your consent:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>nihontowatch_visitor_id</code></td>
                <td>Unique identifier for anonymous analytics</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td><code>nihontowatch_visitor_created</code></td>
                <td>When the visitor ID was created</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td><code>nihontowatch_session_id</code></td>
                <td>Tracks the current browsing session for analytics</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Note:</strong> If you do not consent to analytics cookies, we will not create a
          persistent visitor ID. Instead, a temporary session-only identifier is used that is deleted
          when you close your browser.
        </p>

        <h3>3.4 Marketing Cookies</h3>
        <p>
          We currently do not use marketing or advertising cookies. This section is reserved for
          future use. If we begin using such cookies, we will update this policy and request your
          consent.
        </p>
      </section>

      <section>
        <h2>4. Third-Party Cookies</h2>
        <p>
          Some cookies are set by third-party services we use:
        </p>

        <h3>4.1 Stripe (Payment Processing)</h3>
        <p>
          When you make a payment, Stripe may set cookies for fraud detection and security purposes.
          These are essential for payment processing. See{' '}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe&apos;s Privacy Policy
          </a>.
        </p>

        <h3>4.2 Supabase (Authentication)</h3>
        <p>
          Supabase sets cookies to manage your authentication session. These are essential for logging
          in. See{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Supabase&apos;s Privacy Policy
          </a>.
        </p>
      </section>

      <section>
        <h2>5. Managing Your Cookie Preferences</h2>

        <h3>5.1 Using Our Preference Center</h3>
        <p>
          You can manage your cookie preferences at any time by:
        </p>
        <ul>
          <li>
            Clicking the{' '}
            <button
              onClick={openPreferences}
              className="text-accent hover:underline focus:outline-none focus:underline"
            >
              Cookie Preferences
            </button>{' '}
            link (opens our preference center)
          </li>
          <li>Visiting the cookie banner that appears when you first visit</li>
          <li>Going to your account settings (if logged in)</li>
        </ul>

        <h3>5.2 Using Browser Settings</h3>
        <p>
          Most browsers allow you to control cookies through their settings. Common options include:
        </p>
        <ul>
          <li>
            <strong>Block all cookies:</strong> This may prevent parts of the Service from functioning
          </li>
          <li>
            <strong>Block third-party cookies:</strong> Blocks cookies from domains other than nihontowatch.com
          </li>
          <li>
            <strong>Delete cookies:</strong> Remove existing cookies from your browser
          </li>
        </ul>
        <p>
          Instructions for managing cookies in popular browsers:
        </p>
        <ul>
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
            >
              Safari
            </a>
          </li>
          <li>
            <a
              href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft Edge
            </a>
          </li>
        </ul>

        <h3>5.3 Impact of Disabling Cookies</h3>
        <p>
          If you choose to disable certain cookies:
        </p>
        <ul>
          <li>
            <strong>Essential cookies:</strong> Cannot be disabled; blocking them may prevent the
            Service from functioning
          </li>
          <li>
            <strong>Functional cookies:</strong> Your preferences (theme, currency) will not be
            remembered between visits
          </li>
          <li>
            <strong>Analytics cookies:</strong> We will have limited insight into how the Service is
            used, which may affect our ability to improve it
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Do Not Track</h2>
        <p>
          Some browsers offer a &quot;Do Not Track&quot; (DNT) setting. Currently, there is no industry
          standard for how websites should respond to DNT signals. We honor your cookie preferences
          as set through our preference center.
        </p>
      </section>

      <section>
        <h2>7. Changes to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. If we make material changes, we will:
        </p>
        <ul>
          <li>Update the &quot;Last updated&quot; date at the top of this page</li>
          <li>Display a new cookie banner to inform you of the changes</li>
          <li>Request your consent again if required</li>
        </ul>
      </section>

      <section>
        <h2>8. Contact Us</h2>
        <p>
          If you have questions about our use of cookies or this policy, please contact us:
        </p>
        <p>
          <strong>Nihontowatch - Privacy</strong>
          <br />
          Email: <a href="mailto:privacy@nihontowatch.com">privacy@nihontowatch.com</a>
        </p>
        <p>
          For more information about how we handle your personal data, please see our{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </>
  );
}
