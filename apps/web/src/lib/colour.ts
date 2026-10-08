// Colour maths for the design editor: the colours a design's advanced
// options fall back to (mirroring paletteFor in apps/server/src/render/
// design.ts), and a WCAG contrast check for readable text.

import type { DesignSettings } from "@/lib/design";

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** `a` moved `amount` (0 to 1) of the way towards `b`. */
export function mix(a: string, b: string, amount: number): string {
  const [ca, cb] = [channels(a), channels(b)];
  return `#${ca.map((value, i) => Math.round(value * (1 - amount) + cb[i]! * amount).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two colours, from 1 (none) to 21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for normal-size text. */
export const MIN_CONTRAST = 4.5;

const DEFAULT_ACCENT = "#c31d4c";
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_ACCENT_TINT = "#fbe4ea";

export type AdvancedColour = "labelText" | "labelBackground" | "buttonBackground" | "buttonText" | "link";

/** What each advanced colour is when it isn't set: it follows the accent. */
export function effectiveColour(colors: DesignSettings["colors"], key: AdvancedColour): string {
  const own = colors[key];
  if (own) return own.toLowerCase();
  const accent = colors.accent.toLowerCase();
  const background = colors.background.toLowerCase();
  switch (key) {
    case "labelBackground":
      return accent === DEFAULT_ACCENT && background === DEFAULT_BACKGROUND
        ? DEFAULT_ACCENT_TINT
        : mix(accent, background, 0.85);
    case "buttonText":
      return "#ffffff";
    default:
      return accent;
  }
}

export interface ContrastWarning {
  label: string;
  ratio: number;
}

/** Colour pairs in the design whose text would be hard to read. */
export function contrastWarnings(settings: DesignSettings): ContrastWarning[] {
  const { colors } = settings;
  const pairs: [string, string, string][] = [
    ["Text on the background", colors.text, colors.background],
    ["Secondary text on the background", colors.muted, colors.background],
    ["Label text on the label background", effectiveColour(colors, "labelText"), effectiveColour(colors, "labelBackground")],
    ["Links on the background", effectiveColour(colors, "link"), colors.background],
  ];
  if (settings.buttons.style === "filled") {
    pairs.push(["Button text on the button colour", effectiveColour(colors, "buttonText"), effectiveColour(colors, "buttonBackground")]);
  } else {
    pairs.push(["Outlined buttons on the background", effectiveColour(colors, "buttonBackground"), colors.background]);
  }
  return pairs
    .map(([label, fg, bg]) => ({ label, ratio: contrastRatio(fg, bg) }))
    .filter((pair) => pair.ratio < MIN_CONTRAST);
}
