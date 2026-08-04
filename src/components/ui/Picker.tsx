"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  /** Optional small swatch (hex or gradient string). */
  swatch?: string;
}

interface PickerProps<T extends string> {
  options: PickerOption<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
  className?: string;
}

export function Picker<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  className,
}: PickerProps<T>) {
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-14 rounded-2xl border px-3 text-left transition-all duration-200",
              active
                ? "border-gold/70 bg-white/[0.06]"
                : "border-white/10 bg-white/[0.02] hover:border-white/25"
            )}
          >
            <div className="flex items-center gap-2 h-full">
              {o.swatch && (
                <span
                  className="block h-6 w-6 rounded-full border border-white/15"
                  style={{ background: o.swatch }}
                />
              )}
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