"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PickerOption } from "./Picker";

interface MultiPickerProps<T extends string> {
  options: PickerOption<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  columns?: number;
  className?: string;
}

export function MultiPicker<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  className,
}: MultiPickerProps<T>) {
  const toggle = (v: T) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "relative h-14 rounded-md border px-3 text-left cursor-pointer transition-all duration-200",
              active
                ? "border-gold/70 bg-white/[0.06]"
                : "border-white/10 bg-white/[0.02] hover:border-white/25"
            )}
          >
            <div className="flex items-center gap-2 h-full">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                  active
                    ? "border-gold/70 bg-gold/20"
                    : "border-white/20 bg-transparent"
                )}
              >
                {active && (
                  <span className="h-2 w-2 rounded-full bg-gold" />
                )}
              </span>
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