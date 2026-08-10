"use client";

import * as React from "react";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { SceneInput } from "@gunari/core";
import { searchPlaces, type PlaceResult } from "@/lib/location/photon";

const THEMES: { id: SceneInput["style"]; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "midnight", label: "Midnight" },
  { id: "blueprint", label: "Blueprint" },
  { id: "paper", label: "Paper" },
  { id: "twilight", label: "Twilight" },
];
const SHAPES: { id: SceneInput["shape"]; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "heart", label: "Heart" },
];
const MARKERS: { id: SceneInput["marker"]; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "ring", label: "Ring" },
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
];
const ZOOMS: { id: SceneInput["zoom"]; label: string }[] = [
  { id: "neighborhood", label: "Neighborhood" },
  { id: "district", label: "District" },
  { id: "city", label: "City" },
];
const LAYOUTS: { id: SceneInput["layout"]; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "poster", label: "Poster" },
];

export interface CustomizerProps {
  input: MapPrintInput;
  update: <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => void;
  updateLocation: (location: Partial<MapPrintInput["location"]>) => void;
}

export function Customizer({ input, update, updateLocation }: CustomizerProps) {
  return (
    <div className="space-y-6">
      <LocationField value={input.location} onChange={updateLocation} />
      <TextField
        label="Title"
        value={input.title}
        onChange={(v) => update("title", v)}
      />
      <TextField
        label="Message"
        value={input.message ?? ""}
        onChange={(v) => update("message", v)}
        optional
      />
      <RadioGroup
        label="Theme"
        options={THEMES}
        value={input.style}
        onChange={(v) => update("style", v)}
      />
      <RadioGroup
        label="Shape"
        options={SHAPES}
        value={input.shape}
        onChange={(v) => update("shape", v)}
      />
      <RadioGroup
        label="Marker"
        options={MARKERS}
        value={input.marker}
        onChange={(v) => update("marker", v)}
      />
      <RadioGroup
        label="Zoom"
        options={ZOOMS}
        value={input.zoom}
        onChange={(v) => update("zoom", v)}
      />
      <RotationField value={input.rotation} onChange={(v) => update("rotation", v)} />
      <LabelsToggle value={input.labels} onChange={(v) => update("labels", v)} />
      <RadioGroup
        label="Layout"
        options={LAYOUTS}
        value={input.layout}
        onChange={(v) => update("layout", v)}
      />
    </div>
  );
}

function LocationField({
  value,
  onChange,
}: {
  value: MapPrintInput["location"];
  onChange: (location: Partial<MapPrintInput["location"]>) => void;
}) {
  const [query, setQuery] = React.useState(value.label);
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setQuery(value.label);
  }, [value.label]);

  const onType = (text: string) => {
    setQuery(text);
    if (text.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    searchPlaces(text, controller.signal)
      .then((r) => {
        setResults(r);
        setOpen(r.length > 0);
      })
      .catch(() => {});
  };

  const onPick = (r: PlaceResult) => {
    onChange({ lat: r.lat, lng: r.lng, label: r.label });
    setQuery(r.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        Location
      </label>
      <input
        aria-label="Location"
        type="text"
        value={query}
        onChange={(e) => onType(e.target.value)}
        className="w-full rounded-md border border-mist/20 bg-ink px-3 py-2 text-sm text-mist focus:border-gold focus:outline-none"
        placeholder="Search a place..."
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-mist/20 bg-ink shadow-lg">
          {results.slice(0, 6).map((r, i) => (
            <li key={`${r.label}-${i}`}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="block w-full px-3 py-2 text-left text-sm text-mist hover:bg-mist/5"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        {label}{optional && " (optional)"}
      </label>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-mist/20 bg-ink px-3 py-2 text-sm text-mist focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] uppercase tracking-[0.25em] text-stone">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={
              "cursor-pointer rounded-md border px-3 py-1.5 text-xs " +
              (value === opt.id
                ? "border-gold bg-gold/10 text-gold"
                : "border-mist/20 text-stone hover:border-mist/40")
            }
          >
            <input
              type="radio"
              name={label}
              value={opt.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RotationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const deg = Math.round((value * 180) / Math.PI) % 360;
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        Rotation ({deg}°)
      </label>
      <input
        aria-label="Rotation"
        role="slider"
        type="range"
        min={0}
        max={359}
        value={deg}
        onChange={(e) => onChange((parseInt(e.target.value, 10) * Math.PI) / 180)}
        className="w-full"
      />
    </div>
  );
}

function LabelsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[0.25em] text-stone">Labels</span>
      <button
        type="button"
        role="switch"
        aria-label="Labels"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={
          "relative h-6 w-11 rounded-full transition-colors " +
          (value ? "bg-gold" : "bg-mist/20")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-transform " +
            (value ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}