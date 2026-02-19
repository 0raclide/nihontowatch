import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
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
import { NewSinceLastVisitProvider } from "@/contexts/NewSinceLastVisitContext";
import { CookieBanner, ConsentPreferences } from "@/components/consent";
import {
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo/jsonLd";
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

// Generate JSON-LD schemas once (they're static)
const organizationJsonLd = generateOrganizationJsonLd();
const websiteJsonLd = generateWebsiteJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#020610" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* JSON-LD Structured Data */}
        <script {...jsonLdScriptProps(organizationJsonLd)} />
        <script {...jsonLdScriptProps(websiteJsonLd)} />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <NavigationProgress />
        <AuthProvider>
          <NewSinceLastVisitProvider>
            <ConsentProvider>
              <SubscriptionProvider>
                <PaywallModal />
                <FavoritesProvider>
                  <SignupPressureWrapper>
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
      </body>
    </html>
  );
}
