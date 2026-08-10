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
    expect(screen.getByRole("group", { name: /zoom/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /rotation/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /labels/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /layout/i })).toBeInTheDocument();
  });

  it("calls update when shape changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.click(screen.getByRole("radio", { name: /circle/i }));
    expect(update).toHaveBeenCalledWith("shape", "circle");
  });

  it("calls update when title changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New Title" } });
    expect(update).toHaveBeenCalledWith("title", "New Title");
  });
});