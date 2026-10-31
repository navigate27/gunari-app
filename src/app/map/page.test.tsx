// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/hooks/useMapPrintState", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useMapPrintState")>()),
  useMapPrintState: () => ({
    input: {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      title: "T", message: undefined,
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
      showCoordinates: false, format: "story", viewKm: 1.4142, card: "match", frame: "line",
    },
    update: vi.fn(),
    updateLocation: vi.fn(),
    randomize: vi.fn(),
    pan: { x: 0, y: 0 },
    setPan: vi.fn(),
    commitPan: vi.fn(),
    data: null,
    geometry: null,
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/lib/render/png-map", () => ({
  downloadMapPng: vi.fn(),
  shareMapPng: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

function setDesktop(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe("/map page", () => {
  afterEach(cleanup);

  it("renders Randomize, Save, and Share buttons", () => {
    render(<Page />);
    expect(screen.getByText(/Randomize/i)).toBeInTheDocument();
    expect(screen.getByText(/^Save$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Share/i)).toBeInTheDocument();
  });

  it("credits OpenStreetMap contributors", () => {
    render(<Page />);
    expect(
      screen.getByRole("link", { name: /OpenStreetMap contributors/i }),
    ).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });

  it("offers the same social share buttons as the Star Chart", () => {
    render(<Page />);
    for (const name of ["Share", "Facebook", "Instagram", "X", "Reddit"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("on a phone, shows the editor first and the preview in a second tab", async () => {
    setDesktop(false);
    render(<Page />);
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Share/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Map print preview")).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(await screen.findByLabelText("Map print preview")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
    vi.unstubAllGlobals();
  });

  it("on a wide screen, shows the preview and the editor together with no tabs", () => {
    setDesktop(true);
    render(<Page />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByLabelText("Map print preview")).toBeInTheDocument();
    expect(screen.getByLabelText(/Share/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});


// Import after mocks so the page consumes the mocked modules.
import Page from "./page";
