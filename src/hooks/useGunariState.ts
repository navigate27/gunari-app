"use client";

import * as React from "react";
import { loadStarCatalog, FALLBACK_CATALOG } from "@/lib/astronomy/catalog";
import { computeSky } from "@/lib/astronomy/engine";
import type {
  CelestialContext,
  GunariInput,
  GunariLocation,
  StarRecord,
} from "@/lib/types";

const ROTATION_RAD = 0; // North-up by default.

const DEFAULT_INPUT: GunariInput = {
  date: new Date().toISOString().slice(0, 10),
  time: "21:00",
  location: {
    label: "Reykjavík, Iceland",
    lat: 64.1466,
    lng: -21.9426,
  },
  title: "The night we said yes",
  message: "And the sky held its breath with us.",
  theme: "midnight",
  frame: "classic",
  compass: "minimal",
  starChart: "astronomical",
};

export function useGunariState(initial?: Partial<GunariInput>) {
  const [input, setInput] = React.useState<GunariInput>({
    ...DEFAULT_INPUT,
    ...initial,
  });

  const [catalog, setCatalog] = React.useState<StarRecord[] | null>(null);
  const [catalogError, setCatalogError] = React.useState(false);

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

  const sky = React.useMemo(() => {
    const list = catalog ?? FALLBACK_CATALOG;
    const date = parseDateInput(input.date, input.time);
    if (!date) return null;
    const ctx: CelestialContext = {
      lat: input.location.lat,
      lng: input.location.lng,
      date,
      rotation: ROTATION_RAD,
    };
    return computeSky(ctx, list);
  }, [catalog, input.date, input.time, input.location.lat, input.location.lng]);

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