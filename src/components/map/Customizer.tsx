"use client";

import * as React from "react";
import { LocationInput } from "@/components/create/LocationInput";
import { Input, Label } from "@/components/ui/Input";
import { MultiPicker } from "@/components/ui/MultiPicker";
import { Picker, type PickerOption } from "@/components/ui/Picker";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Switch } from "@/components/ui/Switch";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import {
  FORMATS,
  FORMAT_ORDER,
  FRAME_LABELS,
  FRAME_ORDER,
  type ArtworkFrameId,
  type FormatId,
  type PlaceCategory,
  type SceneInput,
} from "@gunari/core";
import type { CardStyleId } from "@gunari/scene-mapprint";
import {
  CARD_LABELS,
  CARD_ORDER,
  CARD_STYLES,
  getMapTheme,
  poiColors,
  sliderFromViewKm,
  viewKmFromSlider,
} from "@gunari/scene-mapprint";

const THEME_IDS: { value: SceneInput["style"]; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "midnight", label: "Midnight" },
  { value: "blueprint", label: "Blueprint" },
  { value: "paper", label: "Paper" },
  { value: "twilight", label: "Twilight" },
  { value: "atlas", label: "Atlas" },
  { value: "ink", label: "Ink" },
  { value: "mist", label: "Mist" },
  { value: "nocturne", label: "Nocturne" },
  { value: "lagoon", label: "Lagoon" },
  { value: "chalk", label: "Chalk" },
];
// Each swatch previews the style: background, main road colour, then water.
const THEMES: PickerOption<SceneInput["style"]>[] = THEME_IDS.map((t) => {
  const p = getMapTheme(t.value);
  return {
    ...t,
    swatch: `linear-gradient(135deg, ${p.background.top} 0 42%, ${p.road.primary.color} 42% 62%, ${p.water} 62% 100%)`,
  };
});
const SHAPES: { value: SceneInput["shape"]; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "heart", label: "Heart" },
];
const MARKERS: { value: SceneInput["marker"]; label: string }[] = [
  { value: "solid", label: "Pin" },
  { value: "ring", label: "Ring" },
  { value: "heart", label: "Heart" },
  { value: "star", label: "Star" },
  { value: "home", label: "Home" },
];
const PLACE_KINDS: { value: PlaceCategory; label: string }[] = [
  { value: "food", label: "Food & drink" },
  { value: "shops", label: "Shops" },
  { value: "landmarks", label: "Landmarks" },
  { value: "lodging", label: "Lodging" },
  { value: "community", label: "Community" },
];
const CARD_OPTIONS: PickerOption<CardStyleId>[] = CARD_ORDER.map((id) => {
  if (id === "match") return { value: id, label: CARD_LABELS[id] };
  const { background, accent } = CARD_STYLES[id];
  return {
    value: id,
    label: CARD_LABELS[id],
    swatch: `linear-gradient(135deg, ${background.top} 0 55%, ${accent} 55% 100%)`,
  };
});
const FRAME_OPTIONS: PickerOption<ArtworkFrameId>[] = FRAME_ORDER.map((id) => ({
  value: id,
  label: FRAME_LABELS[id],
  tone: id === "none" ? "off" : "default",
}));
const FORMAT_OPTIONS: { value: FormatId; label: string }[] = FORMAT_ORDER.map((id) => ({
  value: id,
  label: FORMATS[id].label,
}));
const LAYOUTS: { value: SceneInput["layout"]; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "poster", label: "Poster" },
];

export interface CustomizerProps {
  input: MapPrintInput;
  update: <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => void;
  updateLocation: (location: Partial<MapPrintInput["location"]>) => void;
}

