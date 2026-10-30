// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useGunariState", () => ({
  useGunariState: () => ({
    input: {},
    update: vi.fn(),
    updateLocation: vi.fn(),
    randomize: vi.fn(),
    sky: null,
    catalogLoading: false,
  }),
}));
vi.mock("@/components/create/Customizer", () => ({
  Customizer: () => <div>customizer-stub</div>,
}));
vi.mock("@/components/create/LivePreview", () => ({
  LivePreview: () => <div>preview-stub</div>,
}));
vi.mock("@/lib/render/png", () => ({
  exportToPng: vi.fn(),
  shareBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("/create page mobile tabs", () => {
  it("shows the editor first and switches to the preview tab", async () => {
    render(<Page />);
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("customizer-stub")).toBeInTheDocument();
    expect(screen.queryByText("preview-stub")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    await waitFor(() =>
      expect(screen.getByText("preview-stub")).toBeInTheDocument()
    );
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByText("customizer-stub")).not.toBeInTheDocument();
  });
});

// Import after mocks so the page consumes the mocked modules.
import Page from "./page";
