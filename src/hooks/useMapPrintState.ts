"use client";

import * as React from "react";
import type { SceneInput, SceneViewport } from "@gunari/core";
import { mapPrintScene, type MapPrintSceneData, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import { pickRandomPair } from "@/lib/content/pairs";

export type MapPrintInput = SceneInput & {
  title: string;
  message?: string;
};

export function MAP_PREVIEW_VIEWPORT(layout: SceneInput["layout"]): SceneViewport {
  return { cx: 0.5, cy: 0.5, r: layout === "poster" ? 0.42 : 0.4 };
}

const RANDOM_PAIR = pickRandomPair();

const DEFAULT_INPUT: MapPrintInput = {
  location: {
    lat: 14.5995,
    lng: 120.9842,
    label: "Manila, Metro Manila, Philippines",
  },
  title: RANDOM_PAIR.title,
  message: RANDOM_PAIR.message,
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
};

const DEBOUNCE_MS = 250;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useMapPrintState(initial?: Partial<MapPrintInput>) {
  const [input, setInput] = React.useState<MapPrintInput>({ ...DEFAULT_INPUT, ...initial });
  const [data, setData] = React.useState<MapPrintSceneData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | null>(null);
  const inputRef = React.useRef(input);
  inputRef.current = input;

  // Load on mount + whenever location or zoom changes (debounced).
  React.useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      mapPrintScene
        .load(inputRef.current, controller.signal)
        .then((d) => {
          if (!controller.signal.aborted) {
            setData(d);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.location.lat, input.location.lng, input.zoom]);

  // Geometry derived from data + rotation + layout (recomputed on each render).
  const geometry: ProjectedMapGeometry | null = React.useMemo(() => {
    if (!data) return null;
    const viewport = MAP_PREVIEW_VIEWPORT(input.layout);
    return mapPrintScene.project(data, viewport, input.rotation);
  }, [data, input.rotation, input.layout]);

  const update = React.useCallback(
    <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateLocation = React.useCallback(
    (location: Partial<MapPrintInput["location"]>) => {
      setInput((prev) => ({ ...prev, location: { ...prev.location, ...location } }));
    },
    [],
  );

  const randomize = React.useCallback(() => {
    setInput((prev) => {
      const themes: SceneInput["style"][] = ["classic", "midnight", "blueprint", "paper", "twilight"];
      const shapes: SceneInput["shape"][] = ["square", "circle", "heart"];
      const markers: SceneInput["marker"][] = ["solid", "ring", "heart", "star"];
      const zooms: SceneInput["zoom"][] = ["neighborhood", "district", "city"];
      const layouts: SceneInput["layout"][] = ["classic", "poster"];
      return {
        ...prev,
        style: pick(themes.filter((t) => t !== prev.style)),
        shape: pick(shapes.filter((s) => s !== prev.shape)),
        marker: pick(markers.filter((m) => m !== prev.marker)),
        zoom: pick(zooms.filter((z) => z !== prev.zoom)),
        rotation: Math.random() * Math.PI * 2,
        labels: !prev.labels,
        layout: pick(layouts.filter((l) => l !== prev.layout)),
      };
    });
  }, []);

  return {
    input,
    update,
    updateLocation,
    randomize,
    data,
    geometry,
    loading,
    error,
  };
}