export function Customizer({ input, update, updateLocation }: CustomizerProps) {
  // The dots on the map take the map theme's colours, so the options do too.
  const placeOptions = React.useMemo<PickerOption<PlaceCategory>[]>(() => {
    const colors = poiColors(getMapTheme(input.style));
    return PLACE_KINDS.map((k) => ({ ...k, swatch: colors[k.value] }));
  }, [input.style]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <LocationInput value={input.location} onChange={updateLocation} />
        <div>
          <TextField
            label="Address label"
            hint="shown under the map"
            value={input.addressLabel ?? input.location.label}
            maxLength={80}
            onChange={(v) => update("addressLabel", v)}
          />
          {input.addressLabel !== undefined && input.addressLabel !== input.location.label && (
            <button
              type="button"
              onClick={() => update("addressLabel", undefined)}
              className="mt-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] text-stone transition-colors hover:text-mist"
            >
              Use the place name
            </button>
          )}
        </div>
        <TextField
          label="Title"
          value={input.title}
          maxLength={48}
          onChange={(v) => update("title", v)}
        />
        <TextField
          label="Message"
          hint="optional"
          value={input.message ?? ""}
          maxLength={140}
          onChange={(v) => update("message", v)}
        />
      </section>

      <div className="h-px bg-line" />

      <section>
        <SectionTitle>Map theme</SectionTitle>
        <Picker
          label="Map theme"
          options={THEMES}
          value={input.style}
          onChange={(v) => update("style", v)}
          columns={2}
        />
      </section>
      <section>
        <SectionTitle>Frame</SectionTitle>
        <Picker
          label="Frame"
          options={FRAME_OPTIONS}
          value={input.frame}
          onChange={(v) => update("frame", v)}
          columns={3}
        />
      </section>
      <section>
        <SectionTitle>Card background</SectionTitle>
        <Picker
          label="Card background"
          options={CARD_OPTIONS}
          value={input.card}
          onChange={(v) => update("card", v)}
          columns={2}
        />
      </section>
      <section>
        <SectionTitle>Shape</SectionTitle>
        <Picker
          label="Shape"
          options={SHAPES}
          value={input.shape}
          onChange={(v) => update("shape", v)}
          columns={3}
        />
      </section>
      <section>
        <SectionTitle>Marker</SectionTitle>
        <Picker
          label="Marker"
          options={MARKERS}
          value={input.marker}
          onChange={(v) => update("marker", v)}
          columns={2}
        />
        {input.pin && (
          <button
            type="button"
            onClick={() => update("pin", undefined)}
            className="mt-3 cursor-pointer text-[11px] uppercase tracking-[0.2em] text-stone transition-colors hover:text-mist"
          >
            Move pin back to the centre
          </button>
        )}
      </section>
      <ZoomField value={input.viewKm} onChange={(v) => update("viewKm", v)} />
      <RotationField value={input.rotation} onChange={(v) => update("rotation", v)} />
      <section>
        <SectionTitle>Places</SectionTitle>
        <MultiPicker
          label="Places"
          options={placeOptions}
          value={[...(input.places ?? [])]}
          onChange={(v) => update("places", v)}
          columns={2}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-stone">
          {input.zoom === "city"
            ? "Zoom in a little to see shops, food and landmarks by name."
            : "Named shops, food, landmarks, hotels and schools, from OpenStreetMap."}
        </p>
      </section>
      <Switch label="Labels" value={input.labels} onChange={(v) => update("labels", v)} />
      <Switch
        label="Coordinates"
        value={input.showCoordinates}
        onChange={(v) => update("showCoordinates", v)}
      />
      <section>
        <SectionTitle>Layout</SectionTitle>
        <Picker
          label="Layout"
          options={LAYOUTS}
          value={input.layout}
          onChange={(v) => update("layout", v)}
          columns={2}
        />
      </section>
      <section>
        <SectionTitle>Format</SectionTitle>
        <Picker
          label="Format"
          options={FORMAT_OPTIONS}
          value={input.format}
          onChange={(v) => update("format", v)}
          columns={3}
        />
      </section>
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {hint && ` (${hint})`}
      </Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(1)} km`;
}

/** Continuous zoom, in step with the preview's buttons, scroll wheel and pinch. */
function ZoomField({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return (
    <section>
      <SectionTitle>Zoom</SectionTitle>
      <div className="flex items-center gap-3">
        <input
          aria-label="Zoom"
          type="range"
          min={0}
          max={1000}
          value={Math.round(sliderFromViewKm(value) * 1000)}
          onChange={(e) => onChange(viewKmFromSlider(parseInt(e.target.value, 10) / 1000))}
          className="flex-1"
        />
        <span className="w-16 text-right font-ui text-sm tabular-nums text-mist">
          {formatDistance(value)}
        </span>
      </div>
    </section>
  );
}

function RotationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const id = React.useId();
  const deg = Math.round((value * 180) / Math.PI) % 360;
  return (
    <section>
      <SectionTitle>Rotation</SectionTitle>
      <div className="flex items-center gap-3">
        <input
          id={id}
          aria-label="Rotation"
          type="range"
          min={0}
          max={359}
          value={deg}
          onChange={(e) => onChange((parseInt(e.target.value, 10) * Math.PI) / 180)}
          className="flex-1"
        />
        <span className="w-10 text-right font-ui text-sm tabular-nums text-mist">
          {deg}°
        </span>
      </div>
    </section>
  );
}
