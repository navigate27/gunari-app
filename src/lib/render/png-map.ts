"use client";

import { renderScaffold, ARTWORK_W, ARTWORK_H, type SceneRenderFn } from "@gunari/core";
import { mapPrintScene, getMapTheme, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { MAP_PREVIEW_VIEWPORT } from "@/hooks/useMapPrintState";
import { downloadBlob, shareBlob } from "./png";

export interface ExportMapPngInput {
  input: MapPrintInput;
  geometry: ProjectedMapGeometry;
}

export async function exportMapPng({ input, geometry }: ExportMapPngInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = ARTWORK_W;
  canvas.height = ARTWORK_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
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
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export async function downloadMapPng(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  filename: string,
): Promise<void> {
  const blob = await exportMapPng({ input, geometry });
  downloadBlob(blob, filename);
}

export async function shareMapPng(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  filename: string,
  title?: string,
  text?: string,
): Promise<boolean> {
  const blob = await exportMapPng({ input, geometry });
  return shareBlob(blob, filename, title, text);
}