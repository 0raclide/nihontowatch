'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { TIER_PRICING } from '@/types/subscription';

// =============================================================================
// Icons
// =============================================================================

function LockOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

// =============================================================================
// Feature Section Component
// =============================================================================

interface FeatureSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
  highlight?: string;
}

function FeatureSection({ icon, title, description, details, highlight }: FeatureSectionProps) {
  return (
    <div className="border-b border-border/50 pb-12 mb-12 last:border-0 last:pb-0 last:mb-0">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 bg-gold/10 rounded-xl text-gold shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-ink mb-2">{title}</h3>
          <p className="text-secondary leading-relaxed">{description}</p>
        </div>
      </div>

      {highlight && (
        <div className="ml-16 mb-4 p-4 bg-gold/5 border border-gold/20 rounded-lg">
          <p className="text-sm text-ink font-medium">{highlight}</p>
        </div>
      )}

      <ul className="ml-16 space-y-2">
        {details.map((detail, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-secondary">
            <span className="text-gold mt-1">•</span>
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Testimonial Component
// =============================================================================

interface TestimonialCardProps {
  quote: string;
  name: string;
  location: string;
  collecting: string;
}

function TestimonialCard({ quote, name, location, collecting }: TestimonialCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <blockquote className="text-secondary leading-relaxed mb-4">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
          <span className="text-gold font-medium">{name.charAt(0)}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="text-xs text-muted">{location} • {collecting}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-4 py-12 lg:py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-gold text-sm font-medium uppercase tracking-wider mb-3">
            Connoisseur Membership
          </p>
          <h1 className="font-serif text-3xl lg:text-4xl text-ink mb-4">
            For Those Who Collect Seriously
          </h1>
          <p className="text-secondary max-w-2xl mx-auto text-lg leading-relaxed">
            The nihonto market moves fast. The best pieces sell within hours, often before
            they ever reach public listings. Connoisseur membership gives you the access
            and tools to compete at the highest level.
          </p>
        </div>

        {/* Price Card */}
        <div className="bg-surface border border-gold/30 rounded-2xl p-8 mb-16 text-center">
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-4xl font-bold text-ink">${monthlyPrice}</span>
            <span className="text-muted">/month</span>
          </div>
          <p className="text-sm text-muted mb-6">
            Billed annually at ${pricing.annual}/year
          </p>

          {isConnoisseur ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              You&apos;re a Connoisseur Member
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="px-8 py-3 bg-gold hover:bg-gold-light text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Redirecting...' : 'Become a Connoisseur'}
            </button>
          )}
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl text-ink text-center mb-12">
            What You Get
          </h2>

          <FeatureSection
            icon={<LockOpenIcon className="w-6 h-6" />}
            title="Private Dealer Offerings"
            description="Access inventory that never reaches public listings. Top Japanese dealers reserve their finest pieces for serious collectors they trust."
            highlight="Many Juyo and Tokubetsu Juyo pieces sell privately before ever being listed publicly. This is how experienced collectors build world-class collections."
            details={[
              'Direct access to pre-market inventory from select dealers',
              'First opportunity on exceptional pieces before public listing',
              'Pieces reserved for collectors who understand their value',
              'Build relationships with dealers who source the best material',
            ]}
          />

          <FeatureSection
            icon={<BellIcon className="w-6 h-6" />}
            title="Instant Search Alerts"
            description="Get notified the moment a matching piece is listed. In a market where the best items sell in hours, speed is everything."
            details={[
              'Real-time email alerts when new listings match your criteria',
              'Set alerts for specific smiths, schools, certifications, or price ranges',
              'Never miss a piece you&apos;ve been hunting for years',
              'Combine with saved searches for precision targeting',
            ]}
          />

          <FeatureSection
            icon={<ChartIcon className="w-6 h-6" />}
            title="Artist Certification Statistics"
            description="Make informed decisions with comprehensive data on certifications by smith and school. Know exactly how rare a piece truly is."
            details={[
              'Juyo, Tokubetsu Juyo, and Bunkazai counts by artist',
              'Historical certification pass rates by school and era',
              'Compare rarity across similar smiths',
              'Understand true market positioning of any piece',
            ]}
          />

          <FeatureSection
            icon={<UsersIcon className="w-6 h-6" />}
            title="Exclusive Collector Community"
            description="Connect with serious collectors who share your passion. Exchange knowledge, discuss pieces, and learn from those who have built significant collections."
            details={[
              'Private Discord with vetted collectors only',
              'Direct discussions with experienced nihonto enthusiasts',
              'Share finds, ask questions, get honest opinions',
              'Build relationships with collectors worldwide',
            ]}
          />

          <FeatureSection
            icon={<ChatIcon className="w-6 h-6" />}
            title="Direct LINE Support"
            description="Get personalized guidance when you need it. Whether you&apos;re evaluating a potential purchase or need help navigating a dealer relationship, direct support is available."
            details={[
              'Direct LINE access for questions and guidance',
              'Help evaluating pieces and understanding fair pricing',
              'Assistance with dealer communications in Japanese',
              'Navigate complex transactions with confidence',
            ]}
          />
        </div>

        {/* Value Proposition */}
        <div className="bg-ink text-cream rounded-2xl p-8 lg:p-12 mb-16">
          <h2 className="font-serif text-2xl mb-6 text-center">
            The Math Is Simple
          </h2>
          <div className="max-w-2xl mx-auto space-y-4 text-cream/80">
            <p>
              A single Juyo katana typically costs $30,000–$150,000. Getting access to the right
              piece at the right time—or avoiding a costly mistake—easily justifies the membership
              many times over.
            </p>
            <p>
              More importantly, the pieces that build truly exceptional collections rarely appear
              on public listings. Private dealer access isn&apos;t a luxury—it&apos;s how serious
              collecting actually works.
            </p>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl text-ink text-center mb-12">
            What Members Say
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <TestimonialCard
              quote="The private dealer access alone paid for my membership within a month. I acquired a Juyo Sadamune that never would have appeared publicly."
              name="M.K."
              location="California, USA"
              collecting="Collecting 12 years"
            />
            <TestimonialCard
              quote="I was skeptical about the price until I saw what pieces actually sell for privately vs publicly. The information asymmetry in this market is real."
              name="T.H."
              location="London, UK"
              collecting="Collecting 8 years"
            />
            <TestimonialCard
              quote="The community alone is worth it. Getting honest opinions from experienced collectors before a major purchase has saved me from several mistakes."
              name="S.Y."
              location="Tokyo, Japan"
              collecting="Collecting 20 years"
            />
            <TestimonialCard
              quote="Search alerts changed how I collect. I no longer spend hours checking sites—I just wait for exactly what I'm looking for to appear."
              name="R.B."
              location="Sydney, Australia"
              collecting="Collecting 5 years"
            />
          </div>
        </div>

        {/* Final CTA */}
        {!isConnoisseur && (
          <div className="text-center">
            <h2 className="font-serif text-2xl text-ink mb-4">
              Ready to Collect Seriously?
            </h2>
            <p className="text-secondary mb-8 max-w-xl mx-auto">
              Join collectors who understand that access and information are everything
              in the nihonto market.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="px-8 py-4 bg-gold hover:bg-gold-light text-white font-medium rounded-lg transition-colors text-lg disabled:opacity-50"
            >
              {isLoading ? 'Redirecting...' : 'Become a Connoisseur'}
            </button>
            <p className="text-sm text-muted mt-4">
              ${monthlyPrice}/month billed annually • Cancel anytime
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-linen/50 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted">
          <p>Questions? Contact us at support@nihontowatch.com</p>
        </div>
      </footer>

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
