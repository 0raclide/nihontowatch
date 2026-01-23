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
    <div className="min-h-screen bg-gradient-to-b from-[#f5f3f0] via-[#f8f7f5] to-[#faf9f7] dark:from-[#0d1929] dark:via-[#141c28] dark:to-[#1a1a18]">
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
            The best dealers in Japan—the ones who handle the finest and most precious pieces,
            the pinnacle of high art in this field—don&apos;t post their best inventory online
            for the world to see. They offer these pieces privately, to collectors they know and
            trust. Collectors who understand what they&apos;re looking at. Collectors who won&apos;t
            waste their time.
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
            Nihontowatch aggregates public listings from dozens of dealers, and there are genuine
            opportunities to be found there. Rare gems do appear online. Truly exceptional pieces
            sometimes surface in public inventory—and with the Enthusiast tier, you&apos;ll see
            them the moment they&apos;re listed.
          </p>

          <p className="mb-7">
            But Connoisseur unlocks a different level of access entirely.
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
            emails to dealers: you&apos;re paying a significant membership fee. <span className="text-ink font-medium">That fee
            is a credibility signal. It tells the dealer that your interest is serious,
            that you have the means to act, that you&apos;re not a tire-kicker who will
            waste their time.</span>
          </p>

          <p className="mb-7">
            This is the key. Dealers receive countless inquiries from people who will never
            buy. They&apos;ve learned to ignore most of them. But when they see a Connoisseur
            member searching for Natsuo, they know this is someone worth contacting when
            they acquire a piece. Your membership has already demonstrated your seriousness.
          </p>

          <p className="mb-7">
            When a dealer has something that matches what you&apos;re looking for, they see more
            than just an anonymous alert. They see your <span className="text-ink font-medium">collector profile</span>—a
            complete picture of who you are in this field.
          </p>

          <p className="mb-7">
            The platform generates a <span className="text-ink font-medium">Japanese business card</span> for
            you—a proper <em className="not-italic">meishi</em>—that dealers can print out and keep on file.
            This is how business works in Japan. When a dealer acquires something that might interest you,
            they can pull your card and remember exactly who you are and what you collect.
          </p>

          <p className="mb-7">
            Your profile includes a <span className="text-ink font-medium">homepage</span> where you can
            post photographs of items in your collection. This is how you build credibility. When a dealer
            sees that you already own serious pieces—Juyo swords, important tosogu—they know they&apos;re
            dealing with a collector at their level.
          </p>

          <p className="mb-7">
            The profile also displays your affiliations and credentials:
          </p>

          <ul className="mb-10 ml-1 space-y-4">
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">NBTHK membership</span>—if you&apos;re a member, it shows
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Professional club rankings</span>—your standing in worldwide
              organizations dedicated to the study of nihonto
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Shinsa record</span>—if you&apos;ve ever passed an item
              to Juyo or Tokubetsu Juyo, and your name is on the papers, this appears on your profile.
              (If your name isn&apos;t on the papers but you were the submitting owner, contact me.)
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Your collecting interests</span>—what you&apos;re building, what speaks to you
            </li>
            <li className="pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:bg-gold/60 before:rounded-full">
              <span className="text-ink font-medium">Your transaction history</span> through the platform
            </li>
          </ul>

          <p className="mb-7">
            Dealers see all of this through a Japanese-language app designed to make their lives
            easy. They can browse collector profiles, read about your background, view your
            collection, and decide whether you&apos;re someone worth contacting when they acquire
            something special.
          </p>

          <p className="mb-7">
            A word on search criteria: precision matters. Dealers are looking for collectors with
            <span className="text-ink font-medium"> serious, well-defined interests</span>. Not
            too vague—&ldquo;Do you have anything good?&rdquo; is not a credible ask. But also not
            so specific that you never attract any offers.
          </p>

          <p className="mb-7">
            The sweet spot is focused but realistic. &ldquo;Bizen Osafune from the height of the
            Kamakura period&rdquo; tells a dealer exactly what you want. &ldquo;Anything from
            Bizen&rdquo; tells them nothing. &ldquo;Only signed pieces by Masamune&rdquo; is not
            going to yield any offers—there are none that will ever be sold.
          </p>

          <p className="mb-7">
            The same applies to tosogu. Not too wide, not too specific.
          </p>

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
            I should also set expectations about what you&apos;ll receive. Most Japanese dealers
            are not skilled photographers. Do not expect polished, studio-quality images. The
            platform will help you make an informed choice: the expertly translated setsumei,
            comprehensive statistics on the maker, and advanced intelligence on the artist&apos;s
            corpus—how many certified works exist, what has sold recently, where this piece fits
            in the broader context.
          </p>

          <p className="mb-7">
            Private offers are presented for <span className="text-ink font-medium">seven days</span>,
            after which they are retracted automatically. Note also that offers operate on a first
            come, first served basis—a piece may be presented to multiple collectors simultaneously.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">Etiquette</h2>

          <p className="mb-7">
            When you receive a private offer, understand that <span className="text-ink font-medium">you
            are a price taker</span>. The dealer has set a price. That is the price.
          </p>

          <p className="mb-7">
            Do not haggle. On a private offering extended specifically to you, attempting to
            negotiate is considered extremely poor form. It signals that you don&apos;t understand
            how this market works—or worse, that you don&apos;t respect the relationship. The
            dealer has already given you access to something special. Trying to squeeze them
            on price could jeopardize your chances of receiving offers in the future.
          </p>

          <p className="mb-7">
            You will typically receive the <span className="text-ink font-medium">10% foreign export
            discount</span>—this accounts for the Japanese consumption tax that doesn&apos;t apply
            to exports. However, this discount comes with conditions. Dealers may require specific
            shipping arrangements, accurate value declarations on customs forms, or other terms
            that allow them to properly document the tax-exempt export. If you cannot meet these
            conditions—for instance, if you insist on a lower declared value for customs—you may
            not be eligible for the discount. This is extended on the dealer&apos;s terms, not
            negotiated. Accept it graciously. Don&apos;t ask for more.
          </p>

          <p className="mb-7">
            Buy only what you intend to keep. In the world of fine art, flipping a piece shortly
            after purchase is considered poor form—it diminishes the object&apos;s standing and
            creates discomfort for everyone involved. When a dealer offers you something privately,
            the expectation is that you&apos;re acquiring it for your collection, not for resale.
          </p>

          <p className="mb-7">
            If circumstances change and you do decide to sell, the expectation is that you first
            offer it back to the dealer who sold it to you. This is how relationships work in
            this market. It&apos;s part of the mutual respect that makes the system function.
          </p>

          <p className="mb-7">
            Do not expect Western-style customer service. There will be no hand-holding, no
            salesmanship, no follow-up calls asking if you&apos;re ready to buy. A piece is
            offered. You evaluate it with the information provided. You decide.
          </p>

          <p className="mb-7">
            Armed with the intelligence the platform provides, it is for you to make the decision.
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
            forums. Not even with me. All private listing data is encrypted. When a dealer sends
            you an offer, that offer is for your eyes only—I cannot see it, and I will not comment
            on it. It is your responsibility to conduct your own due diligence.
          </p>

          <p className="mb-7">
            This is by design. Private means private. I cannot maintain trust with top-tier dealers
            if I&apos;m in a position to critique their inventory. The platform provides you with
            intelligence and access; the decisions are yours alone.
          </p>

          <p className="mb-7">
            All listing data is watermarked. If a leak happens, we will know where it came from.
            The result is an immediate and permanent ban.
          </p>

          <p className="mb-7">
            Private offerings also expire. After a set period, the listing details are no longer
            accessible to you. You are not permitted to save, screenshot, or retain the information.
            This protects the dealers who trust us with their inventory, and it protects the
            integrity of this community.
          </p>

          <p className="mb-7">
            When you join, it&apos;s not just my reputation at stake—it&apos;s the entire
            community&apos;s. Every member benefits from the trust we&apos;ve collectively built
            with these dealers. A single violation damages that trust for everyone. If that happens,
            the membership ends. No refunds, no second chances.
          </p>

          <p className="mb-7">
            I say this not to be harsh, but to be clear about what you&apos;re joining. This works
            because everyone in it understands the rules. Violations don&apos;t just affect one
            person—they harm the entire community and the access we&apos;ve collectively built.
          </p>

          {/* Divider */}
          <div className="my-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">Why a Subscription</h2>

          <p className="mb-7">
            I don&apos;t take commissions on transactions. Not from you, not from dealers, not
            from anyone.
          </p>

          <p className="mb-7">
            This matters more than you might think. In the art advisory world, the standard model
            is to charge 5-15% of each purchase price. Some advisors charge the buyer a fee{' '}
            <em className="not-italic text-ink">and</em> take kickbacks from sellers. The conflicts
            of interest are obvious, yet this is how most of the industry operates.
          </p>

          <p className="mb-7">
            Commissions create bad incentives. If I earned a percentage on every sale, my
            advice would be biased—consciously or not—toward closing deals rather than
            protecting your interests. I&apos;d have reason to encourage purchases I shouldn&apos;t,
            to downplay concerns I should raise, to push you toward decisions that benefit
            me rather than you.
          </p>

          <p className="mb-7">
            The flat subscription model is the most ethical structure in advisory. You pay a fixed
            fee. My only incentive is to provide enough value that you stay—which means giving you
            my genuine opinion, even when it&apos;s &ldquo;don&apos;t buy this.&rdquo;
          </p>

          <p className="mb-7">
            Frankly, I do this because I enjoy it. I&apos;ve spent my collecting years acquiring
            pieces. Now I take more joy in building a community and guiding others through this
            esoteric but rewarding field.
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

          <p className="mb-7 text-ink font-medium">
            What if you already have dealer relationships?
          </p>

          <p className="mb-7">
            Even better. This membership isn&apos;t just for collectors starting out at the
            high end—it&apos;s equally valuable for those who are already there.
          </p>

          <p className="mb-7">
            Cultivating relationships at the highest levels is time-consuming. It takes years of
            consistent engagement, travel to Japan, careful communication across language and
            cultural barriers. We must all inevitably make choices about where to invest that
            time—no one can pursue every relationship. This platform is designed to accelerate
            that process, allowing you to build relationships faster and more effectively. The
            cultural friction, while not removed entirely, is significantly reduced. Your
            credentials are already established. Your seriousness is already demonstrated.
          </p>

          <p className="mb-7">
            The platform intelligence is another dimension entirely. Even experienced collectors
            rarely have comprehensive data on an artist&apos;s corpus—how many works exist at each
            certification level, what has traded recently, how a particular piece compares to
            others by the same hand. This is the kind of information that informs
            whether a price is fair, whether a piece is exceptional or merely good.
          </p>

          <p className="mb-7">
            And then there&apos;s the community. At this level, your peers are scattered around
            the world. Having a space to discuss pieces, share knowledge, and get second opinions
            from collectors who understand what you&apos;re looking at—that has value regardless
            of how long you&apos;ve been collecting.
          </p>

          <p className="mb-7">
            Mistakes at this level are incredibly expensive. Buying a Juyo blade can become
            a costly error if it&apos;s &ldquo;Juyo in name only&rdquo;—a piece that represents
            the bottom lot of one of the weaker sessions. You can easily lose tens of thousands
            of dollars on a wrong purchase. This is why you want maximum information.
          </p>

          <p className="mb-7">
            There&apos;s a phenomenon in this market called the <span className="text-ink font-medium">beginner&apos;s
            tax</span>. It happens when collectors with significant budgets enter a field they
            don&apos;t yet understand. They have the means to acquire serious pieces, but not
            the knowledge to evaluate them properly. The result is predictable: they overpay,
            they buy pieces with hidden problems, they trust the wrong dealers. These mistakes
            are then repaired at great cost—if they can be repaired at all. I&apos;ve seen this
            happen over and over. This service exists to make sure it doesn&apos;t happen to you.
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

          <h2 className="font-serif text-[1.75rem] text-ink tracking-tight mb-8">Are You Ready?</h2>

          <p className="mb-7">
            If you&apos;re not sure whether this is for you, it probably isn&apos;t. If you think
            you can navigate this market on your own, you may be right—browse the public listings,
            buy from established dealers, learn as you go. There&apos;s no shame in that path.
          </p>

          <p className="mb-7">
            But if you have conviction—if you know where you want your collection to go and
            you&apos;re ready to operate at this level—then proceed.
          </p>

          <p className="mb-7">
            Membership is <span className="text-ink font-medium">$200/month</span>, billed annually.
            Renewals fall just before the{' '}
            <span className="text-ink font-medium">Dai Token Ichi</span> each November.
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
                $200/month billed annually · Renews before Dai Token Ichi
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
