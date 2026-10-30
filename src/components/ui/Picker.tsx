"use client";

import * as React from "react";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  /** Optional small swatch (hex or gradient string). */
  swatch?: string;
  /** "off" tones render with a dashed border + ban icon — for Blank / None / Hidden options. */
  tone?: "default" | "off";
}

interface PickerProps<T extends string> {
  options: PickerOption<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
  className?: string;
  /** Accessible name for the group. */
  label?: string;
}

export function Picker<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  className,
  label,
}: PickerProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const off = o.tone === "off";
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-14 rounded-control border px-3 text-left cursor-pointer transition-[border-color,background-color] duration-200",
              active
                ? "border-gold/70 bg-surface-raised"
                : off
                ? "border-dashed border-line bg-surface hover:border-line-strong"
                : "border-line bg-surface hover:border-line-strong"
            )}
          >
            <div className="flex items-center gap-2 h-full">
              {off ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-strong text-stone">
                  <Ban size={13} />
                </span>
              ) : o.swatch ? (
                <span
                  className="block h-6 w-6 rounded-full border border-line"
                  style={{ background: o.swatch }}
                />
              ) : null}
              <span
                className={cn(
                  "font-ui text-xs tracking-wide uppercase truncate",
                  active ? "text-mist" : "text-stone"
                )}
              >
                {o.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}