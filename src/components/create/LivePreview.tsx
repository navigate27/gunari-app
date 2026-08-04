"use client";

import * as React from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { renderToCanvas, ARTWORK_W, ARTWORK_H } from "@/lib/render/png";
import type { GunariInput } from "@/lib/types";
import type { SkyState } from "@/lib/astronomy/engine";

interface LivePreviewProps {
  input: GunariInput;
  sky: SkyState | null;
  loading?: boolean;
}

const MOON_ANIM_MS = 600;
const THEME_WIPE_MS = 800;
const COMPASS_SPIN_MS = 700;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Diagonal wipe clip-path. The overlay (showing the previous theme) starts
 * covering everything and retreats toward the bottom-right corner along the
 * main diagonal as `p` goes 0 → 1, revealing the new theme underneath.
 */
function diagonalClipPath(p: number): string {
  if (p <= 0) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  if (p >= 1) return "polygon(100% 100%, 100% 100%, 100% 100%)";
  if (p < 0.5) {
    const a = 200 * p;
    return `polygon(${a}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${a}%)`;
  }
  const a = 200 * p - 100;
  return `polygon(100% ${a}%, 100% 100%, ${a}% 100%)`;
}

export function LivePreview({ input, sky, loading }: LivePreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = React.useState(false);

  // 3D grab-rotate: horizontal drag → rotateY (yaw) + subtle rotateZ roll;
  // vertical drag → rotateX (pitch). Perspective depth. The card never
  // translates — it stays put and only spins. Springs back on release.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotateY = useTransform(dragX, [-50, 50], [-28, 28]);
  const rotateZ = useTransform(dragX, [-50, 50], [-4, 4]);
  const rotateX = useTransform(dragY, [-50, 50], [28, -28]);

  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    startDragX: number;
    startDragY: number;
    pointerId: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDragX: dragX.get(),
      startDragY: dragY.get(),
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    const nextX = Math.max(-50, Math.min(50, st.startDragX + dx));
    const nextY = Math.max(-50, Math.min(50, st.startDragY + dy));
    dragX.set(nextX);
    dragY.set(nextY);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    animate(dragX, 0, { type: "spring", stiffness: 180, damping: 18 });
    animate(dragY, 0, { type: "spring", stiffness: 180, damping: 18 });
  };

  // Animated moon opacity (0..1).
  const moonOpacityRef = React.useRef(input.moon ? 1 : 0);
  const moonAnimRef = React.useRef<{
    startTime: number;
    from: number;
    to: number;
  } | null>(null);
  const [moonTick, setMoonTick] = React.useState(0);

  const prevThemeRef = React.useRef(input.theme);

  // Compass spin-in animation (0 = just changed, 1 = settled).
  const compassSpinRef = React.useRef(1);
  const compassAnimRef = React.useRef<{ startTime: number } | null>(null);
  const [compassTick, setCompassTick] = React.useState(0);
  const prevCompassRef = React.useRef(input.compass);

  React.useEffect(() => {
    if (prevCompassRef.current === input.compass) return;
    prevCompassRef.current = input.compass;
    compassSpinRef.current = 0;
    compassAnimRef.current = { startTime: performance.now() };
    let raf = 0;
    const tick = (now: number) => {
      const a = compassAnimRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / COMPASS_SPIN_MS);
      compassSpinRef.current = easeInOutCubic(t);
      setCompassTick((n) => n + 1);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        compassAnimRef.current = null;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      compassAnimRef.current = null;
    };
  }, [input.compass]);

  // Moon visibility animation.
  React.useEffect(() => {
    const target = input.moon ? 1 : 0;
    const current = moonOpacityRef.current;
    if (current === target) return;

    moonAnimRef.current = {
      startTime: performance.now(),
      from: current,
      to: target,
    };

    let raf = 0;
    const tick = (now: number) => {
      const a = moonAnimRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / MOON_ANIM_MS);
      const e = easeInOutCubic(t);
      moonOpacityRef.current = a.from + (a.to - a.from) * e;
      setMoonTick((n) => n + 1);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        moonAnimRef.current = null;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      moonAnimRef.current = null;
    };
  }, [input.moon]);

  // Redraw whenever input / sky / animated moon opacity changes.
  // Theme changes trigger a diagonal wipe: the old frame is captured onto
  // the overlay canvas, the new frame renders underneath, and the overlay's
  // clip-path is animated directly via the ref (no React state) to avoid
  // any race between state commit and the new canvas paint.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sky) return;
    const overlay = overlayRef.current;

    const themeChanged = prevThemeRef.current !== input.theme;
    let willWipe = false;

    if (themeChanged && overlay && canvas.width > 0) {
      if (overlay.width !== canvas.width) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
      }
      const octx = overlay.getContext("2d");
      if (octx) {
        octx.clearRect(0, 0, overlay.width, overlay.height);
        octx.drawImage(canvas, 0, 0);
        // Show the overlay immediately, covering the canvas with the OLD
        // frame before we render the NEW frame underneath.
        overlay.style.opacity = "1";
        overlay.style.clipPath = diagonalClipPath(0);
        willWipe = true;
      }
    }
    prevThemeRef.current = input.theme;

    let raf = 0;
    setRendering(true);
    const run = () => {
      raf = 0;
      renderToCanvas(canvas, {
        input,
        stars: sky.stars,
        moon: sky.moon,
        moonOpacity: moonOpacityRef.current,
        compassSpin: compassSpinRef.current,
      }).finally(() => setRendering(false));
    };
    raf = requestAnimationFrame(run);

    let wipeRaf = 0;
    if (willWipe && overlay) {
      const startT = performance.now();
      const wipeTick = (now: number) => {
        const t = Math.min(1, (now - startT) / THEME_WIPE_MS);
        overlay.style.clipPath = diagonalClipPath(easeInOutCubic(t));
        if (t < 1) {
          wipeRaf = requestAnimationFrame(wipeTick);
        } else {
          const octx2 = overlay.getContext("2d");
          octx2?.clearRect(0, 0, overlay.width, overlay.height);
          overlay.style.opacity = "0";
        }
      };
      wipeRaf = requestAnimationFrame(wipeTick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (wipeRaf) cancelAnimationFrame(wipeRaf);
    };
  }, [
    input,
    sky,
    moonTick,
    compassTick,
    input.theme,
    input.frame,
    input.compass,
    input.starChart,
    input.title,
    input.message,
    input.date,
    input.time,
    input.location.label,
    input.location.lat,
    input.location.lng,
  ]);

  return (
    <div className="relative mx-auto w-full max-w-[504px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        whileTap={{ scale: 1.02 }}
        style={{
          rotateX,
          rotateY,
          rotateZ,
          transformPerspective: 900,
          cursor: "grab",
        }}
        className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-white/8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] active:cursor-grabbing touch-none select-none"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Gunari artwork preview"
        />
        <canvas
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          style={{ opacity: 0, clipPath: "none" }}
        />
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-mist">
                Composing the sky…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {rendering && !loading && (
          <div className="absolute right-3 top-3 h-1.5 w-1.5 animate-pulse rounded-full bg-gold/80" />
        )}
      </motion.div>
    </div>
  );
}

export { ARTWORK_W, ARTWORK_H };