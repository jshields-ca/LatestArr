import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows a heading and what to do next, with the stamp hidden from screen readers", async () => {
    const { container } = render(<EmptyState title="No newsletters yet" description="Add one to start sending on a schedule." />);
    expect(screen.getByRole("heading", { level: 2, name: "No newsletters yet" })).toBeInTheDocument();
    expect(screen.getByText("Add one to start sending on a schedule.")).toBeInTheDocument();
    // Decoration: nothing is announced for it, and it's the greyed drawing.
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg > g")).toHaveClass("fill-muted-foreground");
    expect(await axe(container)).toHaveNoViolations();
  });
});
