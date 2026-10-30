"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { artworkLayout, blendLayouts, renderScaffold, FORMATS, type ArtworkLayout } from "@gunari/core";
import {
  MARKER_HIT,
  clampViewKm,
  mapPrintScene,
  zoomScaleFor,
  projectLatLng,
  unprojectCanvas,
  type MapPrintSceneData,
  type ProjectedMapGeometry,
} from "@gunari/scene-mapprint";
import { MAP_PREVIEW_VIEWPORT, type MapPrintInput } from "@/hooks/useMapPrintState";
import { buildMapScaffoldInput, cardPalette, emptyGeometry } from "@/lib/render/map-scaffold";
import { diagonalClipPath, easeInOutCubic } from "@/lib/render/transitions";

const FALLBACK_W = 540;
const MAX_CARD_W = { story: 504, square: 540, landscape: 720 } as const;
const THEME_WIPE_MS = 800;
const CHANGE_FADE_MS = 400;
const REVEAL_MS = 1700;
const CHANGE_MS = 700;
const NUDGE_MS = 140;
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
  /** Called with the new slot diameter in km (buttons, scroll wheel, pinch). */
  onZoom?: (viewKm: number) => void;
}

const ZOOM_STEP = 1.45;

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

/** What the card is showing at one moment: layout, map rotation and zoom. */
interface View {
  layout: ArtworkLayout;
  rotation: number;
  viewKm: number;
}

