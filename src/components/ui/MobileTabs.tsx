"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

type TabId = "editor" | "preview";

const TABS: { id: TabId; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

const panelVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

interface MobileTabsProps {
  editor: React.ReactNode;
  preview: React.ReactNode;
  /** Fired once the Preview tab has finished sliding in, so the preview can start its own animations in view. */
  onPreviewShown?: () => void;
  /** Accessible name for the tab list. */
  label?: string;
}

/** Editor and Preview as two animated tabs, for screens too narrow to show them side by side. */
export function MobileTabs({ editor, preview, onPreviewShown, label = "View" }: MobileTabsProps) {
  const [tab, setTab] = React.useState<TabId>("editor");
  const [direction, setDirection] = React.useState(1);

  const select = (next: TabId) => {
    if (next === tab) return;
    setDirection(TABS.findIndex((t) => t.id === next) > TABS.findIndex((t) => t.id === tab) ? 1 : -1);
    setTab(next);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="sticky top-0 z-20 -mx-5 mb-6 flex border-b border-white/10 bg-ink/90 px-5 backdrop-blur-md sm:-mx-8 sm:px-8"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => select(t.id)}
            className={`relative flex-1 cursor-pointer py-5 text-xs uppercase tracking-[0.25em] transition-colors duration-200 ${
              tab === t.id ? "text-gold" : "text-stone hover:text-mist"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <motion.span
                layoutId="mobile-tab-indicator"
                className="absolute inset-x-0 -bottom-px h-px bg-gold"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          custom={direction}
          variants={panelVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeOut" }}
          onAnimationComplete={(def) => {
            if (def === "center" && tab === "preview") onPreviewShown?.();
          }}
        >
          {tab === "preview" ? preview : editor}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
