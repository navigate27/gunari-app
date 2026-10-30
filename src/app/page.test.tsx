// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/landing/NightSkyHero", () => ({
  NightSkyHero: () => <div data-testid="sky" />,
}));

import LandingPage from "./page";

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

describe("landing page", () => {
  it("links the primary CTA straight to /create without nesting a button in the link", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("link", { name: "Create Your Gunari" });
    expect(cta).toHaveAttribute("href", "/create");
    expect(cta.querySelector("button")).toBeNull();
  });

  it("links to the map print from the hero", () => {
    render(<LandingPage />);
    expect(screen.getByRole("link", { name: /print a map/i })).toHaveAttribute("href", "/map");
  });

  it("offers every share action as a labelled button", () => {
    render(<LandingPage />);
    for (const label of [
      "Share Gunari",
      "Share on X",
      "Share on Facebook",
      "Share on Instagram",
      "Share on Reddit",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps visible copy free of em dashes and version stamps", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/v\d+\.\d+/);
  });
});
