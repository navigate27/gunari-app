"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { renderToCanvas, ARTWORK_W, ARTWORK_H } from "@/lib/render/png";
import type { GunariInput } from "@/lib/types";
import type { SkyState } from "@/lib/astronomy/engine";

interface LivePreviewProps {
  input: GunariInput;
  sky: SkyState | null;
  loading?: boolean;
}

export function LivePreview({ input, sky, loading }: LivePreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = React.useState(false);

  // Redraw whenever the input or sky changes. Debounced with rAF so rapid
  // edits (e.g. typing in the title) don't queue renders.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sky) return;

    let raf = 0;
    setRendering(true);
    const run = () => {
      raf = 0;
      renderToCanvas(canvas, {
        input,
        stars: sky.stars,
        moon: sky.moon,
      }).finally(() => setRendering(false));
    };
    raf = requestAnimationFrame(run);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    input,
    sky,
    input.theme,
    input.frame,
    input.compass,
    input.starChart,
    input.title,
    input.message,
    input.date,
    input.time,
    input.location.label,
    input.location.lat,
    input.location.lng,
  ]);

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-white/8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Gunari artwork preview"
        />
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-mist">
                Composing the sky…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* subtle render indicator */}
        {rendering && !loading && (
          <div className="absolute right-3 top-3 h-1.5 w-1.5 animate-pulse rounded-full bg-gold/80" />
        )}
      </motion.div>
    </div>
  );
}

export { ARTWORK_W, ARTWORK_H };