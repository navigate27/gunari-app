"use client";

import * as React from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { renderToCanvas, ARTWORK_W, ARTWORK_H } from "@/lib/render/png";
import type { CompassStyleId, GunariInput, LayoutId } from "@/lib/types";
import { elementHasMoon } from "@/lib/types";
import type { SkyState } from "@/lib/astronomy/engine";

interface LivePreviewProps {
  input: GunariInput;
  sky: SkyState | null;
  loading?: boolean;
}

const MOON_ANIM_MS = 600;
const THEME_WIPE_MS = 800;
const COMPASS_SPIN_MS = 700;
const LAYOUT_TRANSITION_MS = 800;
const MESSAGE_ANIM_MS = 600;
const CHART_SCALE_MS = 400;
const PREVIEW_SCALE = 0.6;

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
  const moonOpacityRef = React.useRef(elementHasMoon(input.elements) ? 1 : 0);
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
  // Previous compass id during a crossfade transition (null when settled).
  const compassFromRef = React.useRef<CompassStyleId | null>(null);

  // Layout transition (0 = just changed, 1 = settled). All sections slide
  // from their old layout positions to the new ones simultaneously.
  const layoutProgressRef = React.useRef(1);
  const layoutAnimRef = React.useRef<{ startTime: number } | null>(null);
  const [layoutTick, setLayoutTick] = React.useState(0);
  const prevLayoutRef = React.useRef(input.layout);
  const layoutFromRef = React.useRef<LayoutId | null>(null);

  React.useEffect(() => {
    if (prevLayoutRef.current === input.layout) return;
    layoutFromRef.current = prevLayoutRef.current;
    prevLayoutRef.current = input.layout;
    layoutProgressRef.current = 0;
    layoutAnimRef.current = { startTime: performance.now() };
    let raf = 0;
    const tick = (now: number) => {
      const a = layoutAnimRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / LAYOUT_TRANSITION_MS);
      layoutProgressRef.current = easeInOutCubic(t);
      setLayoutTick((n) => n + 1);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        layoutAnimRef.current = null;
        layoutFromRef.current = null;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      layoutAnimRef.current = null;
    };
  }, [input.layout]);

  // Message-clear transition (0 = has message, 1 = cleared). Title, chart,
  // and metadata slide between their with-message and no-message positions.
  const messageProgressRef = React.useRef(input.message?.trim() ? 0 : 1);
  const messageAnimRef = React.useRef<{
    startTime: number;
    from: number;
    to: number;
  } | null>(null);
  const [messageTick, setMessageTick] = React.useState(0);

  React.useEffect(() => {
    const target = input.message?.trim() ? 0 : 1;
    const current = messageProgressRef.current;
    if (current === target) return;
    messageAnimRef.current = {
      startTime: performance.now(),
      from: current,
      to: target,
    };
    let raf = 0;
    const tick = (now: number) => {
      const a = messageAnimRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / MESSAGE_ANIM_MS);
      messageProgressRef.current = a.from + (a.to - a.from) * easeInOutCubic(t);
      setMessageTick((n) => n + 1);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        messageAnimRef.current = null;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      messageAnimRef.current = null;
    };
  }, [input.message]);

  // Chart scale pulse when the magnitude slider changes. The chart briefly
  // shrinks then grows back to 1, giving visual feedback on adjustment.
  const chartScaleRef = React.useRef(1);
  const chartScaleAnimRef = React.useRef<{ startTime: number } | null>(null);
  const [chartScaleTick, setChartScaleTick] = React.useState(0);
  const prevMagnitudeRef = React.useRef(input.magnitude);

  React.useEffect(() => {
    if (prevMagnitudeRef.current === input.magnitude) return;
    prevMagnitudeRef.current = input.magnitude;
    chartScaleRef.current = 0.93;
    chartScaleAnimRef.current = { startTime: performance.now() };
    let raf = 0;
    const tick = (now: number) => {
      const a = chartScaleAnimRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / CHART_SCALE_MS);
      // Ease back to 1 from 0.93.
      chartScaleRef.current = 0.93 + (1 - 0.93) * easeInOutCubic(t);
      setChartScaleTick((n) => n + 1);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        chartScaleAnimRef.current = null;
        chartScaleRef.current = 1;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      chartScaleAnimRef.current = null;
    };
  }, [input.magnitude]);

  React.useEffect(() => {
    if (prevCompassRef.current === input.compass) return;
    compassFromRef.current = prevCompassRef.current;
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
        compassFromRef.current = null;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      compassAnimRef.current = null;
    };
  }, [input.compass]);

  // Moon visibility animation — triggers when the moon is toggled in the
  // elements multiselect.
  const moonSelected = elementHasMoon(input.elements);
  React.useEffect(() => {
    const target = moonSelected ? 1 : 0;
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
  }, [moonSelected]);

  // Theme wipe — its own effect so animation ticks (compass spin, layout
  // slide, chart pulse, moon fade) don't cancel the wipe rAF. Captures the
  // old frame to the overlay BEFORE the render effect paints the new frame,
  // then retreats the overlay to reveal it. Declared before the render
  // effect so it runs first on theme changes.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const themeChanged = prevThemeRef.current !== input.theme;
    if (!themeChanged || canvas.width === 0) {
      prevThemeRef.current = input.theme;
      return;
    }

    if (overlay.width !== canvas.width) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
    }
    const octx = overlay.getContext("2d");
    if (!octx) {
      prevThemeRef.current = input.theme;
      return;
    }
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.drawImage(canvas, 0, 0);
    overlay.style.opacity = "1";
    overlay.style.clipPath = diagonalClipPath(0);
    prevThemeRef.current = input.theme;

    let wipeRaf = 0;
    const startT = performance.now();
    const wipeTick = (now: number) => {
      const t = Math.min(1, (now - startT) / THEME_WIPE_MS);
      overlay.style.clipPath = diagonalClipPath(easeInOutCubic(t));
      if (t < 1) {
        wipeRaf = requestAnimationFrame(wipeTick);
      } else {
        octx.clearRect(0, 0, overlay.width, overlay.height);
        overlay.style.opacity = "0";
        wipeRaf = 0;
      }
    };
    wipeRaf = requestAnimationFrame(wipeTick);

    return () => {
      if (wipeRaf) cancelAnimationFrame(wipeRaf);
    };
  }, [input.theme]);

  // Redraw whenever input / sky / animated moon opacity changes.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sky) return;

    // Render directly — no rAF. The chart-scale pulse ticks state every
    // frame, which re-runs this effect; deferring via rAF meant the render
    // was constantly cancelled before it fired, so the canvas never updated
    // during the pulse. Drawing synchronously guarantees the paint happens.
    renderToCanvas(canvas, {
      input,
      stars: sky.stars,
      moon: sky.moon,
      milkyWay: sky.milkyWay,
      celestialGrid: sky.celestialGrid,
      moonOpacity: moonOpacityRef.current,
      compassSpin: compassSpinRef.current,
      compassFrom: compassFromRef.current ?? undefined,
      layoutProgress: layoutProgressRef.current,
      layoutFrom: layoutFromRef.current ?? undefined,
      messageProgress: messageProgressRef.current,
      chartScale: chartScaleRef.current,
    }, PREVIEW_SCALE);
  }, [
    input,
    sky,
    moonTick,
    compassTick,
    layoutTick,
    messageTick,
    chartScaleTick,
    input.theme,
    input.frame,
    input.compass,
    input.starChart,
    input.layout,
    input.elements,
    input.magnitude,
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
      </motion.div>
    </div>
  );
}

export { ARTWORK_W, ARTWORK_H };