import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LOGO_COLOURS, LOGO_PERFORATIONS } from "./logo-geometry";
import { LogoMark } from "./logo";

describe("LogoMark", () => {
  it("is labelled, and two on one page don't share mask IDs", () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark size={64} />
      </>,
    );
    expect(screen.getAllByRole("img", { name: "LatestArr" })).toHaveLength(2);
    const maskIds = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(new Set(maskIds).size).toBe(maskIds.length);
    // Every mask reference points at a mask in the same logo.
    for (const svg of container.querySelectorAll("svg")) {
      const own = new Set([...svg.querySelectorAll("mask")].map((mask) => `url(#${mask.id})`));
      for (const user of svg.querySelectorAll("[mask]")) expect(own.has(user.getAttribute("mask")!)).toBe(true);
    }
  });

  it("follows the theme by default: the rose stamp in light, the paper stamp in dark", () => {
    const { container } = render(<LogoMark />);
    const [light, dark] = [...container.querySelectorAll("svg > g")];
    expect(light).toHaveClass("dark:hidden");
    expect(light.querySelector("path")).toHaveAttribute("fill", LOGO_COLOURS.rose.ink);
    expect(dark).toHaveClass("hidden", "dark:block");
    expect(dark.querySelector("path")).toHaveAttribute("fill", LOGO_COLOURS.paper.ink);
  });

  it("draws only the named stamp when the background doesn't follow the theme", () => {
    const { container } = render(<LogoMark variant="paper" />);
    const layers = [...container.querySelectorAll("svg > g")];
    expect(layers).toHaveLength(1);
    expect(layers[0]).not.toHaveClass("hidden");
    expect(layers[0].querySelector("rect[mask]:not([transform])")).toHaveAttribute("fill", LOGO_COLOURS.paper.paper);
  });

  it("uses the drawing with fewer, larger perforations under 24px", () => {
    const { container } = render(
      <>
        <LogoMark size={16} />
        <LogoMark size={32} />
      </>,
    );
    const [small, regular] = [...container.querySelectorAll("svg")].map((svg) => svg.querySelectorAll("mask circle").length);
    expect(small).toBe(LOGO_PERFORATIONS.small.holes.length);
    expect(regular).toBe(LOGO_PERFORATIONS.regular.holes.length);
    expect(small).toBeLessThan(regular);
  });
});
