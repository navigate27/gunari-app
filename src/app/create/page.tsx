"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Download, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Customizer } from "@/components/create/Customizer";
import { LivePreview } from "@/components/create/LivePreview";
import { useGunariState } from "@/hooks/useGunariState";
import { exportToPng, shareBlob, downloadBlob } from "@/lib/render/png";

export default function CreatePage() {
  const { input, update, updateLocation, sky, catalogLoading } =
    useGunariState();
  const [generating, setGenerating] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);

  const onGenerate = async () => {
    if (!sky) return;
    setGenerating(true);
    try {
      const blob = await exportToPng({
        input,
        stars: sky.stars,
        moon: sky.moon,
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
                className="mx-auto mt-6 flex max-w-[420px] items-center gap-3"
              >
                <Button
                  size="md"
                  onClick={onGenerate}
                  disabled={generating || !sky}
                  className="flex-1"
                >
                  <Sparkles size={14} />
                  {generating ? "Composing…" : "Generate"}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={onDownload}
                  disabled={generating || !sky}
                  aria-label="Download PNG"
                >
                  <Download size={14} />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={onGenerate}
                  disabled={generating || !sky}
                  aria-label="Share"
                >
                  <Share2 size={14} />
                </Button>
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