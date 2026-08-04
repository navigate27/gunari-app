"use client";

import * as React from "react";
import { MapPin, Crosshair } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { GunariLocation } from "@/lib/types";

interface LocationInputProps {
  value: GunariLocation;
  onChange: (location: Partial<GunariLocation>) => void;
}

/**
 * Stubbed location input. PRD specifies Google Places + Geocoding, but the
 * MVP runs without API keys by accepting a manual label + lat/lng, or using
 * the browser geolocation as a convenience. When NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
 * is set, this component is the natural place to wire Autocomplete.
 */
export function LocationInput({ value, onChange }: LocationInputProps) {
  const [busy, setBusy] = React.useState(false);

  const useGeolocation = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange({
          lat: +latitude.toFixed(4),
          lng: +longitude.toFixed(4),
          label: value.label || `Lat ${latitude.toFixed(2)}, Lng ${longitude.toFixed(2)}`,
        });
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2">
      <Label>Location</Label>
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-stone"
        />
        <Input
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Paris, France"
          className="pl-11"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="0.0001"
          value={value.lat}
          onChange={(e) => onChange({ lat: Number(e.target.value) })}
          placeholder="Latitude"
          aria-label="Latitude"
        />
        <Input
          type="number"
          step="0.0001"
          value={value.lng}
          onChange={(e) => onChange({ lng: Number(e.target.value) })}
          placeholder="Longitude"
          aria-label="Longitude"
        />
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