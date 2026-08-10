"use client";

import * as React from "react";
import { renderScaffold, ARTWORK_W, ARTWORK_H, type SceneRenderFn } from "@gunari/core";
import { mapPrintScene, getMapTheme, type MapPrintSceneData, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { MAP_PREVIEW_VIEWPORT } from "@/hooks/useMapPrintState";

const PREVIEW_W = 540;
const PREVIEW_H = 960;
const SCALE = PREVIEW_W / ARTWORK_W; // 0.5

export interface LivePreviewProps {
  input: MapPrintInput;
  data: MapPrintSceneData | null;
  geometry: ProjectedMapGeometry | null;
  loading: boolean;
}

export function LivePreview({ input, data, geometry, loading }: LivePreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.scale(SCALE, SCALE);
    if (!geometry || !data) {
      // Empty state: just background
      ctx.fillStyle = "#1a1b1f";
      ctx.fillRect(0, 0, ARTWORK_W, ARTWORK_H);
      return;
    }
    const palette = getMapTheme(input.style);
    renderScaffold(ctx, {
      layout: input.layout,
      title: input.title,
      message: input.message,
      meta: { date: "", time: "", location: input.location.label },
      palette,
      scene: { render: mapPrintScene.render as unknown as SceneRenderFn },
      sceneGeometry: geometry,
      scenePalette: palette,
      sceneInput: input,
      sceneViewport: MAP_PREVIEW_VIEWPORT(input.layout),
    });
  }, [input, data, geometry]);

  return (
    <div className="relative mx-auto max-w-[540px]">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-mist/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/40 backdrop-blur-sm">
          <span className="text-[11px] uppercase tracking-[0.25em] text-mist">Loading map…</span>
        </div>
      )}
    </div>
  );
}