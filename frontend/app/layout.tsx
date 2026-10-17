import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { StoreProvider } from "@/components/store-provider";
import { Footer, Header } from "@/components/site-shell";
import "./globals.css";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900",
});
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "UWA — Everyday, upgraded.", template: "%s | UWA" },
  description:
    "A fresh perspective on everyday living. Explore the UWA collection and find something that feels like you.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "UWA — Everyday, upgraded.",
    description: "Good things. For the way you live.",
    type: "website",
    siteName: "UWA",
  },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8d434",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body id="top">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <StoreProvider>
          <Header />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
