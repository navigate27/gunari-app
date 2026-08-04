"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, Facebook, Instagram, Share2, Shuffle } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Customizer } from "@/components/create/Customizer";
import { LivePreview } from "@/components/create/LivePreview";
import { useGunariState } from "@/hooks/useGunariState";
import { exportToPng, shareBlob, downloadBlob } from "@/lib/render/png";

export default function CreatePage() {
  const { input, update, updateLocation, randomize, sky, catalogLoading } =
    useGunariState();
  const [generating, setGenerating] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [spinning, setSpinning] = React.useState(false);
  const [cooldownMsg, setCooldownMsg] = React.useState<string | null>(null);
  const randomizeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const clickCountRef = React.useRef(0);
  const lastClickRef = React.useRef(0);
  const cooldownUntilRef = React.useRef(0);
  const msgTimeoutRef = React.useRef<number | null>(null);

  const COOLDOWN_MSGS = [
    "Whoa, partner. The cosmos needs a breath.",
    "Easy, tiger — the stars are still reassembling.",
    "Patience, stargazer. Even the universe takes a beat.",
    "Hold your horses. The sky isn't going anywhere.",
    "That's enough excitement for now. Take a knee.",
    "The constellations are dizzy. Give them a sec.",
    "You're mashing that button like it owes you money.",
    "The sky is on a quick coffee break. Back in a moment.",
  ];

  const fireConfetti = () => {
    const colors = ["#C9A35A", "#E8D5A0", "#F4E9C6", "#FFFFFF", "#D4AF37"];
    const btn = randomizeBtnRef.current;
    const rect = btn?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      : { y: 0.7 };
    const opts = { origin, colors, scalar: 0.3, startVelocity: 22, ticks: 200 };
    confetti({ particleCount: 80, spread: 70, ...opts });
    setTimeout(() => {
      confetti({ particleCount: 40, angle: 60, spread: 55, ...opts });
      confetti({ particleCount: 40, angle: 120, spread: 55, ...opts });
    }, 150);
  };

  const showCooldownMsg = () => {
    const msg = COOLDOWN_MSGS[Math.floor(Math.random() * COOLDOWN_MSGS.length)];
    setCooldownMsg(msg);
    if (msgTimeoutRef.current) window.clearTimeout(msgTimeoutRef.current);
    msgTimeoutRef.current = window.setTimeout(() => setCooldownMsg(null), 2200);
  };

  const onRandomize = () => {
    const now = performance.now();
    // If in cooldown, show a witty message instead.
    if (now < cooldownUntilRef.current) {
      showCooldownMsg();
      return;
    }
    // Reset click count if the last click was > 2s ago (not "in a row").
    if (now - lastClickRef.current > 2000) {
      clickCountRef.current = 0;
    }
    lastClickRef.current = now;
    clickCountRef.current += 1;

    randomize();
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    fireConfetti();

    // After 5 rapid clicks, impose a 5-second cooldown.
    if (clickCountRef.current >= 5) {
      cooldownUntilRef.current = now + 5000;
      clickCountRef.current = 0;
    }
  };

  const onShare = async () => {
    if (!sky) return;
    setGenerating(true);
    try {
      const blob = await exportToPng({
        input,
        stars: sky.stars,
        moon: sky.moon,
        milkyWay: sky.milkyWay,
        celestialGrid: sky.celestialGrid,
      });
      const filename = `gunari-${input.date}-${slug(input.title || "untitled")}.png`;
      await shareBlob(
        blob,
        filename,
        input.title || "Gunari",
        input.message || "Every night tells a story."
      );
    } finally {
      setGenerating(false);
    }
  };

  const onDownload = async () => {
    if (!sky) return;
    setGenerating(true);
    try {
      const blob = await exportToPng({
        input,
        stars: sky.stars,
        moon: sky.moon,
        milkyWay: sky.milkyWay,
        celestialGrid: sky.celestialGrid,
      });
      downloadBlob(
        blob,
        `gunari-${input.date}-${slug(input.title || "untitled")}.png`
      );
      setFlash("Saved to your device");
      setTimeout(() => setFlash(null), 1800);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        {/* Top bar */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-stone hover:text-mist transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="font-display text-xl tracking-[0.3em] text-mist">
            GUNARI
          </span>
          <div className="w-16" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* Preview — sticky on desktop, top on mobile */}
          <div className="order-1 lg:order-1">
            <div className="lg:sticky lg:top-10">
              <LivePreview
                input={input}
                sky={sky}
                loading={catalogLoading}
              />

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                className="mx-auto mt-6 max-w-[420px] space-y-3"
              >
                <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Button
                    ref={randomizeBtnRef}
                    size="md"
                    onClick={onRandomize}
                    disabled={!sky}
                    className="w-full bg-gradient-to-r from-gold via-[#E8D5A0] to-gold text-ink shadow-[0_0_20px_-4px_rgba(201,163,90,0.5)] hover:shadow-[0_0_28px_-2px_rgba(201,163,90,0.7)]"
                  >
                    <motion.span
                      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="inline-flex"
                    >
                      <Shuffle size={14} />
                    </motion.span>
                    Randomize
                  </Button>
                  <AnimatePresence>
                    {cooldownMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-gold/30 bg-ink/95 px-3 py-2 text-[11px] font-medium text-gold shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]"
                      >
                        {cooldownMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={onDownload}
                    disabled={generating || !sky}
                  >
                    <Download size={14} />
                    Save
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <ShareIconButton
                    label="Share"
                    onClick={onShare}
                    disabled={generating || !sky}
                  >
                    <Share2 size={16} />
                  </ShareIconButton>
                  <ShareIconButton
                    label="Facebook"
                    onClick={onShare}
                    disabled={generating || !sky}
                  >
                    <Facebook size={16} />
                  </ShareIconButton>
                  <ShareIconButton
                    label="Instagram"
                    onClick={onShare}
                    disabled={generating || !sky}
                  >
                    <Instagram size={16} />
                  </ShareIconButton>
                  <ShareIconButton
                    label="X"
                    onClick={onShare}
                    disabled={generating || !sky}
                  >
                    <XIcon size={16} />
                  </ShareIconButton>
                  <ShareIconButton
                    label="Reddit"
                    onClick={onShare}
                    disabled={generating || !sky}
                  >
                    <RedditIcon size={16} />
                  </ShareIconButton>
                </div>
              </motion.div>

              {flash && (
                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-gold">
                  {flash}
                </p>
              )}
            </div>
          </div>

          {/* Customizer */}
          <div className="order-2 lg:order-2">
            <Customizer
              input={input}
              update={update}
              updateLocation={updateLocation}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "gunari";
}

function ShareIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md text-mist transition-colors duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
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