"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { renderScaffold, FORMATS } from "@gunari/core";
import {
  PIN_BODY,
  getMapTheme,
  projectLatLng,
  unprojectCanvas,
  type MapPrintSceneData,
  type ProjectedMapGeometry,
} from "@gunari/scene-mapprint";
import { MAP_PREVIEW_VIEWPORT, type MapPrintInput } from "@/hooks/useMapPrintState";
import { buildMapScaffoldInput, emptyGeometry } from "@/lib/render/map-scaffold";
import { diagonalClipPath, easeInOutCubic } from "@/lib/render/transitions";

const FALLBACK_W = 540;
const MAX_CARD_W = { story: 504, square: 540, landscape: 720 } as const;
const THEME_WIPE_MS = 800;
const CHANGE_FADE_MS = 400;
const REVEAL_MS = 1700;
const PIN_RADIUS = 0.04;

type Transition = "wipe" | "fade";
type Pt = { x: number; y: number };

export interface LivePreviewProps {
  input: MapPrintInput;
  data: MapPrintSceneData | null;
  geometry: ProjectedMapGeometry | null;
  loading: boolean;
  /** Drag offset of the map content, canvas-normalized. */
  pan?: Pt;
  onPan?: (pan: Pt) => void;
  onPanEnd?: () => void;
  /** Called while the pin is dragged to a new spot. */
  onPinChange?: (pin: { lat: number; lng: number }) => void;
}

const NO_PAN: Pt = { x: 0, y: 0 };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type Drag =
  | { kind: "pan"; id: number; x: number; y: number; pan: Pt }
  | { kind: "pin"; id: number; grabX: number; grabY: number };

