// LatestArr's mark: a postage stamp with an L (chosen in #269; the tile it
// used to sit on was dropped in #332). This script is the single source of
// truth for every brand file: it writes the SVGs here, the web UI's favicon
// and app icons, the geometry the in-app logo draws from, and the PNG sizes
// (rendered with sharp from apps/server).
// Run: node docs/assets/brand/generate.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const require = createRequire(join(ROOT, "apps", "server", "package.json"));
const sharp = require("sharp");

export const COLOURS = {
  rose: "#c31d4c", // the UI accent; the stamp on light backgrounds, the L on dark
  roseEdge: "#e2456f", // the edge under the paper stamp
  roseDeep: "#7d1231", // the edge under the rose stamp
  navy: "#14213d", // the app icon's tile
  white: "#ffffff",
};

// Geometry, on a 64 grid. The stamp face is 52 wide at x=6, y=4, so at 32px
// (half scale) its edges land on whole pixels. The edge drops 4 straight
// down and is clipped to below the stamp, so it never shows through the
// side perforations. The L is centred on the face and nudged right and up,
// because an L's weight sits at its bottom-left.
const FACE = { x: 6, y: 4, size: 52 };
const EDGE_DROP = 4;
const STEM = 11.7;
const L_W = FACE.size * 0.5;
const L_H = FACE.size * 0.57;
const NUDGE = [1.04, -0.78];

// Two drawings of the perforations: seven gaps a side, and five larger ones
// for sizes under 24px, where seven turn to noise.
const PERFORATIONS = {
  regular: { gaps: 7, radius: 2.6 },
  small: { gaps: 5, radius: 3.5 },
};

// Every perforation's centre. Corners come up twice (once per edge), so
// each hole is kept once.
function holeCentres(gaps) {
  const { x, y, size } = FACE;
  const step = size / gaps;
  const out = [];
  for (let i = 0; i <= gaps; i++) {
    const p = +(i * step).toFixed(3);
    out.push([x + p, y], [x + p, y + size], [x, y + p], [x + size, y + p]);
  }
  return [...new Map(out.map(([hx, hy]) => [`${hx},${hy}`, [+hx.toFixed(3), +hy.toFixed(3)]])).values()];
}

const cx = FACE.x + FACE.size / 2;
const cy = FACE.y + FACE.size / 2;
const lx = +(cx - L_W / 2 + NUDGE[0]).toFixed(2);
const ly = +(cy - L_H / 2 + NUDGE[1]).toFixed(2);
const L_PATH = `M${lx} ${ly}h${STEM}v${+(L_H - STEM).toFixed(2)}h${+(L_W - STEM).toFixed(2)}v${STEM}h${-L_W}Z`;

/**
 * The stamp. `paper` is the stamp, `edge` the strip below it, and `ink` the
 * L. With no ink, the L is cut out instead, so a one-colour mark shows the
 * background through it.
 */
export function stamp({ paper, edge, ink }, { id = "s", drawing = "regular" } = {}) {
  const { gaps, radius } = PERFORATIONS[drawing];
  const faceRect = `<rect x="${FACE.x}" y="${FACE.y}" width="${FACE.size}" height="${FACE.size}" fill="#fff"/>`;
  const holeGroup = `<g fill="#000">${holeCentres(gaps)
    .map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="${radius}"/>`)
    .join("")}</g>`;
  return `<defs>
    <mask id="${id}-face" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">${faceRect}${holeGroup}${ink ? "" : `<path d="${L_PATH}" fill="#000"/>`}</mask>
    <mask id="${id}-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">${faceRect}${holeGroup}</mask>
    <clipPath id="${id}-below"><rect x="0" y="${FACE.y + FACE.size - 1}" width="64" height="${64 - FACE.y - FACE.size + 1}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-below)"><g transform="translate(0 ${EDGE_DROP})"><rect width="64" height="64" fill="${edge}" mask="url(#${id}-edge)"/></g></g>
  <rect width="64" height="64" fill="${paper}" mask="url(#${id}-face)"/>
  ${ink ? `<path d="${L_PATH}" fill="${ink}"/>` : ""}`;
}

const svg = (body, label = "LatestArr") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}">${body}</svg>\n`;
// The stamp at `scale`, centred on the 64 grid.
const centred = (body, scale) => `<g transform="translate(${+(32 * (1 - scale)).toFixed(2)} ${+(32 * (1 - scale)).toFixed(2)}) scale(${scale})">${body}</g>`;

