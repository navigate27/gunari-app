import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Map Print — Gunari",
  description:
    "Turn a meaningful place into a beautiful Map Print. Pick a location, customize the style, and download a shareable artwork.",
  alternates: { canonical: "/map" },
  openGraph: {
    title: "Map Print — Gunari",
    description:
      "Turn a meaningful place into a beautiful Map Print. Pick a location, customize the style, and download a shareable artwork.",
    url: `${SITE_URL}/map`,
    type: "website",
  },
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}