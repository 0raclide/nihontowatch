'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { TIER_PRICING } from '@/types/subscription';

// Decorative divider component
function Divider() {
  return (
    <div className="my-12 flex items-center justify-center gap-4">
      <div className="h-px w-12 bg-border" />
      <div className="text-gold/40 text-lg">&#9674;</div>
      <div className="h-px w-12 bg-border" />
    </div>
  );
}

export default function ConnoisseurPage() {
  const { checkout, isConnoisseur } = useSubscription();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);

  const pricing = TIER_PRICING.connoisseur;
  const monthlyPrice = Math.round(pricing.annual / 12);

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
      <header className="border-b border-border bg-linen/50 dark:bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24">
        {/* Title */}
        <header className="mb-16 text-center">
          <p className="text-gold/80 text-sm tracking-widest uppercase mb-4">Connoisseur Membership</p>
          <h1 className="font-serif text-3xl lg:text-4xl text-ink leading-tight">
            A Note on Collecting<br />at the Highest Level
          </h1>
        </header>

        {/* Content */}
        <article className="space-y-6 text-secondary text-[17px] leading-[1.8]">

          <p>
            If you&apos;ve spent any time in this market, you&apos;ve probably noticed something:
            the truly exceptional pieces rarely appear on public listings.
          </p>

          <p className="text-ink font-medium">
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

          <Divider />

          {/* My Story */}
          <h2 className="font-serif text-2xl text-ink pt-4">My Story</h2>

          <p>
            Years ago, I was fortunate to become a client of Darcy Brockbank. Over time, he took
            me under his wing—teaching me how to truly <em>see</em> a blade, how to navigate the
            Japanese market, how to build relationships with dealers who would otherwise never
            give a Western collector the time of day.
          </p>

          <blockquote className="border-l-2 border-gold/40 pl-6 my-8 italic text-ink/80">
            Everything I know about collecting at this level, I learned from him.
          </blockquote>

          <p>
            If you want a sense of how I approach this field, you can read some of my{' '}
            <a
              href="https://nihontology.substack.com/p/grandmaster-mitsutada"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              scholarly work on nihonto
            </a>.
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

          <p className="text-ink font-medium">
            That&apos;s what Connoisseur membership is really about.
          </p>

          <Divider />

          {/* What This Is */}
          <h2 className="font-serif text-2xl text-ink pt-4">What This Membership Actually Is</h2>

          <p>
            Nihontowatch started as a way to aggregate public listings—to make it easier to find
            what&apos;s available across dozens of dealer sites. That&apos;s useful, and the
            Enthusiast tier does that well.
          </p>

          <p>
            But Connoisseur is something different.
          </p>

          <p className="text-ink text-lg font-medium my-8">
            It&apos;s access to the private market.
          </p>

          <p>
            The pieces that never hit public listings. The offerings that go to established
            collectors first. The inventory that dealers reserve for their best clients.
          </p>

          <p>
            When you join as a Connoisseur, you&apos;re not just getting a subscription.
            You&apos;re getting introduced. I vouch for you. My relationships become your access.
          </p>

          <Divider />

          {/* How It Works */}
          <h2 className="font-serif text-2xl text-ink pt-4">How Private Offerings Work</h2>

          <p>
            When you join, you&apos;ll set up search alerts for what you&apos;re looking for—specific
            smiths, schools, certification levels, price ranges. But here&apos;s what&apos;s different
            from the public side of the platform:
          </p>

          <p className="text-ink text-lg font-medium my-8">
            Japanese dealers can see your search criteria.
          </p>

          <p>
            When a dealer has something that matches what you&apos;re looking for, they see more
            than just an anonymous alert. They see:
          </p>

          <ul className="my-8 space-y-3 pl-1">
            <li className="flex gap-3">
              <span className="text-gold mt-1.5">&#8226;</span>
              <span><strong className="text-ink">Your name</strong> and a presentation card you write yourself</span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold mt-1.5">&#8226;</span>
              <span><strong className="text-ink">Your collecting interests</strong>—what you&apos;re building, what speaks to you</span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold mt-1.5">&#8226;</span>
              <span><strong className="text-ink">Your transaction history</strong> through the platform</span>
            </li>
          </ul>

          <p>
            This is how trust gets built. A dealer considering whether to offer you something
            privately can see that you&apos;re a serious collector who follows through, communicates
            professionally, and treats transactions with respect.
          </p>

          <p>
            This works both ways. Just as you&apos;re evaluating pieces, dealers are evaluating you.
            Your reputation in this community matters. A strong track record opens doors. A poor
            one closes them—not just with one dealer, but potentially with all of them.
          </p>

          <Divider />

          {/* Community */}
          <h2 className="font-serif text-2xl text-ink pt-4">The Community</h2>

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
            is invaluable. Not dealer perspective—<em>collector</em> perspective. From people who
            have made the same decisions you&apos;re facing.
          </p>

          <Divider />

          {/* Trust */}
          <h2 className="font-serif text-2xl text-ink pt-4">A Word on Trust</h2>

          <p>
            I need to be direct about something:
          </p>

          <p className="text-ink text-lg font-medium my-8">
            Membership in this tier can be revoked.
          </p>

          <p>
            This isn&apos;t about the money. The subscription fee is simply an honest signal—it
            shows you&apos;re serious, that you care enough to commit. Nothing more.
          </p>

          <p>
            What matters is trust. The items shared with you are <strong className="text-ink">for
            your eyes only</strong>. This is a closed circle.
          </p>

          <p>
            Private offerings cannot be shared under any circumstance. Not with friends. Not on
            forums. Not anywhere. All listing data is watermarked—if a leak happens, we will
            know where it came from. The result is an immediate and permanent ban.
          </p>

          <p>
            Private offerings also expire. After a set period, the listing details are no longer
            accessible to you. You are not permitted to save, screenshot, or retain the information.
            This protects the dealers who trust us with their inventory, and it protects the
            integrity of this community.
          </p>

          <p>
            I am staking my reputation—relationships I&apos;ve built over many years—to help you
            access this market. If that trust is violated, the membership ends. No refunds, no
            second chances.
          </p>

          <p>
            I say this not to be harsh, but to be clear about what you&apos;re joining. This works
            because everyone in it understands the rules. The dealers trust me. I need to be able
            to trust you.
          </p>

          <Divider />

          {/* Is This For You */}
          <h2 className="font-serif text-2xl text-ink pt-4">Is This For You?</h2>

          <p>
            If you&apos;re contemplating collecting at the Juyo level, yes. Otherwise, no.
          </p>

          <p>
            For most collectors, the Enthusiast tier is more than enough. Real-time listings,
            saved searches, inquiry assistance—that covers what you need to collect Hozon and
            Tokubetsu Hozon pieces effectively.
          </p>

          <p>
            But if you&apos;re considering spending tens of thousands of dollars on a Juyo sword,
            it would be short-sighted to do so without being part of this tier.
          </p>

          <p>
            Mistakes at this level are incredibly expensive. Overpaying by 20% on a $50,000
            blade costs you $10,000. Buying a piece with condition issues you didn&apos;t
            notice costs you even more. Purchasing from a dealer who won&apos;t stand behind
            the sale costs you everything.
          </p>

          <p className="text-ink font-medium">
            Saving you from those mistakes is what this membership does.
          </p>

          <p>
            If that&apos;s where you&apos;re headed, I&apos;d be honored to have you join us.
          </p>

          <Divider />

          {/* Details */}
          <h2 className="font-serif text-2xl text-ink pt-4">The Details</h2>

          <p>
            Connoisseur membership is <strong className="text-ink">${monthlyPrice}/month</strong>,
            billed annually at ${pricing.annual}/year. This isn&apos;t a casual commitment, and
            it&apos;s not meant to be.
          </p>

          <div className="my-10 p-6 bg-surface border border-border rounded-lg">
            <p className="text-ink font-medium mb-4">What you get:</p>
            <ul className="space-y-2 text-[15px]">
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Everything in Enthusiast (real-time listings, translations, inquiry drafts, saved searches)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Private dealer offerings shared directly with members</span>
              </li>
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Instant alerts when new pieces match your criteria</span>
              </li>
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Artist certification statistics (Juyo/Tokuju/Bunkazai counts by smith)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Access to our private collector community</span>
              </li>
              <li className="flex gap-3">
                <span className="text-gold">&#10003;</span>
                <span>Direct LINE support for questions and guidance</span>
              </li>
            </ul>
          </div>

          <p>
            You can cancel anytime. But in my experience, collectors who join at this level tend
            to stay—because the value becomes obvious the first time a truly exceptional piece
            lands in your inbox before anyone else sees it.
          </p>

        </article>

        {/* CTA */}
        <div className="mt-20 pt-10 border-t border-border text-center">
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
                className="px-10 py-4 bg-gold hover:bg-gold-light text-white font-medium rounded-lg transition-colors text-lg disabled:opacity-50"
              >
                {isLoading ? 'Redirecting...' : 'Join as Connoisseur'}
              </button>
              <p className="text-sm text-muted mt-4">
                ${monthlyPrice}/month billed annually &middot; Cancel anytime
              </p>
            </>
          )}
        </div>

        {/* Signature */}
        <div className="mt-20 text-center">
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