const C = COLOURS;
const ROSE_STAMP = { paper: C.rose, edge: C.roseDeep, ink: C.white };
const PAPER_STAMP = { paper: C.white, edge: C.roseEdge, ink: C.rose };

export const icons = {
  // The mark: rose on light backgrounds, paper on dark ones.
  "mark.svg": svg(stamp(ROSE_STAMP)),
  "mark-on-dark.svg": svg(stamp(PAPER_STAMP)),
  "mark-small.svg": svg(stamp(ROSE_STAMP, { drawing: "small" })),
  "mark-small-on-dark.svg": svg(stamp(PAPER_STAMP, { drawing: "small" })),
  "mark-mono.svg": svg(stamp({ paper: "#000000", edge: "#00000055" })),
  // The app icon: phones need a filled square behind an icon, so the tile
  // survives here only.
  "icon.svg": svg(`<rect width="64" height="64" rx="15" fill="${C.navy}"/>` + centred(stamp(PAPER_STAMP), 0.7)),
};

// A full-bleed square for Android's maskable icons: the stamp inside the
// central 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${C.navy}"/>${centred(stamp(PAPER_STAMP, { id: "mk" }), 0.6)}</svg>\n`;

async function main() {
  for (const [name, content] of Object.entries(icons)) writeFileSync(join(HERE, name), content);
  writeFileSync(join(HERE, "icon-maskable.svg"), maskable);

  // The web UI draws the mark inline (LogoMark) from the same geometry.
  const holes = (drawing) => JSON.stringify(holeCentres(PERFORATIONS[drawing].gaps));
  writeFileSync(
    join(ROOT, "apps", "web", "src", "components", "logo-geometry.ts"),
    [
      "// Generated by docs/assets/brand/generate.mjs; edit that script, not this file.",
      "// The LatestArr stamp on a 64x64 grid. See docs/assets/brand/brand.md.",
      `export const LOGO_FACE = ${JSON.stringify(FACE)} as const;`,
      `export const LOGO_EDGE_DROP = ${EDGE_DROP};`,
      `export const LOGO_L_PATH = "${L_PATH}";`,
      "// Seven perforation gaps a side, and five larger ones for sizes under 24px.",
      `export const LOGO_PERFORATIONS = {`,
      `  regular: { radius: ${PERFORATIONS.regular.radius}, holes: ${holes("regular")} },`,
      `  small: { radius: ${PERFORATIONS.small.radius}, holes: ${holes("small")} },`,
      `} as const satisfies Record<string, { radius: number; holes: readonly (readonly [number, number])[] }>;`,
      "// The paper stamp is for dark backgrounds, the rose stamp for light ones.",
      `export const LOGO_COLOURS = {`,
      `  paper: { paper: "${PAPER_STAMP.paper}", edge: "${PAPER_STAMP.edge}", ink: "${PAPER_STAMP.ink}" },`,
      `  rose: { paper: "${ROSE_STAMP.paper}", edge: "${ROSE_STAMP.edge}", ink: "${ROSE_STAMP.ink}" },`,
      `} as const;`,
      "",
    ].join("\n"),
  );

  // The web UI serves these from apps/web/public. A browser tab can be light
  // or dark, so the favicon is the rose stamp, in the small drawing.
  const pub = join(ROOT, "apps", "web", "public");
  writeFileSync(join(pub, "favicon.svg"), icons["mark-small.svg"]);
  const png = async (source, size, file, density = 72) =>
    sharp(Buffer.from(source), { density: Math.max(density, (size / 64) * 72 * 4) }).resize(size, size).png().toFile(file);
  await png(icons["mark-small.svg"], 32, join(pub, "favicon-32.png"));
  await png(icons["icon.svg"], 180, join(pub, "apple-touch-icon.png"));
  await png(icons["icon.svg"], 192, join(pub, "icon-192.png"));
  await png(icons["icon.svg"], 512, join(pub, "icon-512.png"));
  await png(maskable, 512, join(pub, "icon-maskable-512.png"));

  const pngDir = join(HERE, "png");
  mkdirSync(pngDir, { recursive: true });
  for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
    await png(icons["icon.svg"], size, join(pngDir, `icon-${size}.png`));
    const drawing = size < 24 ? "mark-small" : "mark";
    await png(icons[`${drawing}.svg`], size, join(pngDir, `mark-${size}.png`));
    await png(icons[`${drawing}-on-dark.svg`], size, join(pngDir, `mark-on-dark-${size}.png`));
  }
  console.log("Wrote the brand files to docs/assets/brand and apps/web/public");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
