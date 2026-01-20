import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { MobileUIProvider } from "@/contexts/MobileUIContext";
import { ThemeProvider, themeInitScript } from "@/contexts/ThemeContext";
import { QuickViewProvider } from "@/contexts/QuickViewContext";
import { QuickView } from "@/components/listing/QuickView";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ActivityWrapper } from "@/components/activity/ActivityWrapper";
import { SignupPressureWrapper } from "@/components/signup";

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
  title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
  description: "The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide. Find katana, wakizashi, tsuba, and more.",
  keywords: ["nihonto", "japanese sword", "katana", "tosogu", "tsuba", "samurai sword", "antique sword"],
  icons: {
    icon: "/logo-mon.png",
    apple: "/logo-mon.png",
  },
  openGraph: {
    title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
    description: "The premier aggregator for Japanese swords and sword fittings from dealers worldwide.",
    type: "website",
    locale: "en_US",
    siteName: "Nihontowatch",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Nihontowatch - Japanese Sword & Tosogu Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
    description: "The premier aggregator for Japanese swords and sword fittings from dealers worldwide.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#121212" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
