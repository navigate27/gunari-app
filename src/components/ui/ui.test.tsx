// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, buttonStyles } from "./Button";
import { IconButton } from "./IconButton";
import { Picker } from "./Picker";
import { MultiPicker } from "./MultiPicker";

afterEach(cleanup);

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("builds variant classes through buttonStyles for non-button elements", () => {
    const accent = buttonStyles({ variant: "accent", size: "lg", shape: "pill" });
    expect(accent).toContain("from-gold");
    expect(accent).toContain("rounded-full");
    expect(buttonStyles()).toContain("rounded-control");
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Share" onClick={onClick}>
        <span />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Picker", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("marks the selected option with aria-pressed inside a named group", () => {
    const onChange = vi.fn();
    render(<Picker label="Theme" options={options} value="a" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("MultiPicker", () => {
  it("toggles options and reports pressed state", () => {
    const onChange = vi.fn();
    render(
      <MultiPicker
        label="Elements"
        options={[
          { value: "moon", label: "Moon" },
          { value: "grid", label: "Grid" },
        ]}
        value={["moon"]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Moon" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(onChange).toHaveBeenCalledWith(["moon", "grid"]);
  });
});
