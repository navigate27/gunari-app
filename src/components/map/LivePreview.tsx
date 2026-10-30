"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { renderScaffold, FORMATS } from "@gunari/core";
import type { MapPrintSceneData, ProjectedMapGeometry } from "@gunari/scene-mapprint";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { buildMapScaffoldInput } from "@/lib/render/map-scaffold";
import { diagonalClipPath, easeInOutCubic } from "@/lib/render/transitions";

const FALLBACK_W = 540;
const MAX_CARD_W = { story: 504, square: 540, landscape: 720 } as const;
const THEME_WIPE_MS = 800;
const CHANGE_FADE_MS = 400;

type Transition = "wipe" | "fade";

export interface LivePreviewProps {
  input: MapPrintInput;
  data: MapPrintSceneData | null;
  geometry: ProjectedMapGeometry | null;
  loading: boolean;
  /** Drag offset of the map content, canvas-normalized. */
  pan?: { x: number; y: number };
  onPan?: (pan: { x: number; y: number }) => void;
  onPanEnd?: () => void;
}

const NO_PAN = { x: 0, y: 0 };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LivePreview({
  input,
  data,
  geometry,
  loading,
  pan = NO_PAN,
  onPan,
  onPanEnd,
}: LivePreviewProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const animRef = React.useRef(0);
  const dragRef = React.useRef<{ x: number; y: number; pan: { x: number; y: number }; id: number } | null>(null);
  const prevRef = React.useRef<{ input: MapPrintInput; data: MapPrintSceneData | null } | null>(null);
  const [pixelW, setPixelW] = React.useState(0);
  const format = FORMATS[input.format];
  const formatRef = React.useRef(input.format);
  formatRef.current = input.format;

  // Size the backing store to the displayed size in device pixels, so the
  // preview stays sharp on high-density screens instead of being upscaled.
  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const dpr = window.devicePixelRatio || 1;
      setPixelW(Math.min(FORMATS[formatRef.current].w, Math.round(el.clientWidth * dpr)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    const w = pixelW || FALLBACK_W;
    const h = Math.round((w * format.h) / format.w);

    // Snapshot the frame being replaced before the canvas is repainted.
    const prev = prevRef.current;
    let transition: Transition | null = null;
    if (prev && overlay && prev.input.format === input.format && canvas.width === w && !prefersReducedMotion()) {
      if (prev.input.style !== input.style) transition = "wipe";
      else if (
        prev.data !== data ||
        prev.input.shape !== input.shape ||
        prev.input.marker !== input.marker ||
        prev.input.layout !== input.layout ||
        prev.input.labels !== input.labels ||
        prev.input.showCoordinates !== input.showCoordinates
      ) {
        transition = "fade";
      }
    }
    prevRef.current = { input, data };

    if (transition && overlay) {
      cancelAnimationFrame(animRef.current);
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      const octx = overlay.getContext("2d");
      if (octx) {
        octx.drawImage(canvas, 0, 0);
        const wipe = transition === "wipe";
        const duration = wipe ? THEME_WIPE_MS : CHANGE_FADE_MS;
        overlay.style.opacity = "1";
        overlay.style.clipPath = wipe ? diagonalClipPath(0) : "none";
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          if (wipe) overlay.style.clipPath = diagonalClipPath(easeInOutCubic(t));
          else overlay.style.opacity = String(1 - easeInOutCubic(t));
          if (t < 1) {
            animRef.current = requestAnimationFrame(tick);
          } else {
            octx.clearRect(0, 0, overlay.width, overlay.height);
            overlay.style.opacity = "0";
          }
        };
        animRef.current = requestAnimationFrame(tick);
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.scale(w / format.w, w / format.w);
    if (!geometry || !data) {
      ctx.fillStyle = "#1a1b1f";
      ctx.fillRect(0, 0, format.w, format.h);
      return;
    }
    renderScaffold(ctx, buildMapScaffoldInput(input, geometry, pan));
  }, [input, data, geometry, pixelW, format, pan]);

  React.useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const canPan = Boolean(onPan && geometry);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan) return;
    dragRef.current = { x: e.clientX, y: e.clientY, pan, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPan?.({
      x: d.pan.x + (e.clientX - d.x) / rect.width,
      y: d.pan.y + (e.clientY - d.y) / rect.height,
    });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onPanEnd?.();
  };

  return (
    <div
      className="relative mx-auto w-full transition-[max-width] duration-500 ease-out"
      style={{ maxWidth: MAX_CARD_W[input.format] }}
    >
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ aspectRatio: `${format.w} / ${format.h}`, transition: "aspect-ratio 0.5s ease-out" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative touch-none select-none overflow-hidden rounded-[20px] border border-line shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ${
          canPan ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Map print preview"
        />
        <canvas
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          style={{ opacity: 0 }}
        />
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
            >
              <span className="text-[10px] uppercase tracking-[0.3em] text-mist">
                Drawing the map…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {canPan && (
        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-stone">
          Drag the map to move it
        </p>
      )}
    </div>
  );
}
