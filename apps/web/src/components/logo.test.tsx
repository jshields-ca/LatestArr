import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
