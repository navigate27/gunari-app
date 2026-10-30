"use client";

import { motion } from "motion/react";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Picker, type PickerOption } from "@/components/ui/Picker";
import { MultiPicker } from "@/components/ui/MultiPicker";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { LocationInput } from "./LocationInput";
import { THEMES, THEME_ORDER } from "@/lib/render/themes";
import { FRAMES } from "@/lib/render/frames";
import { COMPASS_STYLES } from "@/lib/render/compass";
import { STAR_CHART_STYLES } from "@/lib/render/starChart";
import type {
  CompassStyleId,
  ElementId,
  FrameId,
  GunariInput,
  LayoutId,
  StarChartStyleId,
  ThemeId,
} from "@/lib/types";

interface CustomizerProps {
  input: GunariInput;
  update: <K extends keyof GunariInput>(key: K, value: GunariInput[K]) => void;
  updateLocation: (location: Partial<GunariInput["location"]>) => void;
}

const themeOptions: PickerOption<ThemeId>[] = THEME_ORDER.map((id) => {
  const t = THEMES[id];
  return {
    value: id,
    label: t.label,
    swatch: `linear-gradient(180deg, ${t.canvas.top}, ${t.canvas.bottom})`,
    tone: id === "blank" ? "off" : "default",
  } as PickerOption<ThemeId>;
});

const frameOptions: PickerOption<FrameId>[] = (
  Object.keys(FRAMES) as FrameId[]
).map((id) => ({
  value: id,
  label: FRAMES[id].label,
  tone: id === "blank" ? "off" : "default",
}));

const compassOptions: PickerOption<CompassStyleId>[] = (
  Object.keys(COMPASS_STYLES) as CompassStyleId[]
).map((id) => ({
  value: id,
  label: COMPASS_STYLES[id].label,
  tone: id === "blank" ? "off" : "default",
}));

const starChartOptions: PickerOption<StarChartStyleId>[] = (
  Object.keys(STAR_CHART_STYLES) as StarChartStyleId[]
).map((id) => ({
  value: id,
  label: STAR_CHART_STYLES[id].label,
}));

const layoutOptions: PickerOption<LayoutId>[] = [
  { value: "classic", label: "Classic" },
  { value: "poster", label: "Poster" },
];

const elementOptions: PickerOption<ElementId>[] = [
  { value: "moon", label: "Moon" },
  { value: "constellation", label: "Constellation" },
  { value: "milkyway", label: "Milky Way" },
  { value: "grid", label: "Grid" },
];

export function Customizer({ input, update, updateLocation }: CustomizerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-8"
    >
      {/* Core fields */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={input.date}
              max="2099-12-31"
              onChange={(e) => update("date", e.target.value)}
            />
          </div>
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={input.time}
              onChange={(e) => update("time", e.target.value)}
            />
          </div>
        </div>
        <LocationInput value={input.location} onChange={updateLocation} />
        <div>
          <Label>Title</Label>
          <Input
            value={input.title}
            maxLength={48}
            placeholder="The night we said yes"
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
        <div>
          <Label>Message (optional)</Label>
          <Textarea
            value={input.message ?? ""}
            maxLength={140}
            placeholder="And the sky held its breath with us."
            onChange={(e) => update("message", e.target.value)}
          />
        </div>
      </section>

      <div className="h-px bg-line" />

      {/* Theme */}
      <section>
        <SectionTitle>Theme</SectionTitle>
        <Picker
          label="Theme"
          options={themeOptions}
          value={input.theme}
          onChange={(v) => update("theme", v)}
          columns={2}
        />
      </section>

      {/* Frame */}
      <section>
        <SectionTitle>Frame</SectionTitle>
        <Picker
          label="Frame"
          options={frameOptions}
          value={input.frame}
          onChange={(v) => update("frame", v)}
          columns={2}
        />
      </section>

      {/* Compass */}
      <section>
        <SectionTitle>Compass</SectionTitle>
        <Picker
          label="Compass"
          options={compassOptions}
          value={input.compass}
          onChange={(v) => update("compass", v)}
          columns={3}
        />
      </section>

      {/* Star density (magnitude limit) */}
      <section>
        <SectionTitle>Star Density</SectionTitle>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3}
            max={7}
            step={0.1}
            value={input.magnitude}
            onChange={(e) => update("magnitude", parseFloat(e.target.value))}
            aria-label="Star density"
            className="flex-1"
          />
          <span className="w-10 text-right font-ui text-sm tabular-nums text-mist">
            {Math.round(10 + ((input.magnitude - 3) / 4) * 90)}%
          </span>
        </div>
      </section>

      {/* Star chart */}
      <section>
        <SectionTitle>Star Chart</SectionTitle>
        <Picker
          label="Star Chart"
          options={starChartOptions}
          value={input.starChart}
          onChange={(v) => update("starChart", v)}
          columns={2}
        />
      </section>

      {/* Layout */}
      <section>
        <SectionTitle>Layout</SectionTitle>
        <Picker
          label="Layout"
          options={layoutOptions}
          value={input.layout}
          onChange={(v) => update("layout", v)}
          columns={2}
        />
      </section>

      {/* Element overlays (multiselect) */}
      <section>
        <SectionTitle>Elements</SectionTitle>
        <MultiPicker
          label="Elements"
          options={elementOptions}
          value={input.elements}
          onChange={(v) => update("elements", v)}
          columns={2}
        />
      </section>
    </motion.div>
  );
}
