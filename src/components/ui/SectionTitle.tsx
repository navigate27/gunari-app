import type { ReactNode } from "react";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="text-[11px] uppercase tracking-[0.25em] text-mist">
        {children}
      </h3>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
