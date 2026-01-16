import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { MobileUIProvider } from "@/contexts/MobileUIContext";

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

export const metadata: Metadata = {
  title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
  description: "The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide. Find katana, wakizashi, tsuba, and more.",
  keywords: ["nihonto", "japanese sword", "katana", "tosogu", "tsuba", "samurai sword", "antique sword"],
  openGraph: {
    title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
    description: "The premier aggregator for Japanese swords and sword fittings from dealers worldwide.",
    type: "website",
    locale: "en_US",
    siteName: "Nihontowatch",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="antialiased bg-cream text-stone-900 font-sans">
        <MobileUIProvider>
          {children}
        </MobileUIProvider>
      </body>
    </html>
  );
}
