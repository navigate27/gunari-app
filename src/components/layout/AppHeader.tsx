import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AppHeader() {
  return (
    <header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 justify-self-start py-2 text-[11px] uppercase tracking-[0.25em] text-stone transition-colors hover:text-mist"
      >
        <ArrowLeft size={14} /> Back
      </Link>
      <span className="font-display text-xl tracking-[0.3em] text-mist">
        GUNARI
      </span>
      <span aria-hidden />
    </header>
  );
}
