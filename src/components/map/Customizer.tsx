"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LocationInput } from "@/components/create/LocationInput";
import { Input, Label } from "@/components/ui/Input";
import { Picker, type PickerOption } from "@/components/ui/Picker";
import { SectionTitle } from "@/components/ui/SectionTitle";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { FORMATS, FORMAT_ORDER, type FormatId, type SceneInput } from "@gunari/core";
import { getMapTheme } from "@gunari/scene-mapprint";

const THEME_IDS: { value: SceneInput["style"]; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "midnight", label: "Midnight" },
  { value: "blueprint", label: "Blueprint" },
  { value: "paper", label: "Paper" },
  { value: "twilight", label: "Twilight" },
];
const THEMES: PickerOption<SceneInput["style"]>[] = THEME_IDS.map((t) => {
  const { background } = getMapTheme(t.value);
  return { ...t, swatch: `linear-gradient(180deg, ${background.top}, ${background.bottom})` };
});
const SHAPES: { value: SceneInput["shape"]; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "heart", label: "Heart" },
];
const MARKERS: { value: SceneInput["marker"]; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "ring", label: "Ring" },
  { value: "heart", label: "Heart" },
  { value: "star", label: "Star" },
];
const ZOOMS: { value: SceneInput["zoom"]; label: string }[] = [
  { value: "neighborhood", label: "Neighborhood" },
  { value: "district", label: "District" },
  { value: "city", label: "City" },
];
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
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <LocationInput value={input.location} onChange={updateLocation} />
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
        <SectionTitle>Theme</SectionTitle>
        <Picker
          label="Theme"
          options={THEMES}
          value={input.style}
          onChange={(v) => update("style", v)}
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
      </section>
      <section>
        <SectionTitle>Zoom</SectionTitle>
        <Picker
          label="Zoom"
          options={ZOOMS}
          value={input.zoom}
          onChange={(v) => update("zoom", v)}
          columns={3}
        />
      </section>
      <RotationField value={input.rotation} onChange={(v) => update("rotation", v)} />
      <SwitchRow label="Labels" value={input.labels} onChange={(v) => update("labels", v)} />
      <SwitchRow
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

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[0.25em] text-mist">{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200",
          value ? "bg-gold" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full transition-transform duration-200",
            value ? "translate-x-5 bg-ink" : "translate-x-0.5 bg-mist"
          )}
        />
      </button>
    </div>
  );
}
