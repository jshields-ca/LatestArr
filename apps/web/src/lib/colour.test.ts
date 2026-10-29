import { describe, expect, it } from "vitest";

import { contrastRatio, contrastWarnings, effectiveColour, isDarkBackground, mix, parseHexColour } from "./colour";
import { DEFAULT_DESIGN_SETTINGS, type DesignSettings } from "./design";

function settings(overrides: Partial<DesignSettings["colors"]>, buttons?: Partial<DesignSettings["buttons"]>): DesignSettings {
  return {
    ...DEFAULT_DESIGN_SETTINGS,
    colors: { ...DEFAULT_DESIGN_SETTINGS.colors, ...overrides },
    buttons: { ...DEFAULT_DESIGN_SETTINGS.buttons, ...buttons },
  };
}

describe("colour helpers", () => {
  it("mixes and measures contrast like WCAG", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("calls a background dark the way the server's dark-mode handling does", () => {
    expect(isDarkBackground("#181818")).toBe(true);
    expect(isDarkBackground("#ffffff")).toBe(false);
    expect(isDarkBackground("#00bcd4")).toBe(false);
    });

  it("reads typed hex colours with or without the #, in short or long form", () => {
    expect(parseHexColour("#181818")).toBe("#181818");
    expect(parseHexColour(" 00BCD4 ")).toBe("#00bcd4");
    expect(parseHexColour("#abc")).toBe("#aabbcc");
    for (const bad of ["", "#18181", "1818189", "red", "#gggggg", "rgb(0,0,0)"]) expect(parseHexColour(bad)).toBeNull();
  });

  it("follows the accent for unset advanced colours, as the server does", () => {
    const colors = DEFAULT_DESIGN_SETTINGS.colors;
    expect(effectiveColour(colors, "labelText")).toBe("#c31d4c");
    expect(effectiveColour(colors, "labelBackground")).toBe("#fbe4ea");
    expect(effectiveColour(colors, "buttonText")).toBe("#ffffff");
    expect(effectiveColour({ ...colors, accent: "#1A7F5A" }, "labelBackground")).toBe(mix("#1a7f5a", "#ffffff", 0.85));
    expect(effectiveColour({ ...colors, link: "#0B5394" }, "link")).toBe("#0b5394");
  });

  it("raises no warnings for the default design", () => {
    expect(contrastWarnings(DEFAULT_DESIGN_SETTINGS)).toEqual([]);
  });

  it("warns about hard-to-read pairs", () => {
    const warnings = contrastWarnings(settings({ buttonBackground: "#ffff00", labelText: "#eeeeee", labelBackground: "#ffffff" }));
    expect(warnings.map((warning) => warning.label)).toEqual([
      "Label text on the label background",
      "Button text on the button colour",
      "Outlined buttons on the background",
    ]);
  });

  it("checks outlined buttons against the background instead", () => {
    const warnings = contrastWarnings(settings({ buttonBackground: "#ffff00" }, { style: "outline" }));
    expect(warnings.map((warning) => warning.label)).toEqual(["Outlined buttons on the background"]);
  });

  it("checks button text when only the where-to-watch buttons are filled", () => {
    const warnings = contrastWarnings(
      settings({ buttonBackground: "#ffff00" }, { style: "outline", sourceStyle: "filled" }),
    );
    expect(warnings.map((warning) => warning.label)).toEqual([
      "Button text on the button colour",
      "Outlined buttons on the background",
    ]);
  });

  it("checks only button text when every button is filled", () => {
    const warnings = contrastWarnings(settings({ buttonBackground: "#ffff00" }, { sourceStyle: "filled" }));
    expect(warnings.map((warning) => warning.label)).toEqual(["Button text on the button colour"]);
  });
});