function blendViews(a: View, b: View, t: number): View {
  if (t >= 1) return b;
  // Turn the short way round.
  const turn = ((((b.rotation - a.rotation + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return {
    layout: blendLayouts(a.layout, b.layout, t),
    rotation: a.rotation + turn * t,
    viewKm: Math.exp(Math.log(a.viewKm) + (Math.log(b.viewKm) - Math.log(a.viewKm)) * t),
  };
}

type Drag =
  | { kind: "pan"; id: number; x: number; y: number; pan: Pt }
  | { kind: "pin"; id: number; grabX: number; grabY: number };

interface Pinch {
  startDist: number;
  startKm: number;
}

export function LivePreview({
  input,
  data,
  geometry,
  loading,
  pan = NO_PAN,
  onPan,
  onPanEnd,
  onPinChange,
  onZoom,
}: LivePreviewProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const fadeRaf = React.useRef(0);
  const revealRaf = React.useRef(0);
  const revealRef = React.useRef(1);
  const dragRef = React.useRef<Drag | null>(null);
  const pointersRef = React.useRef(new Map<number, Pt>());
  const pinchRef = React.useRef<Pinch | null>(null);
  const viewKmRef = React.useRef(input.viewKm);
  viewKmRef.current = input.viewKm;
  const onZoomRef = React.useRef(onZoom);
  onZoomRef.current = onZoom;
  const prevRef = React.useRef<{ input: MapPrintInput; data: MapPrintSceneData | null } | null>(null);
  const target: View = {
    layout: artworkLayout(input.format, input.layout),
    rotation: input.rotation,
    viewKm: input.viewKm,
  };
  const shownRef = React.useRef<View>(target);
  const tweenRef = React.useRef<{ from: View; to: View; start: number; duration: number } | null>(null);
  const tweenRaf = React.useRef(0);
  const [pixelW, setPixelW] = React.useState(0);
  const format = FORMATS[input.format];
  const formatRef = React.useRef(input.format);
  formatRef.current = input.format;

  const skeleton = loading && !geometry;
  const sizeW = pixelW || FALLBACK_W;

  // Paints the current frame from the latest props. Kept in a ref so the
  // animations can repaint without re-running the effects below.
  const paintRef = React.useRef<() => void>(() => {});
  paintRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shown = shownRef.current;
    const L = shown.layout;
    const w = sizeW;
    const h = Math.round((w * L.h) / L.w);
    canvas.width = w;
    canvas.height = h;
    // The card follows the layout as it moves between shapes.
    if (cardRef.current) cardRef.current.style.aspectRatio = `${L.w} / ${L.h}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.scale(w / L.w, w / L.w);
    // Nothing drawn yet: still paint the theme, frame and title, with the map
    // held back so the loading ripples have somewhere to start.
    const showEmpty = !geometry || !data;
    const tweening = tweenRef.current !== null;
    // Mid-change, redo the projection for the in-between rotation, zoom and slot.
    const drawn =
      showEmpty
        ? emptyGeometry(input)
        : tweening
          ? mapPrintScene.project(
              data,
              { ...L.slot, zoomScale: zoomScaleFor(data.zoom, shown.viewKm) },
              shown.rotation,
            )
          : geometry;
    renderScaffold(
      ctx,
      buildMapScaffoldInput(input, drawn, pan, showEmpty ? 0 : revealRef.current, tweening ? L : undefined),
    );
  };

  // Layout, format, rotation and zoom glide to their new values instead of jumping.
  const { format: tFormat, layout: tLayout, rotation: tRotation, viewKm: tViewKm } = input;
  React.useEffect(() => {
    const to: View = {
      layout: artworkLayout(tFormat, tLayout),
      rotation: tRotation,
      viewKm: tViewKm,
    };
    const from = shownRef.current;
    const same =
      from.layout.w === to.layout.w &&
      from.layout.h === to.layout.h &&
      from.layout.slot.cx === to.layout.slot.cx &&
      from.layout.slot.cy === to.layout.slot.cy &&
      from.layout.title.y === to.layout.title.y &&
      from.rotation === to.rotation &&
      from.viewKm === to.viewKm;
    if (same) return;
    cancelAnimationFrame(tweenRaf.current);
    if (prefersReducedMotion() || !data) {
      tweenRef.current = null;
      shownRef.current = to;
      return;
    }
    const big =
      from.layout.w !== to.layout.w ||
      from.layout.h !== to.layout.h ||
      from.layout.title.y !== to.layout.title.y ||
      Math.abs(from.rotation - to.rotation) > 0.35 ||
      Math.abs(Math.log(from.viewKm / to.viewKm)) > 0.35;
    tweenRef.current = { from, to, start: performance.now(), duration: big ? CHANGE_MS : NUDGE_MS };
    const tick = (now: number) => {
      const tw = tweenRef.current;
      if (!tw) return;
      const t = Math.min(1, (now - tw.start) / tw.duration);
      shownRef.current = blendViews(tw.from, tw.to, easeInOutCubic(t));
      if (t >= 1) tweenRef.current = null;
      paintRef.current();
      if (t < 1) tweenRaf.current = requestAnimationFrame(tick);
    };
    tweenRaf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tFormat, tLayout, tRotation, tViewKm]);

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
      if (prev.input.style !== input.style || prev.input.card !== input.card) transition = "wipe";
      else if (
        dataChanged ||
        prev.input.shape !== input.shape ||
        prev.input.marker !== input.marker ||
        prev.input.labels !== input.labels ||
        prev.input.showCoordinates !== input.showCoordinates ||
        prev.input.places !== input.places
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
      cancelAnimationFrame(tweenRaf.current);
    },
    [],
  );

  // Scroll wheel / trackpad pinch zooms. A native listener so the page doesn't scroll too.
  const hasMap = Boolean(geometry);
  React.useEffect(() => {
    const el = cardRef.current;
    if (!el || !hasMap) return;
    const onWheel = (e: WheelEvent) => {
      const zoom = onZoomRef.current;
      if (!zoom) return;
      e.preventDefault();
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      zoom(clampViewKm(viewKmRef.current * Math.exp(e.deltaY * speed)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hasMap]);

  // The slot as the map is currently drawn: zoomed and panned.
  const drawnViewport = () => ({
    ...MAP_PREVIEW_VIEWPORT(input.layout, input.format),
    zoomScale: geometry?.zoomScale,
    panX: pan.x,
    panY: pan.y,
  });

  // Where the pin's tip is, in canvas-normalized coordinates.
  const pinTip = (): Pt | null => {
    if (!geometry) return null;
    const slot = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
    if (!input.pin) return { x: slot.cx, y: slot.cy };
    const [x, y] = projectLatLng(geometry.bbox, drawnViewport(), geometry.rotation, input.pin.lat, input.pin.lng);
    return { x, y };
  };

  const hitsPin = (e: React.PointerEvent<HTMLDivElement>): boolean => {
    const tip = pinTip();
    if (!tip) return false;
    const rect = e.currentTarget.getBoundingClientRect();
    const rCard = Math.min(format.w, format.h) * PIN_RADIUS * (rect.width / format.w);
    const tipPx = { x: tip.x * rect.width, y: tip.y * rect.height };
    const hit = MARKER_HIT[input.marker];
    const body = { x: tipPx.x, y: tipPx.y + hit.centerY * rCard };
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return distToSegment(pointer, body, tipPx) <= hit.radius * rCard + 8;
  };

  const canPan = Boolean(onPan && geometry);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && onZoom) {
      // A second finger turns the gesture into a pinch zoom.
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startKm: input.viewKm };
      dragRef.current = null;
      return;
    }
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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      onZoom?.(clampViewKm((pinch.startKm * pinch.startDist) / dist));
      return;
    }
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
    onPinChange?.(unprojectCanvas(geometry.bbox, drawnViewport(), geometry.rotation, [x, y]));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current && pointersRef.current.size < 2) pinchRef.current = null;
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d.kind === "pan") onPanEnd?.();
  };

  const slot = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
  const accent = cardPalette(input).accent;
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
        style={{ aspectRatio: `${format.w} / ${format.h}` }}
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

        {onZoom && geometry && (
          <div
            className="absolute right-3 top-3 flex flex-col gap-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ZoomButton label="Zoom in" onClick={() => onZoom(clampViewKm(input.viewKm / ZOOM_STEP))}>
              <Plus size={16} />
            </ZoomButton>
            <ZoomButton label="Zoom out" onClick={() => onZoom(clampViewKm(input.viewKm * ZOOM_STEP))}>
              <Minus size={16} />
            </ZoomButton>
          </div>
        )}

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

        {/* Fetching a new area while one is already showing: a bright sweep along the
            top edge plus a pill, so it reads on both light and dark cards. */}
        <AnimatePresence>
          {loading && geometry && (
            <motion.div
              key="updating"
              aria-hidden
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-x-0 top-0"
            >
              <div className="relative h-1 overflow-hidden bg-black/20">
                <span
                  className="animate-sweep absolute inset-y-0 w-1/2"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, #ffffff, ${accent}, transparent)`,
                    boxShadow: `0 0 12px ${accent}`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-ink/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-mist shadow-lg backdrop-blur-md">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                        style={{ background: "#ffffff", animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </span>
                  Updating map
                </span>
              </div>
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

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink/65 text-mist shadow-lg backdrop-blur-md transition-[transform,background-color] duration-150 hover:bg-ink/85 active:scale-90"
    >
      {children}
    </button>
  );
}
