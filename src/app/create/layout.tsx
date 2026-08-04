import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create Your Gunari — Recreate the Night Sky",
  description:
    "Enter a date, time, and place. Gunari renders the night sky from that moment as a downloadable, shareable artwork.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "Create Your Gunari — Recreate the Night Sky",
    description:
      "Enter a date, time, and place. Gunari renders the night sky from that moment as a downloadable, shareable artwork.",
    url: `${SITE_URL}/create`,
    type: "website",
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}