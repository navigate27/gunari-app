/**
 * Base theme palette — fields every Gunari scene shares. Scene-specific
 * palettes (e.g. MapThemePalette) extend this with their own fields.
 */
export interface ThemePalette {
  id: string;
  label: string;
  /** Canvas background gradient stops (top → bottom). */
  background: { top: string; bottom: string };
  /** Title text color. */
  title: string;
  /** Message text color (slightly muted). */
  message: string;
  /** Metadata text color (date / time / location). */
  meta: string;
  /** Accent used on wordmark + fine details. */
  accent: string;
  /** Whether the surface is light (affects stroke/symbol rendering). */
  light: boolean;
}