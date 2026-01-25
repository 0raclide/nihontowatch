import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Nihontowatch',
  description: 'Privacy Policy for Nihontowatch - how we collect, use, and protect your personal data under GDPR.',
  alternates: {
    canonical: '/privacy',
  },
};

const lastUpdated = 'January 25, 2026';

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted text-sm">Last updated: {lastUpdated}</p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          Nihontowatch (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy
          Policy explains how we collect, use, disclose, and safeguard your personal data when you
          use our website and services (collectively, the &quot;Service&quot;).
        </p>
        <p>
          We process personal data in accordance with the EU General Data Protection Regulation (GDPR)
          and other applicable data protection laws.
        </p>

        <h3>1.1 Data Controller</h3>
        <p>
          Nihontowatch is the data controller responsible for your personal data.
        </p>
        <p>
          <strong>Contact:</strong>
          <br />
          Email: <a href="mailto:privacy@nihontowatch.com">privacy@nihontowatch.com</a>
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>

        <h3>2.1 Information You Provide</h3>
        <p>We collect information you directly provide to us:</p>
        <ul>
          <li>
            <strong>Account Registration:</strong> Email address, display name (optional)
          </li>
          <li>
            <strong>Profile Information:</strong> Avatar, preferences (currency, theme, notification settings)
          </li>
          <li>
            <strong>Saved Searches:</strong> Search criteria, filters, alert preferences
          </li>
          <li>
            <strong>Favorites:</strong> Listings you save to your favorites
          </li>
          <li>
            <strong>Payment Information:</strong> When you subscribe, payment details are processed
            securely by Stripe. We store only a reference ID, not your payment card details.
          </li>
          <li>
            <strong>Communications:</strong> When you contact us, we collect the content of your messages
          </li>
        </ul>

        <h3>2.2 Information Collected Automatically</h3>
        <p>
          When you use our Service, we automatically collect certain information with your consent:
        </p>
        <ul>
          <li>
            <strong>Device Information:</strong> Screen dimensions, device type, operating system,
            browser type, language preferences
          </li>
          <li>
            <strong>Usage Data:</strong> Pages visited, search queries, listings viewed, time spent
            on pages, clicks on external dealer links
          </li>
          <li>
            <strong>Session Data:</strong> Session identifiers, session duration, page view counts
          </li>
          <li>
            <strong>Visitor ID:</strong> A unique identifier stored in your browser (with your consent)
            to help us understand usage patterns
          </li>
          <li>
            <strong>IP Address:</strong> Your IP address may be logged in server access logs for security
            and fraud prevention
          </li>
        </ul>
        <p>
          <strong>Note:</strong> You can manage your data collection preferences through our{' '}
          <Link href="/cookies">Cookie Preferences</Link>.
        </p>

        <h3>2.3 Information from Third Parties</h3>
        <ul>
          <li>
            <strong>Payment Processor:</strong> Stripe provides us with transaction status and subscription
            information (not your card details)
          </li>
          <li>
            <strong>Authentication:</strong> Supabase provides authentication services and may share
            basic profile information
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis for Processing</h2>
        <p>Under GDPR, we process your personal data based on the following legal grounds:</p>

        <h3>3.1 Consent (Article 6(1)(a))</h3>
        <ul>
          <li>Analytics and usage tracking</li>
          <li>Marketing communications (if you opt in)</li>
          <li>Non-essential cookies and similar technologies</li>
        </ul>
        <p>
          You can withdraw consent at any time through your account settings or our cookie preferences.
        </p>

        <h3>3.2 Contract Performance (Article 6(1)(b))</h3>
        <ul>
          <li>Account creation and management</li>
          <li>Providing the Service features you request</li>
          <li>Processing subscriptions and payments</li>
          <li>Sending service-related notifications</li>
        </ul>

        <h3>3.3 Legitimate Interests (Article 6(1)(f))</h3>
        <ul>
          <li>Security and fraud prevention</li>
          <li>Service improvement and development</li>
          <li>Responding to legal requests</li>
          <li>Business analytics (aggregated, anonymized data)</li>
        </ul>

        <h3>3.4 Legal Obligation (Article 6(1)(c))</h3>
        <ul>
          <li>Tax and accounting records</li>
          <li>Compliance with legal requirements</li>
        </ul>
      </section>

      <section>
        <h2>4. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our Service</li>
          <li>Create and manage your account</li>
          <li>Process transactions and send related information</li>
          <li>Send notifications about saved searches, price drops, and alerts</li>
          <li>Personalize your experience (currency, theme, preferences)</li>
          <li>Analyze usage patterns to improve the Service</li>
          <li>Detect, prevent, and address fraud and security issues</li>
          <li>Respond to your inquiries and provide customer support</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2>5. Information Sharing</h2>
        <p>We do not sell your personal data. We share your information only in the following circumstances:</p>

        <h3>5.1 Third-Party Service Providers</h3>
        <p>We share data with service providers who assist in operating our Service:</p>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Provider</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Data Shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Database and authentication</td>
                <td>Email, profile, usage data</td>
              </tr>
              <tr>
                <td>Stripe</td>
                <td>Payment processing</td>
                <td>Email, subscription status</td>
              </tr>
              <tr>
                <td>SendGrid</td>
                <td>Email delivery</td>
                <td>Email address, notification content</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Hosting and infrastructure</td>
                <td>Server logs, IP addresses</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>AI-powered features</td>
                <td>Text content for translation/drafts</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted mt-2">
          All providers are bound by data processing agreements and are prohibited from using your
          data for their own purposes.
        </p>

        <h3>5.2 Legal Requirements</h3>
        <p>We may disclose your information if required by law or in response to valid legal requests.</p>

        <h3>5.3 Business Transfers</h3>
        <p>
          In connection with a merger, acquisition, or sale of assets, your data may be transferred.
          We will notify you of any such change.
        </p>
      </section>

      <section>
        <h2>6. International Data Transfers</h2>
        <p>
          Your data may be transferred to and processed in countries outside your country of residence,
          including the United States. We ensure appropriate safeguards are in place:
        </p>
        <ul>
          <li>
            <strong>Standard Contractual Clauses (SCCs):</strong> We use EU-approved SCCs for transfers
            to countries without an adequacy decision
          </li>
          <li>
            <strong>Data Processing Agreements:</strong> All processors are contractually bound to
            protect your data
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Data Retention</h2>
        <p>We retain your personal data for as long as necessary to fulfill the purposes described:</p>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Data Type</th>
                <th className="text-left">Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account data</td>
                <td>Duration of account + 30 days</td>
              </tr>
              <tr>
                <td>Activity logs (anonymous)</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td>Activity logs (authenticated)</td>
                <td>2 years</td>
              </tr>
              <tr>
                <td>Payment records</td>
                <td>7 years (legal requirement)</td>
              </tr>
              <tr>
                <td>Server access logs</td>
                <td>30 days</td>
              </tr>
              <tr>
                <td>Deleted account data</td>
                <td>30 days (grace period)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>8. Your Rights Under GDPR</h2>
        <p>
          If you are in the European Economic Area (EEA), United Kingdom, or a jurisdiction with similar
          data protection laws, you have the following rights:
        </p>

        <h3>8.1 Right to Access</h3>
        <p>
          You can request a copy of your personal data. Use the &quot;Export My Data&quot; feature in your
          account settings, or contact us at{' '}
          <a href="mailto:privacy@nihontowatch.com">privacy@nihontowatch.com</a>.
        </p>

        <h3>8.2 Right to Rectification</h3>
        <p>
          You can correct inaccurate personal data through your account settings or by contacting us.
        </p>

        <h3>8.3 Right to Erasure (&quot;Right to be Forgotten&quot;)</h3>
        <p>
          You can request deletion of your personal data. Use the &quot;Delete Account&quot; feature in your
          account settings. Some data may be retained as required by law.
        </p>

        <h3>8.4 Right to Restrict Processing</h3>
        <p>
          You can request that we limit how we use your data while we verify accuracy or address
          your concerns.
        </p>

        <h3>8.5 Right to Data Portability</h3>
        <p>
          You can receive your data in a structured, machine-readable format (JSON) and transfer
          it to another service.
        </p>

        <h3>8.6 Right to Object</h3>
        <p>
          You can object to processing based on legitimate interests. For analytics, use our cookie
          preferences. For marketing, use the unsubscribe link in any email.
        </p>

        <h3>8.7 Right to Withdraw Consent</h3>
        <p>
          You can withdraw consent at any time without affecting the lawfulness of prior processing.
          Manage consent through your account settings or our cookie banner.
        </p>

        <h3>8.8 Right to Lodge a Complaint</h3>
        <p>
          You have the right to file a complaint with a supervisory authority. Contact details for
          EU data protection authorities are available at:{' '}
          <a
            href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://edpb.europa.eu
          </a>
        </p>
      </section>

      <section>
        <h2>9. Cookie Policy Summary</h2>
        <p>
          We use cookies and similar technologies to provide and improve our Service. For detailed
          information, see our <Link href="/cookies">Cookie Policy</Link>.
        </p>
        <p>We use the following categories of cookies:</p>
        <ul>
          <li>
            <strong>Essential:</strong> Required for the Service to function (authentication, security)
          </li>
          <li>
            <strong>Functional:</strong> Remember your preferences (theme, currency)
          </li>
          <li>
            <strong>Analytics:</strong> Help us understand how the Service is used
          </li>
        </ul>
        <p>
          You can manage your cookie preferences at any time through the &quot;Cookie Preferences&quot; link
          in the footer of any page.
        </p>
      </section>

      <section>
        <h2>10. Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your personal data:
        </p>
        <ul>
          <li>Encryption of data in transit (TLS/HTTPS)</li>
          <li>Encryption of sensitive data at rest</li>
          <li>Regular security assessments</li>
          <li>Access controls and authentication</li>
          <li>Employee training on data protection</li>
        </ul>
        <p>
          While we take reasonable precautions, no security measure is perfect. If you believe your
          account has been compromised, please contact us immediately.
        </p>
      </section>

      <section>
        <h2>11. Children&apos;s Privacy</h2>
        <p>
          Our Service is not directed to individuals under 16 years of age. We do not knowingly
          collect personal data from children. If we become aware that a child has provided us with
          personal data, we will take steps to delete it.
        </p>
      </section>

      <section>
        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes
          by:
        </p>
        <ul>
          <li>Posting the updated policy on this page with a new &quot;Last updated&quot; date</li>
          <li>Sending an email notification (for material changes affecting your rights)</li>
        </ul>
        <p>
          We encourage you to review this page periodically to stay informed about our data practices.
        </p>
      </section>

      <section>
        <h2>13. Contact Us</h2>
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy or our data
          practices, please contact us:
        </p>
        <p>
          <strong>Nihontowatch - Privacy</strong>
          <br />
          Email: <a href="mailto:privacy@nihontowatch.com">privacy@nihontowatch.com</a>
        </p>
        <p>
          We aim to respond to all requests within 30 days. If you are not satisfied with our response,
          you have the right to lodge a complaint with your local data protection authority.
        </p>
      </section>
    </>
  );
}
