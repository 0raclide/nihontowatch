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
    <div className="min-h-screen bg-cream dark:bg-[#1a1a18]">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-[680px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-ink tracking-tight">
            Nihontowatch
          </Link>
          <Link
            href="/pricing"
            className="text-[13px] text-muted hover:text-ink transition-colors"
          >
            View All Plans
          </Link>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-20">
        {/* Title */}
        <header className="mb-20 text-center">
          <p className="text-gold text-[11px] tracking-[0.2em] uppercase mb-5 font-medium">
            Connoisseur Membership
          </p>
          <h1 className="font-serif text-[2.5rem] leading-[1.15] text-ink tracking-tight">
            A Note on Collecting<br />at the Highest Level
          </h1>
        </header>

        {/* Content */}
        <article className="text-[#4a4a48] dark:text-[#a8a8a4] text-[18px] leading-[1.85] tracking-[-0.01em]">

          <p className="mb-7">
            If you&apos;ve spent any time in this market, you&apos;ve probably noticed something:
            the truly exceptional pieces rarely appear on public listings.
          </p>

          <p className="mb-7 text-ink font-medium">
            This isn&apos;t an accident. It&apos;s how the market has always worked.
          </p>

          <p className="mb-7">
            The best dealers in Japan—the ones who handle Juyo, Tokubetsu Juyo, and museum-quality
            pieces—don&apos;t post their finest inventory online for the world to see. They offer
            these pieces privately, to collectors they know and trust. Collectors who understand
            what they&apos;re looking at. Collectors who won&apos;t waste their time.
          </p>

          <p className="mb-7">
            Building these relationships takes years. You need to demonstrate that you&apos;re serious.
            That you have the knowledge to appreciate what&apos;s being offered. That you have the
            means to act when something exceptional comes along. And most importantly, that you&apos;ll
            treat the transaction with the respect it deserves.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">My Story</h2>

          <p className="mb-7">
            Years ago, I was fortunate to become a client of Darcy Brockbank. Over time, he took
            me under his wing—teaching me how to truly <em className="not-italic text-ink">see</em> a
            blade, how to navigate the Japanese market, how to build relationships with dealers who
            would otherwise never give a Western collector the time of day.
          </p>

          <p className="mb-7">
            If you want a sense of how I approach this field, you can read some of my{' '}
            <a
              href="https://nihontology.substack.com/p/grandmaster-mitsutada"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-light transition-colors"
            >
              scholarly work on nihonto
            </a>.
          </p>

          <p className="mb-7">
            At a certain point in this hobby, collectors often become part-time dealers. It&apos;s
            almost inevitable—you develop the eye, you build the relationships, and opportunities
            start coming to you. But that&apos;s not the path I want to take.
          </p>

          <p className="mb-7">
            Personally, my collecting days are largely behind me. It may be years before I find
            something that truly interests me at this point. What I want now is to teach others
            how to fish—to share what I&apos;ve learned without being directly involved in dealing.
          </p>

          <p className="mb-7">
            I want to help serious students of nihonto ascend to the level where they can navigate
            this market themselves. Where dealers recognize them as knowledgeable collectors worth
            cultivating. Where the private offerings start coming to them directly.
          </p>

          <p className="mb-7 text-ink font-medium">
            That&apos;s what Connoisseur membership is really about.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">
            What This Membership Actually Is
          </h2>

          <p className="mb-7">
            Nihontowatch started as a way to aggregate public listings—to make it easier to find
            what&apos;s available across dozens of dealer sites. That&apos;s useful, and the
            Enthusiast tier does that well.
          </p>

          <p className="mb-7">
            But Connoisseur is something different.
          </p>

          <p className="my-10 text-ink text-[1.25rem] font-medium leading-relaxed">
            It&apos;s access to the private market.
          </p>

          <p className="mb-7">
            The pieces that never hit public listings. The offerings that go to established
            collectors first. The inventory that dealers reserve for their best clients.
          </p>

          <p className="mb-7">
            When you join as a Connoisseur, you&apos;re not just getting a subscription.
            You&apos;re getting introduced. I vouch for you. My relationships become your access.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">
            How Private Offerings Work
          </h2>

          <p className="mb-7">
            When you join, you&apos;ll set up search alerts for what you&apos;re looking for—specific
            smiths, schools, certification levels, price ranges. But here&apos;s what&apos;s different
            from the public side of the platform:
          </p>

          <p className="my-10 text-ink text-[1.25rem] font-medium leading-relaxed">
            Selected Japanese dealers can see your search criteria.
          </p>

          <p className="mb-7">
            Let me give you an example. Say you collect the work of Kano Natsuo—one of the
            most celebrated metalworkers in Japanese history. You set your search alert to
            &ldquo;Natsuo.&rdquo; That signal goes out to our dealer network.
          </p>

          <p className="mb-7">
            Now, here&apos;s what makes this different from posting on a forum or sending
            emails to dealers: you&apos;re paying a significant membership fee. That fee
            is a credibility signal. It tells the dealer that your interest is serious,
            that you have the means to act, that you&apos;re not a tire-kicker who will
            waste their time.
          </p>

          <p className="mb-7">
            This is the key. Dealers receive countless inquiries from people who will never
            buy. They&apos;ve learned to ignore most of them. But when they see a Connoisseur
            member searching for Natsuo, they know this is someone worth contacting when
            they acquire a piece. Your membership has already demonstrated your seriousness.
          </p>

          <p className="mb-7">
            When a dealer has something that matches what you&apos;re looking for, they see more
            than just an anonymous alert. They see:
          </p>

          <ul className="mb-10 ml-1 space-y-4">
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Your name</span> and a presentation card you write yourself
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Your collecting interests</span>—what you&apos;re building, what speaks to you
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Your transaction history</span> through the platform
            </li>
          </ul>

          <p className="mb-7">
            This is how trust gets built. A dealer considering whether to offer you something
            privately can see that you&apos;re a serious collector who follows through, communicates
            professionally, and treats transactions with respect.
          </p>

          <p className="mb-7">
            This works both ways. Just as you&apos;re evaluating pieces, dealers are evaluating you.
            Your reputation in this community matters. A strong track record opens doors. A poor
            one closes them—not just with one dealer, but potentially with all of them.
          </p>

          <p className="mb-7">
            A note on Japanese customs: if you ever decide to sell a piece, the expectation is
            that you first offer it back to the dealer who sold it to you. This is how
            relationships work in this market. It&apos;s part of the mutual respect that makes
            the system function.
          </p>

          <p className="mb-7">
            I should also set expectations about what you&apos;ll receive. Most Japanese dealers
            are not skilled photographers. Do not expect polished, studio-quality images. What
            you <span className="text-ink font-medium">will</span> receive is what matters: the
            expertly translated setsumei, comprehensive statistics on the maker, and advanced
            intelligence on the artist&apos;s corpus—how many certified works exist, what has
            sold recently, where this piece fits in the broader context.
          </p>

          <p className="mb-7">
            Armed with this information, it is for you to make the decision. Do not expect
            Western-style customer service. There will be no hand-holding, no salesmanship,
            no follow-up calls asking if you&apos;re ready to buy. A piece is offered. You
            evaluate it with the information provided. You decide.
          </p>

          <p className="mb-7">
            This is a privilege extended to you, not a service owed to you.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">The Community</h2>

          <p className="mb-7">
            Beyond the dealer access, there&apos;s the community itself—a small group of serious
            collectors who share knowledge, discuss pieces, and help each other navigate this market.
          </p>

          <p className="mb-7">
            These aren&apos;t casual enthusiasts. They&apos;re people who have built significant
            collections. People who can look at a blade and tell you something meaningful about it.
            People who understand why provenance matters, why certain smiths command premiums, and
            why patience is often the most valuable skill a collector can develop.
          </p>

          <p className="mb-7">
            When you&apos;re considering a major purchase, having access to this kind of perspective
            is invaluable. Not dealer perspective—<em className="not-italic text-ink">collector</em> perspective.
            From people who have made the same decisions you&apos;re facing.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">A Word on Trust</h2>

          <p className="mb-7">
            I need to be direct about something:
          </p>

          <p className="my-10 text-ink text-[1.25rem] font-medium leading-relaxed">
            Membership in this tier can be revoked.
          </p>

          <p className="mb-7">
            This isn&apos;t about the money. The subscription fee is simply an honest signal—it
            shows you&apos;re serious, that you care enough to commit. Nothing more.
          </p>

          <p className="mb-7">
            What matters is trust. The items shared with you are{' '}
            <span className="text-ink font-medium">for your eyes only</span>. This is a closed circle.
          </p>

          <p className="mb-7">
            Private offerings cannot be shared under any circumstance. Not with friends. Not on
            forums. Not anywhere. All listing data is watermarked—if a leak happens, we will
            know where it came from. The result is an immediate and permanent ban.
          </p>

          <p className="mb-7">
            Private offerings also expire. After a set period, the listing details are no longer
            accessible to you. You are not permitted to save, screenshot, or retain the information.
            This protects the dealers who trust us with their inventory, and it protects the
            integrity of this community.
          </p>

          <p className="mb-7">
            I am staking my reputation—relationships I&apos;ve built over many years—to help you
            access this market. If that trust is violated, the membership ends. No refunds, no
            second chances.
          </p>

          <p className="mb-7">
            I say this not to be harsh, but to be clear about what you&apos;re joining. This works
            because everyone in it understands the rules. The dealers trust me. I need to be able
            to trust you.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">Why a Subscription</h2>

          <p className="mb-7">
            I don&apos;t take commissions on transactions. Not from you, not from dealers, not
            from anyone.
          </p>

          <p className="mb-7">
            Commissions create bad incentives. If I earned a percentage on every sale, my
            advice would be biased—consciously or not—toward closing deals rather than
            protecting your interests. I&apos;d have reason to encourage purchases I shouldn&apos;t,
            to downplay concerns I should raise, to push you toward decisions that benefit
            me rather than you.
          </p>

          <p className="mb-7">
            The subscription model keeps it honest. You pay a flat fee. My only incentive is
            to provide enough value that you stay. That means giving you my genuine opinion,
            even when it&apos;s not what you want to hear.
          </p>

          <p className="mb-7">
            Frankly, I do this because I enjoy it. I&apos;ve spent my collecting years acquiring
            pieces. Now I find myself <span className="text-ink font-medium">collecting collectors</span>—finding
            serious students of the craft, helping them develop their eye, watching them build
            collections I can be proud to have influenced.
          </p>

          <p className="mb-7">
            But this also means the relationship matters to me. If we don&apos;t get along—if
            the fit isn&apos;t right, if the communication doesn&apos;t work, if for any reason
            I feel the relationship isn&apos;t productive—I&apos;ll revoke your membership at
            my discretion. This isn&apos;t a service you&apos;re entitled to. It&apos;s a
            community you&apos;re invited into.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">Is This For You?</h2>

          <p className="mb-7">
            If you&apos;re contemplating collecting Juyo-grade items, yes. Otherwise, no.
          </p>

          <p className="mb-7">
            For most collectors, the Enthusiast tier is more than enough. Real-time listings,
            saved searches, inquiry assistance—that covers the essentials.
          </p>

          <p className="mb-7">
            But if you&apos;re considering spending tens of thousands of dollars on a Juyo
            sword or important tosogu, it would be short-sighted to do so without being
            part of this tier.
          </p>

          <p className="mb-7">
            Mistakes at this level are incredibly expensive. Overpaying by 20% on a $50,000
            piece costs you $10,000. Buying something with condition issues you didn&apos;t
            notice costs you even more. Purchasing from a dealer who won&apos;t stand behind
            the sale costs you everything.
          </p>

          <p className="mb-7">
            There&apos;s a phenomenon in this market called the <span className="text-ink font-medium">beginner&apos;s
            tax</span>. It happens when collectors with significant budgets enter a field they
            don&apos;t yet understand. They have the means to acquire serious pieces, but not
            the knowledge to evaluate them properly. The result is predictable: they overpay,
            they buy pieces with hidden problems, they trust the wrong dealers.
          </p>

          <p className="mb-7">
            I&apos;ve watched this pattern repeat countless times. A successful professional
            decides to build a collection. They have $100,000 or $200,000 to spend. Within
            a year, they&apos;ve made $30,000 or $40,000 in mistakes—pieces they overpaid for,
            pieces they can&apos;t resell, pieces that turned out to be less than represented.
          </p>

          <p className="mb-7">
            This doesn&apos;t have to be your story. The beginner&apos;s tax is not a fatality.
            It&apos;s what happens when you enter a specialized market alone, without guidance,
            without access to honest opinions, without someone who has no financial stake in
            your decisions.
          </p>

          <p className="mb-7 text-ink font-medium">
            Avoiding that tax entirely is what this membership does.
          </p>

          <p className="mb-7">
            Beyond protection, there&apos;s elevation. Members receive guidance on upgrading
            items—submitting Tokubetsu Hozon pieces for Juyo shinsa, or Juyo for Tokubetsu
            Juyo. We facilitate professional services in Japan: commissioning sayagaki from
            respected scholars, arranging proper restoration work, conducting thorough due
            diligence on significant pieces before purchase.
          </p>

          <p className="mb-7">
            This is how serious collections are built—not just by acquiring pieces, but by
            understanding how to enhance and validate what you own.
          </p>

          <p className="mb-7">
            If that&apos;s where you&apos;re headed, I&apos;d be honored to have you join us.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">The Details</h2>

          <p className="mb-7">
            Connoisseur membership is <span className="text-ink font-medium">${monthlyPrice}/month</span>,
            billed annually at ${pricing.annual}/year. This isn&apos;t a casual commitment, and
            it&apos;s not meant to be.
          </p>

          <div className="my-12 py-8 px-8 bg-[#f8f7f5] dark:bg-[#222220] rounded-sm border-l-2 border-gold/40">
            <p className="text-ink font-medium mb-5 text-[15px] tracking-wide uppercase">What you get</p>
            <ul className="space-y-3 text-[16px]">
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Everything in Enthusiast (real-time listings, translations, inquiry drafts, saved searches)
              </li>
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Private dealer offerings shared directly with members
              </li>
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Instant alerts when new pieces match your criteria
              </li>
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Artist certification statistics (Juyo/Tokuju/Bunkazai counts by smith)
              </li>
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Access to our private collector community
              </li>
              <li className="pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-gold before:font-medium">
                Direct LINE support for questions and guidance
              </li>
            </ul>
          </div>

          <p className="mb-7">
            You can cancel anytime. But in my experience, collectors who join at this level tend
            to stay—because the value becomes obvious the first time a truly exceptional piece
            lands in your inbox before anyone else sees it.
          </p>

        </article>

        {/* CTA */}
        <div className="mt-24 pt-12 border-t border-border/50 text-center">
          {isConnoisseur ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded font-medium text-[15px]">
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
                className="px-12 py-4 bg-gold hover:bg-gold-light text-white font-medium rounded transition-colors text-[17px] disabled:opacity-50"
              >
                {isLoading ? 'Redirecting...' : 'Join as Connoisseur'}
              </button>
              <p className="text-[13px] text-muted mt-5">
                ${monthlyPrice}/month billed annually · Cancel anytime
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-24 text-center">
          <p className="text-muted text-[13px]">
            Questions?{' '}
            <a href="mailto:support@nihontowatch.com" className="text-gold hover:text-gold-light transition-colors">
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
