import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | NihontoWatch',
  description: 'Terms of Service for NihontoWatch - the Japanese sword and tosogu marketplace aggregator.',
  alternates: {
    canonical: '/terms',
  },
};

const lastUpdated = 'January 25, 2026';

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted text-sm">Last updated: {lastUpdated}</p>

      <section>
        <h2>1. Introduction and Acceptance</h2>
        <p>
          Welcome to Nihontowatch. These Terms of Service (&quot;Terms&quot;) govern your access to and use of
          the Nihontowatch website, services, and applications (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By accessing or using our Service, you agree to be bound by these Terms. If you do not agree
          to these Terms, you may not access or use the Service.
        </p>
        <p>
          We may update these Terms from time to time. If we make material changes, we will notify you
          by email or by posting a notice on the Service prior to the change becoming effective. Your
          continued use of the Service after changes become effective constitutes acceptance of the
          revised Terms.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          Nihontowatch is an aggregator platform that collects and displays listings for Japanese swords
          (nihonto), sword fittings (tosogu), and related items from dealers worldwide. Our Service
          includes:
        </p>
        <ul>
          <li>Browse and search functionality for aggregated dealer listings</li>
          <li>Price tracking and alerts</li>
          <li>Saved searches and favorites</li>
          <li>Currency conversion</li>
          <li>Email notifications</li>
          <li>Subscription services with premium features</li>
        </ul>
        <p>
          <strong>Important:</strong> Nihontowatch does not sell, buy, or broker the sale of any items.
          All transactions occur directly between you and the individual dealers. We are not a party to
          any transaction and bear no responsibility for the quality, safety, legality, or delivery of
          any items purchased from dealers listed on our platform.
        </p>
      </section>

      <section>
        <h2>3. User Accounts</h2>

        <h3>3.1 Account Registration</h3>
        <p>
          To access certain features of the Service, you must create an account. When you register:
        </p>
        <ul>
          <li>You must provide accurate and complete information</li>
          <li>You must be at least 16 years of age</li>
          <li>You are responsible for maintaining the security of your account credentials</li>
          <li>You must notify us immediately of any unauthorized access to your account</li>
        </ul>

        <h3>3.2 Account Security</h3>
        <p>
          You are solely responsible for all activities that occur under your account. We recommend
          using a strong, unique password and enabling any available security features.
        </p>

        <h3>3.3 Account Termination</h3>
        <p>
          You may delete your account at any time through your account settings or by contacting us.
          We may suspend or terminate your account if you violate these Terms or engage in conduct
          that we determine, in our sole discretion, is harmful to other users, dealers, or the Service.
        </p>
      </section>

      <section>
        <h2>4. Subscription Terms</h2>

        <h3>4.1 Subscription Plans</h3>
        <p>
          We offer various subscription tiers with different features and pricing. Subscription details,
          including current pricing and features, are available on our{' '}
          <Link href="/pricing">pricing page</Link>.
        </p>

        <h3>4.2 Billing</h3>
        <p>
          Subscriptions are billed in advance on a monthly or annual basis. Payment is processed through
          our third-party payment provider (Stripe). You authorize us to charge your payment method for
          the recurring subscription fee.
        </p>

        <h3>4.3 Cancellation</h3>
        <p>
          You may cancel your subscription at any time. Cancellation takes effect at the end of your
          current billing period. You will continue to have access to premium features until the end
          of your paid period.
        </p>

        <h3>4.4 Refunds</h3>
        <p>
          Subscription fees are generally non-refundable. However, we may provide refunds or credits
          at our sole discretion, particularly in cases of:
        </p>
        <ul>
          <li>Technical issues preventing access to paid features</li>
          <li>Duplicate charges</li>
          <li>Extenuating circumstances</li>
        </ul>
        <p>
          To request a refund, please contact us at{' '}
          <a href="mailto:support@nihontowatch.com">support@nihontowatch.com</a>.
        </p>
      </section>

      <section>
        <h2>5. Acceptable Use Policy</h2>
        <p>When using our Service, you agree not to:</p>
        <ul>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe upon the rights of others, including intellectual property rights</li>
          <li>
            Use automated systems (bots, scrapers, etc.) to access the Service without our written
            permission
          </li>
          <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
          <li>Transmit viruses, malware, or other harmful code</li>
          <li>Harass, threaten, or intimidate other users or dealers</li>
          <li>Post false, misleading, or defamatory content</li>
          <li>Use the Service for any fraudulent or illegal purpose</li>
          <li>Interfere with or disrupt the Service or servers</li>
          <li>Circumvent any rate limiting or access controls</li>
        </ul>
      </section>

      <section>
        <h2>6. Intellectual Property</h2>

        <h3>6.1 Nihontowatch Content</h3>
        <p>
          The Service, including its design, features, and content created by us, is protected by
          copyright, trademark, and other intellectual property laws. You may not copy, modify,
          distribute, or create derivative works from our content without our express written permission.
        </p>

        <h3>6.2 Dealer Listings</h3>
        <p>
          Listing content (descriptions, images, specifications) is provided by dealers and remains
          their intellectual property. We display this content under implied license for aggregation
          purposes. Any use of dealer content beyond personal, non-commercial viewing requires
          permission from the respective dealer.
        </p>

        <h3>6.3 User Content</h3>
        <p>
          If you submit content to the Service (such as feedback or saved search names), you grant us
          a non-exclusive, worldwide, royalty-free license to use, reproduce, and display that content
          in connection with the Service.
        </p>
      </section>

      <section>
        <h2>7. Third-Party Links and Services</h2>

        <h3>7.1 Dealer Websites</h3>
        <p>
          Our Service contains links to dealer websites. When you click on a listing, you will be
          directed to the dealer&apos;s website to complete any transaction. We are not responsible for
          the content, policies, or practices of any third-party website.
        </p>

        <h3>7.2 No Endorsement</h3>
        <p>
          The inclusion of any dealer or listing on our Service does not constitute an endorsement
          or recommendation. We do not verify the accuracy of listings, the authenticity of items,
          or the reliability of dealers. You are solely responsible for conducting your own due
          diligence before making any purchase.
        </p>

        <h3>7.3 Third-Party Services</h3>
        <p>
          Our Service integrates with third-party services (e.g., payment processing, email delivery).
          Your use of these services may be subject to their respective terms and privacy policies.
        </p>
      </section>

      <section>
        <h2>8. Disclaimer of Warranties</h2>
        <p>
          <strong>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED.
          </strong>
        </p>
        <p>We specifically disclaim all warranties regarding:</p>
        <ul>
          <li>
            <strong>Listing Accuracy:</strong> We do not guarantee that listing information (prices,
            availability, descriptions, images) is accurate, complete, or current. Dealers may update
            their inventory at any time.
          </li>
          <li>
            <strong>Item Authenticity:</strong> We make no representations about the authenticity,
            provenance, or quality of any items listed. Authentication and verification are solely
            your responsibility.
          </li>
          <li>
            <strong>Service Availability:</strong> We do not guarantee uninterrupted or error-free
            access to the Service.
          </li>
          <li>
            <strong>Third-Party Conduct:</strong> We are not responsible for the actions, products,
            or services of any dealers or third parties.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Limitation of Liability</h2>
        <p>
          <strong>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NIHONTOWATCH AND ITS OFFICERS, DIRECTORS,
            EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </strong>
        </p>
        <ul>
          <li>Loss of profits, revenue, or data</li>
          <li>Damages arising from purchases made through linked dealer websites</li>
          <li>Damages resulting from inaccurate listing information</li>
          <li>Damages from unauthorized access to your account</li>
          <li>Any other damages arising from your use of the Service</li>
        </ul>
        <p>
          <strong>
            OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL NOT
            EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR $100
            USD, WHICHEVER IS GREATER.
          </strong>
        </p>
      </section>

      <section>
        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless Nihontowatch and its officers, directors,
          employees, and agents from any claims, damages, losses, liabilities, and expenses (including
          reasonable attorneys&apos; fees) arising from:
        </p>
        <ul>
          <li>Your violation of these Terms</li>
          <li>Your use of the Service</li>
          <li>Your violation of any third-party rights</li>
          <li>Any content you submit to the Service</li>
        </ul>
      </section>

      <section>
        <h2>11. Governing Law and Jurisdiction</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of
          California, United States, without regard to its conflict of law provisions.
        </p>
        <p>
          Any disputes arising from these Terms or your use of the Service shall be resolved in the
          state or federal courts located in San Francisco County, California. You consent to the
          personal jurisdiction of such courts.
        </p>
        <p>
          If you are located in the European Union, you may also bring proceedings in the courts of
          your country of residence.
        </p>
      </section>

      <section>
        <h2>12. Dispute Resolution</h2>
        <p>
          We encourage you to contact us first to resolve any disputes. Most issues can be resolved
          informally by contacting{' '}
          <a href="mailto:support@nihontowatch.com">support@nihontowatch.com</a>.
        </p>
        <p>
          For any dispute that cannot be resolved informally, you agree that the dispute will be
          resolved through binding arbitration, except that either party may bring claims in small
          claims court if eligible.
        </p>
      </section>

      <section>
        <h2>13. General Provisions</h2>

        <h3>13.1 Entire Agreement</h3>
        <p>
          These Terms, together with our <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/cookies">Cookie Policy</Link>, constitute the entire agreement between you
          and Nihontowatch.
        </p>

        <h3>13.2 Severability</h3>
        <p>
          If any provision of these Terms is found to be unenforceable, the remaining provisions
          will continue in full force and effect.
        </p>

        <h3>13.3 Waiver</h3>
        <p>
          Our failure to enforce any right or provision of these Terms shall not constitute a waiver
          of such right or provision.
        </p>

        <h3>13.4 Assignment</h3>
        <p>
          You may not assign or transfer these Terms without our prior written consent. We may assign
          these Terms without restriction.
        </p>
      </section>

      <section>
        <h2>14. Contact Information</h2>
        <p>
          If you have any questions about these Terms, please contact us at:
        </p>
        <p>
          <strong>Nihontowatch</strong>
          <br />
          Email: <a href="mailto:legal@nihontowatch.com">legal@nihontowatch.com</a>
          <br />
          Website: <a href="https://nihontowatch.com">https://nihontowatch.com</a>
        </p>
      </section>
    </>
  );
}
