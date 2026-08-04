"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { NightSkyHero } from "@/components/landing/NightSkyHero";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
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
            Choose a date, a place, a feeling — and let Gunari compose a print
            worth keeping.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
            className="mt-10"
          >
            <Link href="/create">
              <Button size="lg" className="px-10">
                Create Your Gunari
              </Button>
            </Link>
          </motion.div>
        </section>

        <footer className="text-center text-[10px] uppercase tracking-[0.3em] text-stone/70">
          Gunari · v1.0
        </footer>
      </div>
    </main>
  );
}