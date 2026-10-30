"use client";

import * as React from "react";
import { artworkLayout, type FormatId, type SceneInput, type SceneViewport } from "@gunari/core";
import { mapPrintScene, panLocation, type MapPrintSceneData, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import { pickRandomPair } from "@/lib/content/pairs";

export type MapPrintInput = SceneInput & {
  title: string;
  message?: string;
  showCoordinates: boolean;
  format: FormatId;
};

export function MAP_PREVIEW_VIEWPORT(
  layout: SceneInput["layout"],
  format: FormatId = "story",
): SceneViewport {
  return artworkLayout(format, layout).slot;
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
  showCoordinates: false,
  format: "story",
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

  const [pan, setPanState] = React.useState({ x: 0, y: 0 });
  const panRef = React.useRef(pan);

  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | null>(null);
  const inputRef = React.useRef(input);
  inputRef.current = input;

  // Load on mount + whenever location or zoom changes (debounced).
  React.useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Views already loaded this session show immediately, with no debounce
    // and no loading state.
    const cached = mapPrintScene.peek(inputRef.current);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      panRef.current = { x: 0, y: 0 };
      setPanState(panRef.current);
      return;
    }
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
            // The new data is centred on the dragged-to spot, so the
            // temporary drag offset is no longer needed.
            panRef.current = { x: 0, y: 0 };
            setPanState(panRef.current);
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
    const viewport = MAP_PREVIEW_VIEWPORT(input.layout, input.format);
    return mapPrintScene.project(data, viewport, input.rotation);
  }, [data, input.rotation, input.layout, input.format]);

  const update = React.useCallback(
    <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateLocation = React.useCallback(
    (location: Partial<MapPrintInput["location"]>) => {
      // A new place starts with the pin back at the centre.
      setInput((prev) => ({ ...prev, location: { ...prev.location, ...location }, pin: undefined }));
    },
    [],
  );

  const setPan = React.useCallback((next: { x: number; y: number }) => {
    panRef.current = next;
    setPanState(next);
  }, []);

  /** Turn the drag offset into a new map centre, which reloads the map data. */
  const commitPan = React.useCallback(() => {
    const { x, y } = panRef.current;
    if (x === 0 && y === 0) return;
    const cur = inputRef.current;
    const next = panLocation(
      cur.location,
      cur.zoom,
      MAP_PREVIEW_VIEWPORT(cur.layout, cur.format),
      cur.rotation,
      x,
      y,
    );
    setInput((prev) => ({ ...prev, location: { ...prev.location, ...next } }));
  }, []);

  const randomize = React.useCallback(() => {
    setInput((prev) => {
      const themes: SceneInput["style"][] = [
        "classic", "midnight", "blueprint", "paper", "twilight",
        "atlas", "ink", "mist", "nocturne", "lagoon", "chalk",
      ];
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
    pan,
    setPan,
    commitPan,
    data,
    geometry,
    loading,
    error,
  };
}