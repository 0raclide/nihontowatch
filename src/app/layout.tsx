import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { getServerLocale } from "@/i18n/server";
import { MobileUIProvider } from "@/contexts/MobileUIContext";
import { ThemeProvider, themeInitScript } from "@/contexts/ThemeContext";
import { QuickViewProvider } from "@/contexts/QuickViewContext";
import { QuickView } from "@/components/listing/QuickView";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ActivityWrapper } from "@/components/activity/ActivityWrapper";
import { SignupPressureWrapper } from "@/components/signup";
import { ConsentProvider } from "@/contexts/ConsentContext";
import { getServerGdprRegion } from "@/lib/consent/server";
import { NewSinceLastVisitProvider } from "@/contexts/NewSinceLastVisitContext";
import { CookieBanner, ConsentPreferences } from "@/components/consent";
import {
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo/jsonLd";
import { getActiveDealerCount } from "@/lib/supabase/dealerCount";
import { NavigationProgress } from "@/components/ui/NavigationProgress";

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "NihontoWatch | Japanese Sword & Tosogu Marketplace",
  description: "The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide. Find katana, wakizashi, tsuba, and more.",
  keywords: ["nihonto", "japanese sword", "katana", "tosogu", "tsuba", "samurai sword", "antique sword"],
  alternates: {
    canonical: baseUrl,
  },
  formatDetection: {
    telephone: false,
  },
  category: "shopping",
  icons: {
    icon: "/logo-mon.png",
    apple: "/icon-180.png",
  },
  openGraph: {
    title: "NihontoWatch | Japanese Sword & Tosogu Marketplace",
    description: "The premier aggregator for Japanese swords and sword fittings from dealers worldwide.",
    type: "website",
    locale: "en_US",
    siteName: "NihontoWatch",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "NihontoWatch - Japanese Sword & Tosogu Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NihontoWatch | Japanese Sword & Tosogu Marketplace",
    description: "The premier aggregator for Japanese swords and sword fittings from dealers worldwide.",
    images: ["/api/og"],
  },
};

// Generate WebSite JSON-LD once (it's static — no dealer count)
const websiteJsonLd = generateWebsiteJsonLd();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [dealerCount, locale, isGdprRegion] = await Promise.all([
    getActiveDealerCount(),
    getServerLocale(),
    getServerGdprRegion(),
  ]);
  const organizationJsonLd = generateOrganizationJsonLd(dealerCount);

  return (
    <html lang={locale} className={`${cormorant.variable} ${inter.variable} ${notoSansJP.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#020610" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* JSON-LD Structured Data */}
        <script {...jsonLdScriptProps(organizationJsonLd)} />
        <script {...jsonLdScriptProps(websiteJsonLd)} />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <NavigationProgress />
        <LocaleProvider initialLocale={locale}>
          <AuthProvider>
            <NewSinceLastVisitProvider>
              <ConsentProvider isGdprRegion={isGdprRegion}>
                <SubscriptionProvider>
                  <PaywallModal />
                  <FavoritesProvider>
                    <SignupPressureWrapper dealerCount={dealerCount}>
                      <MobileUIProvider>
                        <ThemeProvider>
                          <QuickViewProvider>
                            <ActivityWrapper>
                              {children}
                            </ActivityWrapper>
                            <QuickView />
                          </QuickViewProvider>
                        </ThemeProvider>
                      </MobileUIProvider>
                    </SignupPressureWrapper>
                  </FavoritesProvider>
                </SubscriptionProvider>
                <CookieBanner />
                <ConsentPreferences />
              </ConsentProvider>
            </NewSinceLastVisitProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