export function LivePreview({
  input,
  data,
  geometry,
  loading,
  pan = NO_PAN,
  onPan,
  onPanEnd,
  onPinChange,
}: LivePreviewProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const fadeRaf = React.useRef(0);
  const revealRaf = React.useRef(0);
  const revealRef = React.useRef(1);
  const dragRef = React.useRef<Drag | null>(null);
  const prevRef = React.useRef<{ input: MapPrintInput; data: MapPrintSceneData | null } | null>(null);
  const [pixelW, setPixelW] = React.useState(0);
  const format = FORMATS[input.format];
  const formatRef = React.useRef(input.format);
  formatRef.current = input.format;

  const skeleton = loading && !geometry;
  const sizeW = pixelW || FALLBACK_W;

  // Paints the current frame from the latest props. Kept in a ref so the
  // reveal animation can repaint without re-running the effects below.
  const paintRef = React.useRef<() => void>(() => {});
  paintRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = sizeW;
    const h = Math.round((w * format.h) / format.w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.scale(w / format.w, w / format.w);
    // Nothing drawn yet: still paint the theme, frame and title, with the map
    // held back so the loading ripples have somewhere to start.
    const showEmpty = !geometry || !data;
    renderScaffold(
      ctx,
      buildMapScaffoldInput(
        input,
        showEmpty ? emptyGeometry(input) : geometry,
        pan,
        showEmpty ? 0 : revealRef.current,
      ),
    );
  };

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
    const reduced = prefersReducedMotion();

    const prev = prevRef.current;
    const dataChanged = !!prev && prev.data !== data;
    prevRef.current = { input, data };

    // Snapshot the frame being replaced before the canvas is repainted.
    let transition: Transition | null = null;
    if (prev && overlay && prev.input.format === input.format && canvas.width === sizeW && !reduced) {
      if (prev.input.style !== input.style) transition = "wipe";
      else if (
        dataChanged ||
        prev.input.shape !== input.shape ||
        prev.input.marker !== input.marker ||
        prev.input.layout !== input.layout ||
        prev.input.labels !== input.labels ||
        prev.input.showCoordinates !== input.showCoordinates
      ) {
        transition = "fade";
      }
    }

    if (transition && overlay) {
      cancelAnimationFrame(fadeRaf.current);
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
            fadeRaf.current = requestAnimationFrame(tick);
          } else {
            octx.clearRect(0, 0, overlay.width, overlay.height);
            overlay.style.opacity = "0";
          }
        };
        fadeRaf.current = requestAnimationFrame(tick);
      }
    }

    // New map data: draw it in, roads tracing out from the centre and the
    // pin dropping last.
    if (data && geometry && (dataChanged || (!prev && !skeleton)) && !reduced) {
      cancelAnimationFrame(revealRaf.current);
      revealRef.current = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / REVEAL_MS);
        revealRef.current = t;
        paintRef.current();
        if (t < 1) revealRaf.current = requestAnimationFrame(tick);
      };
      revealRaf.current = requestAnimationFrame(tick);
    } else if (!data || !geometry) {
      cancelAnimationFrame(revealRaf.current);
      revealRef.current = 1;
    }

    paintRef.current();
  }, [input, data, geometry, sizeW, format, pan, skeleton]);

  React.useEffect(
    () => () => {
      cancelAnimationFrame(fadeRaf.current);
      cancelAnimationFrame(revealRaf.current);
    },
    [],
  );

  // Where the pin's tip is, in canvas-normalized coordinates.
  const pinTip = (): Pt | null => {
    if (!geometry) return null;
    const slot = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
    if (!input.pin) return { x: slot.cx, y: slot.cy };
    const [x, y] = projectLatLng(
      geometry.bbox,
      { ...slot, panX: pan.x, panY: pan.y },
      geometry.rotation,
      input.pin.lat,
      input.pin.lng,
    );
    return { x, y };
  };

  const hitsPin = (e: React.PointerEvent<HTMLDivElement>): boolean => {
    const tip = pinTip();
    if (!tip) return false;
    const rect = e.currentTarget.getBoundingClientRect();
    const rCard = Math.min(format.w, format.h) * PIN_RADIUS * (rect.width / format.w);
    const tipPx = { x: tip.x * rect.width, y: tip.y * rect.height };
    const body = { x: tipPx.x, y: tipPx.y + PIN_BODY.centerY * rCard };
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return distToSegment(pointer, body, tipPx) <= PIN_BODY.radius * rCard + 8;
  };

  const canPan = Boolean(onPan && geometry);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    if (onPinChange && hitsPin(e)) {
      const tip = pinTip()!;
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        kind: "pin",
        id: e.pointerId,
        grabX: tip.x - (e.clientX - rect.left) / rect.width,
        grabY: tip.y - (e.clientY - rect.top) / rect.height,
      };
    } else if (canPan) {
      dragRef.current = { kind: "pan", id: e.pointerId, x: e.clientX, y: e.clientY, pan };
    } else {
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!d) {
      // Hover: show the pin is grabbable.
      if (onPinChange && geometry) e.currentTarget.style.cursor = hitsPin(e) ? "pointer" : "";
      return;
    }
    if (d.id !== e.pointerId) return;
    if (d.kind === "pan") {
      onPan?.({
        x: d.pan.x + (e.clientX - d.x) / rect.width,
        y: d.pan.y + (e.clientY - d.y) / rect.height,
      });
      return;
    }
    if (!geometry) return;
    const slot = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
    let x = (e.clientX - rect.left) / rect.width + d.grabX;
    let y = (e.clientY - rect.top) / rect.height + d.grabY;
    // Keep the pin on the map: clamp to the slot, in pixel space.
    const dx = (x - slot.cx) * format.w;
    const dy = (y - slot.cy) * format.h;
    const limit = slot.r * Math.min(format.w, format.h);
    const dist = Math.hypot(dx, dy);
    if (dist > limit) {
      x = slot.cx + (dx / dist) * (limit / format.w);
      y = slot.cy + (dy / dist) * (limit / format.h);
    }
    onPinChange?.(
      unprojectCanvas(geometry.bbox, { ...slot, panX: pan.x, panY: pan.y }, geometry.rotation, [x, y]),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d.kind === "pan") onPanEnd?.();
  };

  const slot = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
  const accent = getMapTheme(input.style).accent;
  const ringPct = ((slot.r * Math.min(format.w, format.h)) / format.w) * 200;

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

        {/* Nothing on the map yet: ripples spread from where the pin will land. */}
        <AnimatePresence>
          {skeleton && (
            <motion.div
              key="skeleton"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-0"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="animate-ripple absolute rounded-full border-2"
                  style={{
                    left: `${slot.cx * 100}%`,
                    top: `${slot.cy * 100}%`,
                    width: `${ringPct}%`,
                    aspectRatio: "1 / 1",
                    borderColor: accent,
                    background: `${accent}14`,
                    animationDelay: `${i * 0.7}s`,
                  }}
                />
              ))}
              <span
                className="animate-pulse-dot absolute h-2.5 w-2.5 rounded-full"
                style={{
                  left: `${slot.cx * 100}%`,
                  top: `${slot.cy * 100}%`,
                  background: accent,
                  transform: "translate(-50%, -50%)",
                }}
              />
              <span
                className="animate-shimmer-text absolute left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em]"
                style={{
                  top: `${(slot.cy + (slot.r * Math.min(format.w, format.h)) / format.h) * 100 + 4}%`,
                  color: accent,
                }}
              >
                Drawing the map
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fetching a new area while one is already showing. */}
        <AnimatePresence>
          {loading && geometry && (
            <motion.div
              key="sweep"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden"
            >
              <span
                className="animate-sweep absolute inset-y-0 w-1/3"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {canPan && (
        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-stone">
          Drag the map to move it{onPinChange ? ", or the pin to place it" : ""}
        </p>
      )}
    </div>
  );
}
