"use client";

import * as React from "react";
import { loadStarCatalog, FALLBACK_CATALOG } from "@/lib/astronomy/catalog";
import { computeSky, localSiderealTime, type SkyState } from "@/lib/astronomy/engine";
import type {
  CelestialContext,
  GunariInput,
  GunariLocation,
  StarRecord,
} from "@/lib/types";

const ROTATION_RAD = 0;
const ANIM_DURATION_MS = 900;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Shortest-path delta in hours, in [-12, 12]. */
function shortestDelta(a: number, b: number): number {
  let d = ((b - a + 12) % 24 + 24) % 24 - 12;
  return d;
}

const DEFAULT_INPUT: GunariInput = {
  date: new Date().toISOString().slice(0, 10),
  time: "21:00",
  location: {
    label: "Manila, Philippines",
    lat: 14.5995,
    lng: 120.9842,
  },
  title: "The night we said yes",
  message: "And the sky held its breath with us.",
  theme: "midnight",
  frame: "classic",
  compass: "minimal",
  starChart: "astronomical",
  moon: true,
};

interface AnimState {
  startTime: number;
  fromLat: number;
  toLat: number;
  fromLst: number;
  toLst: number;
  date: Date;
  lng: number;
}

export function useGunariState(initial?: Partial<GunariInput>) {
  const [input, setInput] = React.useState<GunariInput>({
    ...DEFAULT_INPUT,
    ...initial,
  });

  const [catalog, setCatalog] = React.useState<StarRecord[] | null>(null);
  const [catalogError, setCatalogError] = React.useState(false);
  const [sky, setSky] = React.useState<SkyState | null>(null);

  React.useEffect(() => {
    let mounted = true;
    loadStarCatalog()
      .then((data) => {
        if (mounted) setCatalog(data.stars);
      })
      .catch(() => {
        if (mounted) {
          setCatalog(FALLBACK_CATALOG);
          setCatalogError(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Track the currently-displayed celestial context (animated).
  const displayedRef = React.useRef<{
    lat: number;
    lst: number;
    date: Date;
    lng: number;
  } | null>(null);

  const animRef = React.useRef<AnimState | null>(null);
  const rafRef = React.useRef<number>(0);

  // Recompute sky from a given context.
  const recompute = React.useCallback(
    (lat: number, lst: number, date: Date, lng: number) => {
      const list = catalog ?? FALLBACK_CATALOG;
      const ctx: CelestialContext = {
        lat,
        lng,
        date,
        rotation: ROTATION_RAD,
        lstOverride: lst,
      };
      setSky(computeSky(ctx, list));
    },
    [catalog]
  );

  // Initial computation when catalog lands or input first valid.
  React.useEffect(() => {
    const date = parseDateInput(input.date, input.time);
    if (!date) return;
    const lst = localSiderealTime(date, input.location.lng);
    if (!displayedRef.current) {
      displayedRef.current = {
        lat: input.location.lat,
        lst,
        date,
        lng: input.location.lng,
      };
      recompute(input.location.lat, lst, date, input.location.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  // Kick off an animation whenever date / time / location changes.
  const dateKey = `${input.date}|${input.time}|${input.location.lat.toFixed(
    4
  )}|${input.location.lng.toFixed(4)}`;

  React.useEffect(() => {
    const date = parseDateInput(input.date, input.time);
    if (!date) return;
    const targetLst = localSiderealTime(date, input.location.lng);
    const targetLat = input.location.lat;

    const cur = displayedRef.current ?? {
      lat: targetLat,
      lst: targetLst,
      date,
      lng: input.location.lng,
    };

    // No-op if nothing relevant changed.
    if (
      cur.lat === targetLat &&
      Math.abs(shortestDelta(cur.lst, targetLst)) < 1e-6 &&
      cur.lng === input.location.lng
    ) {
      return;
    }

    animRef.current = {
      startTime: performance.now(),
      fromLat: cur.lat,
      toLat: targetLat,
      fromLst: cur.lst,
      toLst: targetLst,
      date,
      lng: input.location.lng,
    };

    const tick = (now: number) => {
      const a = animRef.current;
      if (!a) return;
      const t = Math.min(1, (now - a.startTime) / ANIM_DURATION_MS);
      const e = easeInOutCubic(t);
      const lat = a.fromLat + (a.toLat - a.fromLat) * e;
      const dLst = shortestDelta(a.fromLst, a.toLst);
      const lst = (a.fromLst + dLst * e + 24) % 24;
      displayedRef.current = { lat, lst, date: a.date, lng: a.lng };
      recompute(lat, lst, a.date, a.lng);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, catalog]);

  const update = React.useCallback(
    <K extends keyof GunariInput>(key: K, value: GunariInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateLocation = React.useCallback(
    (location: Partial<GunariLocation>) => {
      setInput((prev) => ({
        ...prev,
        location: { ...prev.location, ...location },
      }));
    },
    []
  );

  return {
    input,
    update,
    updateLocation,
    sky,
    catalogLoading: catalog === null,
    catalogError,
  };
}

function parseDateInput(date: string, time: string): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (time || "21:00").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh || 21, mm || 0));
}