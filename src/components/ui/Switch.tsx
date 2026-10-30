"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** A labelled on/off row. The whole row is the hit target, not just the track. */
export function Switch({ label, value, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between"
    >
      <span className="text-[11px] uppercase tracking-[0.25em] text-mist">{label}</span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          value ? "bg-gold" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-sm transition-[transform,background-color] duration-200 ease-out",
            value ? "translate-x-5 bg-ink" : "translate-x-0 bg-mist"
          )}
        />
      </span>
    </button>
  );
}
