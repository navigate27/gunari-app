import type { ThemePalette } from "@gunari/core";

/**
 * The card is everything around the map: its background, the frame, and the
 * title, message and metadata text. It is chosen separately from the map
 * theme; "match" follows the map theme.
 */
export type CardStyleId =
  | "match"
  | "paper" | "ivory" | "sage" | "blush" | "sky"
  | "ink" | "navy" | "plum" | "forest";

export const CARD_ORDER: readonly CardStyleId[] = [
  "match", "paper", "ivory", "sage", "blush", "sky", "ink", "navy", "plum", "forest",
];

export const CARD_LABELS: Record<CardStyleId, string> = {
  match: "Match map",
  paper: "Paper",
  ivory: "Ivory",
  sage: "Sage",
  blush: "Blush",
  sky: "Sky",
  ink: "Ink",
  navy: "Navy",
  plum: "Plum",
  forest: "Forest",
};

export const CARD_STYLES: Record<Exclude<CardStyleId, "match">, ThemePalette> = {
  paper: {
    id: "paper", label: "Paper",
    background: { top: "#ffffff", bottom: "#f3f3f3" },
    title: "#17181c", message: "#44464f", meta: "#6e707b", accent: "#9a9aa6", light: true,
  },
  ivory: {
    id: "ivory", label: "Ivory",
    background: { top: "#faf7f0", bottom: "#f0eadc" },
    title: "#2a261d", message: "#4d4739", meta: "#7a7361", accent: "#a38f5c", light: true,
  },
  sage: {
    id: "sage", label: "Sage",
    background: { top: "#e9efe6", bottom: "#d8e2d4" },
    title: "#1f2c22", message: "#3d5043", meta: "#62786a", accent: "#6f8f78", light: true,
  },
  blush: {
    id: "blush", label: "Blush",
    background: { top: "#f8ebe8", bottom: "#efd8d4" },
    title: "#3a1f24", message: "#6a4046", meta: "#94696f", accent: "#c0777f", light: true,
  },
  sky: {
    id: "sky", label: "Sky",
    background: { top: "#e8f0f8", bottom: "#d5e3f1" },
    title: "#16263a", message: "#364d68", meta: "#5d7794", accent: "#5a8cc0", light: true,
  },
  ink: {
    id: "ink", label: "Ink",
    background: { top: "#101116", bottom: "#07080b" },
    title: "#f2f2f5", message: "#c7c8d0", meta: "#8b8d99", accent: "#c9a96a", light: false,
  },
  navy: {
    id: "navy", label: "Navy",
    background: { top: "#12244a", bottom: "#0a1429" },
    title: "#e6eeff", message: "#b3c4e6", meta: "#7e92bd", accent: "#e0a458", light: false,
  },
  plum: {
    id: "plum", label: "Plum",
    background: { top: "#2e1838", bottom: "#190c21" },
    title: "#f6e9fb", message: "#d7bfe3", meta: "#a98bb8", accent: "#e0a6d6", light: false,
  },
  forest: {
    id: "forest", label: "Forest",
    background: { top: "#16301f", bottom: "#0b1a12" },
    title: "#e8f4ea", message: "#bcd6c2", meta: "#84a88d", accent: "#d6c27a", light: false,
  },
};
