"use client";

import * as React from "react";

/**
 * A lightweight, fully decorative starfield for the landing hero.
 * Procedurally generated so it stays tiny and never blocks on the network.
 */
export function NightSkyHero() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; r: number; b: number; tw: number }[] =
      [];

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / 1400);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        b: Math.random() * 0.7 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      // Deep gradient
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#070b18");
      g.addColorStop(0.6, "#0a0f22");
      g.addColorStop(1, "#02040a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Mist band (milky way hint)
      const milky = ctx.createLinearGradient(0, h * 0.2, w, h * 0.8);
      milky.addColorStop(0, "rgba(120,140,200,0)");
      milky.addColorStop(0.5, "rgba(160,180,230,0.08)");
      milky.addColorStop(1, "rgba(120,140,200,0)");
      ctx.fillStyle = milky;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const s of stars) {
        const tw = (Math.sin(t * 0.001 + s.tw) + 1) / 2;
        const alpha = s.b * (0.5 + tw * 0.5);
        ctx.fillStyle = `rgba(244,246,251,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    setup();
    raf = requestAnimationFrame(draw);

    const onResize = () => setup();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink" />
    </div>
  );
}