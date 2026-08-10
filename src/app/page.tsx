"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Facebook, Instagram, Share2 } from "lucide-react";
import { NightSkyHero } from "@/components/landing/NightSkyHero";
import { SITE_URL } from "@/lib/site";

export default function LandingPage() {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative min-h-[100dvh] overflow-hidden">
        <NightSkyHero />

        <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 py-10 sm:px-10">
          <header className="flex items-center justify-between">
            <span className="font-display text-2xl tracking-[0.3em] text-mist">
              GUNARI
            </span>
            <nav className="hidden sm:flex items-center gap-6 text-[11px] uppercase tracking-[0.2em] text-stone">
              <span>Memory</span>
              <span>Stars</span>
              <span>Story</span>
            </nav>
          </header>

          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="mb-5 text-[11px] uppercase tracking-[0.4em] text-stone"
            >
              Memory · Sky · Story
            </motion.p>

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
              className="mt-6 max-w-md text-sm text-stone leading-relaxed"
            >
              Recreate the night sky from your most unforgettable moments.
              Choose a date, a place, a feeling — and let Gunari compose a
              print worth keeping.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
              className="mt-10 flex flex-col items-center gap-4"
            >
              <Link href="/create">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-gold/40 bg-gradient-to-r from-gold via-[#E8D5A0] to-gold px-10 font-ui text-base uppercase tracking-wide text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_30px_-8px_rgba(201,163,90,0.6)] transition-[border-color,box-shadow] duration-300 hover:border-gold/70 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_12px_40px_-6px_rgba(201,163,90,0.9)]"
                >
                  Create Your Gunari
                </motion.button>
              </Link>
              <Link href="/map">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-mist/30 bg-transparent px-8 font-ui text-sm uppercase tracking-wide text-mist transition-colors duration-300 hover:border-mist/60 hover:bg-mist/5"
                >
                  Map Print
                </motion.button>
              </Link>
            </motion.div>
          </section>
        </div>
      </section>

      {/* Explanation */}
      <section className="bg-ink px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-gold">
              The name
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.8rem,5vw,3rem)] leading-tight text-mist text-balance">
              Gunita. Mayari. Gunari.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm text-stone leading-relaxed">
              From gunita, the Tagalog word for memory, and Mayari, the moon
              goddess of Philippine mythology — Gunari weaves two ideas into
              one: the night you remember, under the moon that watched it
              happen.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            >
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-gold">
                Memory
              </h3>
              <p className="mt-3 text-sm text-stone leading-relaxed">
                Choose a date, a time, a place. The night that mattered —
                preserved exactly as it was.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-gold">
                Stars
              </h3>
              <p className="mt-3 text-sm text-stone leading-relaxed">
                Real astronomical data. The stars, moon, and constellations are
                rendered in their true positions — scientifically accurate,
                beautifully composed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            >
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-gold">
                Story
              </h3>
              <p className="mt-3 text-sm text-stone leading-relaxed">
                Add your title and a message. Download a print or share it to
                your story. Every night tells a story.
              </p>
            </motion.div>
          </div>

        </div>
      </section>

      {/* Share + footer */}
      <section className="bg-ink px-6 pb-12 pt-8 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-gold">
              Pass it on
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.6rem,4.5vw,2.6rem)] leading-tight text-mist text-balance">
              Send a night to remember.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm text-stone leading-relaxed">
              Know someone with a moment worth keeping? Share Gunari — and
              let them frame the sky they were under.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <ShareSiteButton label="Share Gunari" onClick={onShareNative}>
                <Share2 size={16} />
              </ShareSiteButton>
              <ShareSiteButton label="Share on X" onClick={onShareX}>
                <XIcon size={16} />
              </ShareSiteButton>
              <ShareSiteButton label="Share on Facebook" onClick={onShareFacebook}>
                <Facebook size={16} />
              </ShareSiteButton>
              <ShareSiteButton label="Share on Instagram" onClick={onShareInstagram}>
                <Instagram size={16} />
              </ShareSiteButton>
              <ShareSiteButton label="Share on Reddit" onClick={onShareReddit}>
                <RedditIcon size={16} />
              </ShareSiteButton>
            </div>
          </motion.div>
          <footer className="mt-16 text-center text-[10px] uppercase tracking-[0.3em] text-stone/70">
            Gunari · v1.0
          </footer>
        </div>
      </section>
    </main>
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

function ShareSiteButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 text-mist transition-colors duration-200 hover:border-gold/40 hover:text-gold"
    >
      {children}
    </button>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RedditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.197-.983-.793 3.428c1.451.07 2.735.532 3.682 1.271.461-.43 1.097-.697 1.794-.697 1.464 0 2.65 1.187 2.65 2.651 0 1.334-.99 2.439-2.273 2.622-.043.683-.283 1.334-.708 1.929-.708 1.013-1.877 1.815-3.298 2.322-1.32.473-2.852.722-4.427.722s-3.107-.249-4.427-.722c-1.421-.507-2.59-1.309-3.298-2.322-.425-.595-.665-1.246-.708-1.929-1.283-.183-2.273-1.288-2.273-2.622 0-1.464 1.186-2.651 2.65-2.651.697 0 1.334.267 1.794.697.948-.739 2.231-1.201 3.682-1.271l-.793-3.428-2.197.983a1.25 1.25 0 0 1-2.498-.056 1.25 1.25 0 0 1 1.25-1.249 1.24 1.24 0 0 1 .839.328l3.028 1.354.426-1.84a1.249 1.249 0 0 1-.842-1.181c0-.688.562-1.249 1.25-1.249s1.25.561 1.25 1.249a1.24 1.24 0 0 1-.842 1.181l.426 1.84 3.028-1.354a1.24 1.24 0 0 1 .839-.328z" />
    </svg>
  );
}