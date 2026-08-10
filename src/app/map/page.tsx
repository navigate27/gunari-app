"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, Share2, Shuffle } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Customizer } from "@/components/map/Customizer";
import { LivePreview } from "@/components/map/LivePreview";
import { useMapPrintState } from "@/hooks/useMapPrintState";
import { downloadMapPng, shareMapPng } from "@/lib/render/png-map";

export default function MapPage() {
  const { input, update, updateLocation, randomize, data, geometry, loading } =
    useMapPrintState();
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
    "Whoa, partner. The map needs a breath.",
    "Easy, tiger — the streets are still reassembling.",
    "Patience, cartographer. Even the map takes a beat.",
    "Hold your horses. The map isn't going anywhere.",
    "That's enough excitement for now. Take a knee.",
    "The roads are dizzy. Give them a sec.",
    "You're mashing that button like it owes you money.",
    "The map is on a quick coffee break. Back in a moment.",
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
    confetti({ particleCount: 80, angle: 270, spread: 70, ...opts });
    setTimeout(() => {
      confetti({ particleCount: 40, angle: 240, spread: 55, ...opts });
      confetti({ particleCount: 40, angle: 300, spread: 55, ...opts });
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
    if (now < cooldownUntilRef.current) {
      showCooldownMsg();
      return;
    }
    if (now - lastClickRef.current > 2000) {
      clickCountRef.current = 0;
    }
    lastClickRef.current = now;
    clickCountRef.current += 1;

    randomize();
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    fireConfetti();

    if (clickCountRef.current >= 5) {
      cooldownUntilRef.current = now + 5000;
      clickCountRef.current = 0;
    }
  };

  const filename = `gunari-map-${slug(input.location.label)}-${slug(input.title || "untitled")}.png`;

  const onDownload = async () => {
    if (!geometry) return;
    setGenerating(true);
    try {
      await downloadMapPng(input, geometry, filename);
      setFlash("Saved — add it to your story");
      setTimeout(() => setFlash(null), 1800);
    } finally {
      setGenerating(false);
    }
  };

  const onShare = async () => {
    if (!geometry) return;
    setGenerating(true);
    try {
      await shareMapPng(
        input,
        geometry,
        filename,
        input.title || "Gunari Map Print",
        input.message || "Every place tells a story.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-stone hover:text-mist transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="font-display text-xl tracking-[0.3em] text-mist">GUNARI</span>
          <div className="w-16" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="order-1 lg:order-1">
            <div className="lg:sticky lg:top-10">
              <LivePreview input={input} data={data} geometry={geometry} loading={loading} />
            </div>
          </div>

          <div className="order-2 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className="mb-8 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Button
                    ref={randomizeBtnRef}
                    size="md"
                    onClick={onRandomize}
                    disabled={!geometry}
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
                  disabled={generating || !geometry}
                >
                  <Download size={14} />
                  Save
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ShareIconButton label="Share" onClick={onShare} disabled={generating || !geometry}>
                  <Share2 size={16} />
                </ShareIconButton>
              </div>
              <p className="text-center text-[10px] uppercase tracking-[0.25em] text-stone">
                Save your map. Add it to your story.
              </p>
              {flash && (
                <p className="text-center text-[10px] uppercase tracking-[0.25em] text-gold">
                  {flash}
                </p>
              )}
            </motion.div>

            <Customizer input={input} update={update} updateLocation={updateLocation} />
          </div>
        </div>
      </div>
    </main>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gunari"
  );
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