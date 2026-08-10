// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useMapPrintState", () => ({
  useMapPrintState: () => ({
    input: {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      title: "T", message: undefined,
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    },
    update: vi.fn(),
    updateLocation: vi.fn(),
    randomize: vi.fn(),
    data: null,
    geometry: null,
    loading: false,
    error: null,
  }),
}));
vi.mock("@/lib/render/png-map", () => ({
  downloadMapPng: vi.fn(),
  shareMapPng: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("/map page", () => {
  it("renders Randomize, Save, and Share buttons", () => {
    render(<Page />);
    expect(screen.getByText(/Randomize/i)).toBeInTheDocument();
    expect(screen.getByText(/^Save$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Share/i)).toBeInTheDocument();
  });
});

// Import after mocks so the page consumes the mocked modules.
import Page from "./page";