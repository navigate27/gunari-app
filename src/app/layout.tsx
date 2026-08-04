import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Gunari — Every night tells a story.",
  description:
    "Recreate the night sky from your most unforgettable moments. Gunari turns a date, time, and place into a collectible print.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Gunari — Every night tells a story.",
    description:
      "Recreate the night sky from your most unforgettable moments.",
    type: "website",
    url: SITE_URL,
    siteName: "Gunari",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gunari — Every night tells a story.",
    description:
      "Recreate the night sky from your most unforgettable moments.",
    images: ["/logo.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Gunari",
  description:
    "Recreate the night sky from your most unforgettable moments. Gunari turns a date, time, and place into a collectible print.",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Web",
  url: SITE_URL,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0d12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${geist.variable}`}>
      <body>
        {children}
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}