"use client";

import * as React from "react";
import { MapPin, Crosshair, Search, Loader2, X } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { searchPlaces, reverseGeocode, type PlaceResult } from "@/lib/location/photon";
import type { GunariLocation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocationInputProps {
  value: GunariLocation;
  onChange: (location: Partial<GunariLocation>) => void;
}

export function LocationInput({ value, onChange }: LocationInputProps) {
  const [query, setQuery] = React.useState(value.label);
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  // True once the user has typed in the field. Suppresses the initial
  // programmatic query sync (from value.label) from triggering a search
  // and opening the dropdown on mount.
  const userTouchedRef = React.useRef(false);

  // Keep input in sync if value.label changes from elsewhere (e.g. geolocation).
  React.useEffect(() => {
    userTouchedRef.current = false;
    setQuery(value.label);
    setResults([]);
    setOpen(false);
  }, [value.label]);

  // Debounced search — only after the user actually types.
  React.useEffect(() => {
    if (!userTouchedRef.current) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(q, ctrl.signal, 6);
        setResults(r);
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pick = (r: PlaceResult) => {
    onChange({ label: r.label, lat: +r.lat.toFixed(4), lng: +r.lng.toFixed(4) });
    setQuery(r.label);
    setOpen(false);
    setResults([]);
  };

  const useGeolocation = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const lat = +latitude.toFixed(4);
        const lng = +longitude.toFixed(4);
        // Try to resolve a human-readable label via Photon reverse geocode.
        // Falls back to a coordinate string if the network call fails.
        let label = `Lat ${latitude.toFixed(2)}, Lng ${longitude.toFixed(2)}`;
        try {
          const ctrl = new AbortController();
          const place = await reverseGeocode(lat, lng, ctrl.signal);
          if (place) label = place;
        } catch {
          // keep coordinate fallback
        }
        onChange({ lat, lng, label });
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (highlight >= 0) {
        e.preventDefault();
        pick(results[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Location</Label>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-stone"
        />
        <Input
          value={query}
          onChange={(e) => {
            userTouchedRef.current = true;
            setQuery(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder="Search a place — city, address, landmark"
          className="pl-11 pr-10"
          autoComplete="off"
          spellCheck={false}
        />
        {loading ? (
          <Loader2
            size={14}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone animate-spin"
          />
        ) : query ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-mist"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        ) : null}

        {open && results.length > 0 && (
          <ul
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-soft/95 backdrop-blur shadow-xl"
            role="listbox"
          >
            {results.map((r, i) => (
              <li
                key={`${r.label}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors",
                  i === highlight ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                )}
              >
                <MapPin
                  size={14}
                  className="mt-0.5 shrink-0 text-gold/80"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-mist">{r.label}</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.2em] text-stone mt-0.5">
                    {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={useGeolocation}
        disabled={busy}
        className="px-2"
      >
        <Crosshair size={14} />
        {busy ? "Locating…" : "Use my location"}
      </Button>
    </div>
  );
}