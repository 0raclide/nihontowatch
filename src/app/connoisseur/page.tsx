'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { TIER_PRICING } from '@/types/subscription';

export default function ConnoisseurPage() {
  const { checkout, isConnoisseur } = useSubscription();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);

  const pricing = TIER_PRICING.connoisseur;
  const monthlyPrice = Math.round(pricing.annual / 12);

  // Handle checkout after login
  React.useEffect(() => {
    if (user && pendingCheckout) {
      setPendingCheckout(false);
      setShowLoginModal(false);
      handleCheckout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingCheckout]);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      await checkout('connoisseur', 'annual');
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      setPendingCheckout(true);
      setShowLoginModal(true);
      return;
    }
    await handleCheckout();
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-linen/50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-ink">
            Nihontowatch
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            View All Plans
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16">
        {/* Personal Letter Style Content */}
        <article className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-serif prose-headings:text-ink
          prose-p:text-secondary prose-p:leading-relaxed
          prose-strong:text-ink prose-strong:font-medium
          prose-a:text-gold prose-a:no-underline hover:prose-a:underline
        ">
          <h1 className="text-3xl lg:text-4xl mb-8">A Note on Collecting at the Highest Level</h1>

          <p>
            If you&apos;ve spent any time in this market, you&apos;ve probably noticed something:
            the truly exceptional pieces rarely appear on public listings.
          </p>

          <p>
            This isn&apos;t an accident. It&apos;s how the market has always worked.
          </p>

          <p>
            The best dealers in Japan—the ones who handle Juyo, Tokubetsu Juyo, and museum-quality
            pieces—don&apos;t post their finest inventory online for the world to see. They offer
            these pieces privately, to collectors they know and trust. Collectors who understand
            what they&apos;re looking at. Collectors who won&apos;t waste their time.
          </p>

          <p>
            Building these relationships takes years. You need to demonstrate that you&apos;re serious.
            That you have the knowledge to appreciate what&apos;s being offered. That you have the
            means to act when something exceptional comes along. And most importantly, that you&apos;ll
            treat the transaction with the respect it deserves.
          </p>

          <hr className="my-10 border-border" />

          <h2 className="text-2xl">My Story</h2>

          <p>
            Years ago, I was fortunate to become a client of Darcy Brockbank. Over time, he took
            me under his wing—teaching me how to truly see a blade, how to navigate the Japanese
            market, how to build relationships with dealers who would otherwise never give a
            Western collector the time of day.
          </p>

          <p>
            Everything I know about collecting at this level, I learned from him.
          </p>

          <p>
            At a certain point in this hobby, collectors often become part-time dealers. It&apos;s
            almost inevitable—you develop the eye, you build the relationships, and opportunities
            start coming to you. But that&apos;s not the path I want to take.
          </p>

          <p>
            Personally, my collecting days are largely behind me. It may be years before I find
            something that truly interests me at this point. What I want now is to teach others
            how to fish—to share what I&apos;ve learned without being directly involved in dealing.
          </p>

          <p>
            I want to help serious students of nihonto ascend to the level where they can navigate
            this market themselves. Where dealers recognize them as knowledgeable collectors worth
            cultivating. Where the private offerings start coming to them directly.
          </p>

          <p>
            That&apos;s what Connoisseur membership is really about.
          </p>

          <hr className="my-10 border-border" />

          <h2 className="text-2xl">What This Membership Actually Is</h2>

          <p>
            Nihontowatch started as a way to aggregate public listings—to make it easier to find
            what&apos;s available across dozens of dealer sites. That&apos;s useful, and the Enthusiast
            tier does that well.
          </p>

          <p>
            But Connoisseur is something different.
          </p>

          <p>
            <strong>It&apos;s access to the private market.</strong> The pieces that never hit public
            listings. The offerings that go to established collectors first. The inventory that
            dealers reserve for their best clients.
          </p>

          <p>
            When you join as a Connoisseur, you&apos;re not just getting a subscription. You&apos;re
            getting introduced. I vouch for you. My relationships become your access.
          </p>

          <p>
            This means:
          </p>

          <ul className="space-y-2">
            <li>
              <strong>Private offerings</strong> from top Japanese dealers, shared before they go
              public (if they ever do)
            </li>
            <li>
              <strong>Direct introductions</strong> when you&apos;re ready to pursue a specific piece
              or build a relationship with a particular dealer
            </li>
            <li>
              <strong>Guidance on transactions</strong>—what to say, how to negotiate, what&apos;s
              reasonable to ask for
            </li>
            <li>
              <strong>Honest opinions</strong> on pieces you&apos;re considering, from someone who
              has no stake in the sale
            </li>
          </ul>

          <hr className="my-10 border-border" />

          <h2 className="text-2xl">The Community</h2>

          <p>
            Beyond the dealer access, there&apos;s the community itself—a small group of serious
            collectors who share knowledge, discuss pieces, and help each other navigate this market.
          </p>

          <p>
            These aren&apos;t casual enthusiasts. They&apos;re people who have built significant
            collections. People who can look at a blade and tell you something meaningful about it.
            People who understand why provenance matters, why certain smiths command premiums, and
            why patience is often the most valuable skill a collector can develop.
          </p>

          <p>
            When you&apos;re considering a major purchase, having access to this kind of perspective
            is invaluable. Not dealer perspective—collector perspective. From people who have made
            the same decisions you&apos;re facing.
          </p>

          <hr className="my-10 border-border" />

          <h2 className="text-2xl">Is This For You?</h2>

          <p>
            Honestly, for most collectors, the Enthusiast tier is more than enough. Real-time
            listings, saved searches, inquiry assistance—that covers 90% of what you need to
            collect effectively.
          </p>

          <p>
            Connoisseur is for collectors who:
          </p>

          <ul className="space-y-2">
            <li>Are actively building a collection at the Juyo level or above</li>
            <li>Have the budget to act when exceptional pieces appear</li>
            <li>Want access to inventory that never reaches public listings</li>
            <li>Value relationships and community over pure transactions</li>
          </ul>

          <p>
            If that sounds like you, I&apos;d be honored to have you join us.
          </p>

          <hr className="my-10 border-border" />

          <h2 className="text-2xl">The Details</h2>

          <p>
            Connoisseur membership is <strong>${monthlyPrice}/month</strong>, billed annually at
            ${pricing.annual}/year. This isn&apos;t a casual commitment, and it&apos;s not meant
            to be.
          </p>

          <p>
            What you get:
          </p>

          <ul className="space-y-2">
            <li>Everything in Enthusiast (real-time listings, translations, inquiry drafts, saved searches)</li>
            <li>Private dealer offerings shared directly with members</li>
            <li>Instant alerts when new pieces match your criteria</li>
            <li>Artist certification statistics (Juyo/Tokuju/Bunkazai counts by smith)</li>
            <li>Access to our private Discord community</li>
            <li>Direct LINE support for questions and guidance</li>
          </ul>

          <p>
            You can cancel anytime. But in my experience, collectors who join at this level tend
            to stay—because the value becomes obvious the first time a truly exceptional piece
            lands in your inbox before anyone else sees it.
          </p>
        </article>

        {/* CTA */}
        <div className="mt-16 pt-8 border-t border-border text-center">
          {isConnoisseur ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              You&apos;re a Connoisseur Member
            </div>
          ) : (
            <>
              <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="px-8 py-4 bg-gold hover:bg-gold-light text-white font-medium rounded-lg transition-colors text-lg disabled:opacity-50"
              >
                {isLoading ? 'Redirecting...' : 'Join as Connoisseur'}
              </button>
              <p className="text-sm text-muted mt-4">
                ${monthlyPrice}/month billed annually
              </p>
            </>
          )}
        </div>

        {/* Signature */}
        <div className="mt-16 text-center">
          <p className="text-muted text-sm">
            Questions? Reach out directly at{' '}
            <a href="mailto:support@nihontowatch.com" className="text-gold hover:underline">
              support@nihontowatch.com
            </a>
          </p>
        </div>
      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingCheckout(false);
        }}
      />
    </div>
  );
}
