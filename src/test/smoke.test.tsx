// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello({ name }: { name: string }) {
  return <div>Hello, {name}</div>;
}

describe("React testing infra smoke test", () => {
  it("renders a React component", () => {
    render(<Hello name="Gunari" />);
    expect(screen.getByText("Hello, Gunari")).toBeInTheDocument();
  });
});