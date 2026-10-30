// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Customizer } from "./Customizer";
import type { MapPrintInput } from "@/hooks/useMapPrintState";

afterEach(() => {
  cleanup();
});

const baseInput: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: "Msg",
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
  showCoordinates: false,
  format: "story",
  viewKm: 1.4142,
  card: "match",
};

describe("Customizer", () => {
  it("renders all 10 controls", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    // Location (label-based), Title, Message, Theme, Shape, Marker, Zoom, Rotation, Labels, Layout
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /shape/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /marker/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /zoom/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /rotation/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /labels/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /layout/i })).toBeInTheDocument();
  });

  it("calls update when shape changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.click(screen.getByRole("button", { name: /circle/i }));
    expect(update).toHaveBeenCalledWith("shape", "circle");
  });

  it("calls update when title changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New Title" } });
    expect(update).toHaveBeenCalledWith("title", "New Title");
  });

  it("toggles the coordinates line", () => {
    const update = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={vi.fn()} />);
    fireEvent.click(screen.getByRole("switch", { name: /coordinates/i }));
    expect(update).toHaveBeenCalledWith("showCoordinates", true);
  });

  it("keeps the card background separate from the map theme", () => {
    const update = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={vi.fn()} />);
    expect(screen.getByRole("group", { name: /map theme/i })).toBeInTheDocument();
    const card = screen.getByRole("group", { name: /card background/i });
    expect(card).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /navy/i }));
    expect(update).toHaveBeenCalledWith("card", "navy");
    expect(update).not.toHaveBeenCalledWith("style", expect.anything());
  });

  it("zooms continuously and shows the view size", () => {
    const update = vi.fn();
    render(<Customizer input={{ ...baseInput, viewKm: 1.4 }} update={update} updateLocation={vi.fn()} />);
    expect(screen.getByText("1.4 km")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: /zoom/i }), { target: { value: "1000" } });
    const km = update.mock.calls.find((c) => c[0] === "viewKm")![1] as number;
    expect(km).toBeCloseTo(0.25, 2);
  });

  it("lets you choose which kinds of places to show", () => {
    const update = vi.fn();
    render(<Customizer input={{ ...baseInput, places: ["food"] }} update={update} updateLocation={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Places" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /food & drink/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /landmarks/i }));
    expect(update).toHaveBeenCalledWith("places", ["food", "landmarks"]);
  });

  it("offers distinct pin shapes, not just inner symbols", () => {
    render(<Customizer input={baseInput} update={vi.fn()} updateLocation={vi.fn()} />);
    const marker = screen.getByRole("group", { name: /marker/i });
    for (const label of ["Pin", "Ring", "Heart", "Star", "Home"]) {
      expect(marker).toHaveTextContent(label);
    }
  });

  it("colours the place options to match the map theme", () => {
    const swatch = (style: "classic" | "nocturne") => {
      const { container, unmount } = render(
        <Customizer input={{ ...baseInput, style }} update={vi.fn()} updateLocation={vi.fn()} />,
      );
      const food = [...container.querySelectorAll('[aria-label="Places"] button')].find((b) =>
        /food/i.test(b.textContent ?? ""),
      )!;
      const color = (food.querySelector("div > span") as HTMLElement).style.borderColor;
      unmount();
      return color;
    };
    expect(swatch("classic")).not.toBe(swatch("nocturne"));
  });
});
