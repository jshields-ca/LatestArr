import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { CardsSkeleton, LinesSkeleton, ListSkeleton, TableSkeleton } from "./skeleton";

describe("loading placeholders", () => {
  it("say what's loading to a screen reader and hide the bars from it", async () => {
    const { container } = render(<ListSkeleton label="Loading newsletters..." rows={4} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading newsletters...");
    // One card per row; nothing in them is announced.
    const bars = status.querySelector("[aria-hidden=true]")!;
    expect(bars.children).toHaveLength(4);
    expect(status.querySelectorAll("span.block").length).toBeGreaterThan(0);
    for (const bar of status.querySelectorAll("span.block")) expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("wait a moment before showing, and hold still under reduced motion", () => {
    render(<LinesSkeleton label="Loading send history..." />);
    // The delay and fade are `placeholder-in` in index.css; the pulse is
    // only for people who haven't asked for less motion.
    expect(screen.getByRole("status")).toHaveClass("placeholder-in");
    expect(screen.getByRole("status").querySelector("span.block")).toHaveClass("motion-safe:animate-pulse");
  });

  it("come in the shape of a table and of settings cards, without accessibility violations", async () => {
    const { container } = render(
      <>
        <TableSkeleton label="Loading recipients..." rows={3} />
        <CardsSkeleton label="Loading backups..." cards={[2, 3]} />
      </>,
    );
    expect(screen.getAllByRole("status").map((status) => status.textContent)).toEqual([
      "Loading recipients...",
      "Loading backups...",
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
