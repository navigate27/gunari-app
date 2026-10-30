"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, Facebook, Instagram, Share2, Shuffle, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Customizer } from "@/components/create/Customizer";
import { LivePreview } from "@/components/create/LivePreview";
import { useGunariState } from "@/hooks/useGunariState";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { exportToPng, shareBlob, downloadBlob } from "@/lib/render/png";

export default function CreatePage() {
  const { input, update, updateLocation, randomize, sky, catalogLoading } =
    useGunariState();
  const [generating, setGenerating] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [spinning, setSpinning] = React.useState(false);
  const [cooldownMsg, setCooldownMsg] = React.useState<string | null>(null);
  const [showShareHint, setShowShareHint] = React.useState(false);
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
      setFlash("Saved — add it to your story");
      setTimeout(() => setFlash(null), 1800);
    } finally {
      setGenerating(false);
    }
  };

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = React.useState<MobileTab>("editor");
  const [direction, setDirection] = React.useState(1);

  const selectTab = (next: MobileTab) => {
    if (next === tab) return;
    setDirection(TABS.findIndex((t) => t.id === next) > TABS.findIndex((t) => t.id === tab) ? 1 : -1);
    setTab(next);
  };

  // On mobile the preview unmounts while editing. Hold it on the input it last
  // showed and release the edits once the Preview tab has finished entering, so
  // the card's change animations play in view instead of off-screen.
  const [previewInput, setPreviewInput] = React.useState(input);
  React.useEffect(() => {
    if (isDesktop) setPreviewInput(input);
  }, [isDesktop, input]);

  const preview = (
    <LivePreview
      input={isDesktop ? input : previewInput}
      sky={sky}
      loading={catalogLoading}
    />
  );

  const editor = (
    <>
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
                <div
                  className="relative"
                  onMouseEnter={() => setShowShareHint(true)}
                  onMouseLeave={() => setShowShareHint(false)}
                >
                  <Button
                    variant="outline"
                    size="md"
                    onClick={onDownload}
                    disabled={generating || !sky}
                  >
                    <Download size={14} />
                    Save
                  </Button>
                  <AnimatePresence>
                    {showShareHint && (
                      <motion.div
                        initial={{ opacity: 0, y: -14, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 260, damping: 16 }}
                        className="absolute top-full left-1/2 mt-3 w-72 -translate-x-1/2 rounded-2xl border border-gold/40 bg-ink/95 px-5 py-4 text-center shadow-[0_20px_60px_-20px_rgba(201,163,90,0.6)] backdrop-blur-md"
                      >
                        <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold">
                          <Sparkles size={12} />
                          The stars demand an audience
                        </div>
                        <p className="text-[11px] leading-relaxed text-stone">
                          Save it here, then share it to your story.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
              <p className="text-center text-[10px] uppercase tracking-[0.25em] text-stone">
                Save your sky. Add it to your story.
              </p>
              {flash && (
                <p className="text-center text-[10px] uppercase tracking-[0.25em] text-gold">
                  {flash}
                </p>
              )}
            </motion.div>

            <Customizer
              input={input}
              update={update}
              updateLocation={updateLocation}
            />
    </>
  );

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

        {isDesktop ? (
          <div className="grid gap-10 grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div>
              <div className="sticky top-10">{preview}</div>
            </div>
            <div>{editor}</div>
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Create view"
              className="sticky top-0 z-20 -mx-5 mb-6 flex border-b border-white/10 bg-ink/90 px-5 backdrop-blur-md sm:-mx-8 sm:px-8"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => selectTab(t.id)}
                  className={`relative flex-1 cursor-pointer py-5 text-xs uppercase tracking-[0.25em] transition-colors duration-200 ${
                    tab === t.id ? "text-gold" : "text-stone hover:text-mist"
                  }`}
                >
                  {t.label}
                  {tab === t.id && (
                    <motion.span
                      layoutId="create-tab-indicator"
                      className="absolute inset-x-0 -bottom-px h-px bg-gold"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={tab}
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                custom={direction}
                variants={panelVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                onAnimationComplete={(def) => {
                  if (def === "center" && tab === "preview") setPreviewInput(input);
                }}
              >
                {tab === "preview" ? preview : editor}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </main>
  );
}

type MobileTab = "editor" | "preview";

const TABS: { id: MobileTab; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

const panelVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

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
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="14.5" rx="8" ry="5.5" />
      <circle cx="4.3" cy="11.8" r="1.7" />
      <circle cx="19.7" cy="11.8" r="1.7" />
      <path d="M12 9 L13.4 3.8 L17.2 4.8" />
      <circle cx="18.4" cy="5.2" r="1.4" />
      <path d="M9.2 17.2c1.7 1.1 3.9 1.1 5.6 0" />
      <circle cx="9" cy="13.6" r="0.6" fill="currentColor" />
      <circle cx="15" cy="13.6" r="0.6" fill="currentColor" />
    </svg>
  );
}