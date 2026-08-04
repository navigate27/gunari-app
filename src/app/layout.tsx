import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
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
  title: "Gunari — Every night tells a story.",
  description:
    "Recreate the night sky from your most unforgettable moments. Gunari turns a date, time, and place into a collectible print.",
  openGraph: {
    title: "Gunari — Every night tells a story.",
    description:
      "Recreate the night sky from your most unforgettable moments.",
    type: "website",
  },
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
      <body>{children}</body>
    </html>
  );
}