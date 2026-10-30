"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Facebook, Instagram, Share2 } from "lucide-react";
import { NightSkyHero } from "@/components/landing/NightSkyHero";
import { buttonStyles } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { RedditIcon, XIcon } from "@/components/ui/icons";
import { SITE_URL } from "@/lib/site";

const MotionLink = motion.create(Link);

export default function LandingPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative min-h-[100dvh] overflow-hidden">
        <NightSkyHero />

        <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 py-10 sm:px-10">
          <header>
            <span className="font-display text-2xl tracking-[0.3em] text-mist">
              GUNARI
            </span>
          </header>

          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.1 }}
              className="font-display text-[clamp(2.8rem,9vw,5.5rem)] leading-[1.05] text-mist text-balance"
            >
              Every night
              <br />
              tells a story.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
              className="mt-6 max-w-md text-base text-stone leading-relaxed"
            >
              Recreate the night sky from your most unforgettable moments.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
              className="mt-10"
            >
              <MotionLink
                href="/create"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={buttonStyles({
                  variant: "accent",
                  size: "lg",
                  shape: "pill",
                  className: "px-10",
                })}
              >
                Create Your Gunari
              </MotionLink>
            </motion.div>
          </section>
        </div>
      </section>

      {/* Explanation */}
      <section className="bg-ink px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-gold">
              The name
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.8rem,5vw,3rem)] leading-tight text-mist text-balance">
              Gunita. Mayari. Gunari.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm text-stone leading-relaxed">
              From gunita, the Tagalog word for memory, and Mayari, the moon
              goddess of Philippine mythology, Gunari weaves two ideas into
              one: the night you remember, under the moon that watched it
              happen.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            <Pillar title="Memory" delay={0.1}>
              Choose a date, a time, a place. The night that mattered,
              preserved exactly as it was.
            </Pillar>
            <Pillar title="Stars" delay={0.2}>
              Real astronomical data. The stars, moon, and constellations are
              rendered in their true positions, scientifically accurate and
              beautifully composed.
            </Pillar>
            <Pillar title="Story" delay={0.3}>
              Add your title and a message. Download a print or share it to
              your story. Every night tells a story.
            </Pillar>
          </div>
        </div>
      </section>

      {/* Share + footer */}
      <section className="bg-ink px-6 pb-12 pt-8 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal className="text-center">
            <h2 className="font-display text-[clamp(1.6rem,4.5vw,2.6rem)] leading-tight text-mist text-balance">
              Send a night to remember.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm text-stone leading-relaxed">
              Know someone with a moment worth keeping? Share Gunari and let
              them frame the sky they were under.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <IconButton bordered label="Share Gunari" onClick={onShareNative}>
                <Share2 size={16} />
              </IconButton>
              <IconButton bordered label="Share on X" onClick={onShareX}>
                <XIcon size={16} />
              </IconButton>
              <IconButton bordered label="Share on Facebook" onClick={onShareFacebook}>
                <Facebook size={16} />
              </IconButton>
              <IconButton bordered label="Share on Instagram" onClick={onShareInstagram}>
                <Instagram size={16} />
              </IconButton>
              <IconButton bordered label="Share on Reddit" onClick={onShareReddit}>
                <RedditIcon size={16} />
              </IconButton>
            </div>
          </Reveal>
          <footer className="mt-16 text-center text-[10px] uppercase tracking-[0.3em] text-stone">
            &copy; Gunari
          </footer>
        </div>
      </section>
    </main>
  );
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Pillar({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <h3 className="font-display text-2xl text-mist">{title}</h3>
      <p className="mt-3 text-sm text-stone leading-relaxed">{children}</p>
    </Reveal>
  );
}

const SHARE_TEXT = "Every night tells a story. Frame yours with Gunari.";

function onShareNative() {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator
      .share({ title: "Gunari", text: SHARE_TEXT, url: SITE_URL })
      .catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(SITE_URL);
}

function onShareX() {
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function onShareFacebook() {
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function onShareReddit() {
  window.open(
    `https://www.reddit.com/submit?title=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function onShareInstagram() {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator
      .share({ title: "Gunari", text: SHARE_TEXT, url: SITE_URL })
      .catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(SITE_URL);
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
}
