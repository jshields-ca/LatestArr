// LatestArr's icon: the lifted postage stamp (R4 from the #269 exploration,
// archived under the archive/icon-exploration tag), final pass. This script is the
// single source of truth for every icon file: it writes the SVGs here, the
// web UI's favicon, and the PNG sizes (rendered with sharp from apps/server).
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
  rose: "#c31d4c", // the UI accent; the primary tile
  roseLight: "#ef5d86", // the stamp's shadow on rose
  ink: "#0e1425", // the dark tile
  blush: "#fbf1f4", // the light tile
  blushBorder: "#ecd3dc",
  shadowOnBlush: "#f2a3b9",
  white: "#ffffff",
};

// Geometry, on a 64 grid. The stamp face is 40 wide at x=12, y=10, so at
// 32px (half scale) its edges land on whole pixels. The shadow drops 3
// straight down and is clipped to below the stamp, so it never shows
// through the side perforations. The L is centred on the face and nudged
// 0.8 right and 0.6 up, because an L's weight sits at its bottom-left.
const FACE = { x: 12, y: 10, size: 40 };
const SHADOW_DROP = 3;
const HOLE_R = 2.4;
const STEM = 9;
const L_W = FACE.size * 0.5;
const L_H = FACE.size * 0.57;
const NUDGE = [0.8, -0.6];

// Every perforation's centre. Corners come up twice (once per edge), so
// each hole is kept once.
function holeCentres() {
  const { x, y, size } = FACE;
  const n = Math.round(size / 7);
  const step = size / n;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = +(i * step).toFixed(3);
    out.push([x + p, y], [x + p, y + size], [x, y + p], [x + size, y + p]);
  }
  return [...new Map(out.map(([hx, hy]) => [`${hx},${hy}`, [+hx.toFixed(3), +hy.toFixed(3)]])).values()];
}

function holes() {
  return holeCentres().map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="${HOLE_R}"/>`).join("");
}

const cx = FACE.x + FACE.size / 2;
const cy = FACE.y + FACE.size / 2;
const lx = +(cx - L_W / 2 + NUDGE[0]).toFixed(2);
const ly = +(cy - L_H / 2 + NUDGE[1]).toFixed(2);
const L_PATH = `M${lx} ${ly}h${STEM}v${+(L_H - STEM).toFixed(2)}h${L_W - STEM}v${STEM}h${-L_W}Z`;

/**
 * The stamp. `paper` is the stamp, `shadow` its shadow, and `ink` the L.
 * With no ink, the L is cut out instead, so a one-colour mark shows the
 * background through it.
 */
export function stamp({ paper, shadow, ink }, id = "s") {
  const faceRect = `<rect x="${FACE.x}" y="${FACE.y}" width="${FACE.size}" height="${FACE.size}" fill="#fff"/>`;
  const holeGroup = `<g fill="#000">${holes()}</g>`;
  return `<defs>
    <mask id="${id}-face" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">${faceRect}${holeGroup}${ink ? "" : `<path d="${L_PATH}" fill="#000"/>`}</mask>
    <mask id="${id}-shadow" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">${faceRect}${holeGroup}</mask>
    <clipPath id="${id}-below"><rect x="0" y="${FACE.y + FACE.size - 1}" width="64" height="${64 - FACE.y - FACE.size + 1}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-below)"><g transform="translate(0 ${SHADOW_DROP})"><rect width="64" height="64" fill="${shadow}" mask="url(#${id}-shadow)"/></g></g>
  <rect width="64" height="64" fill="${paper}" mask="url(#${id}-face)"/>
  ${ink ? `<path d="${L_PATH}" fill="${ink}"/>` : ""}`;
}

const svg = (body, label = "LatestArr") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}">${body}</svg>\n`;
const tile = (fill, stroke) =>
  stroke
    ? `<rect x="0.5" y="0.5" width="63" height="63" rx="18" fill="${fill}" stroke="${stroke}"/>`
    : `<rect width="64" height="64" rx="18" fill="${fill}"/>`;

const C = COLOURS;
export const icons = {
  // App icons (a tile with the stamp).
  "icon.svg": svg(tile(C.rose) + stamp({ paper: C.white, shadow: C.roseLight, ink: C.rose })),
  "icon-dark.svg": svg(tile(C.ink) + stamp({ paper: C.white, shadow: C.rose, ink: C.rose })),
  "icon-light.svg": svg(tile(C.blush, C.blushBorder) + stamp({ paper: C.rose, shadow: C.shadowOnBlush, ink: C.white })),
  // The bare mark, for use on a page (no tile).
  "mark.svg": svg(stamp({ paper: C.rose, shadow: C.roseLight, ink: C.white })),
  "mark-on-dark.svg": svg(stamp({ paper: C.white, shadow: C.rose, ink: C.rose })),
  "mark-mono.svg": svg(stamp({ paper: "#000000", shadow: "#00000055" })),
};

// A full-bleed square for Android's maskable icons: the stamp inside the
// central 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${C.rose}"/><g transform="translate(6.4 6.4) scale(0.8)">${stamp({ paper: C.white, shadow: C.roseLight, ink: C.rose }, "mk")}</g></svg>\n`;

async function main() {
  for (const [name, content] of Object.entries(icons)) writeFileSync(join(HERE, name), content);
  writeFileSync(join(HERE, "icon-maskable.svg"), maskable);

  // The web UI draws the mark inline (LogoMark) from the same geometry.
  writeFileSync(
    join(ROOT, "apps", "web", "src", "components", "logo-geometry.ts"),
    [
      "// Generated by docs/assets/brand/generate.mjs; edit that script, not this file.",
      "// The LatestArr stamp on a 64x64 grid. See docs/assets/brand/brand.md.",
      `export const LOGO_FACE = ${JSON.stringify(FACE)} as const;`,
      `export const LOGO_SHADOW_DROP = ${SHADOW_DROP};`,
      `export const LOGO_HOLE_R = ${HOLE_R};`,
      `export const LOGO_HOLES: readonly (readonly [number, number])[] = ${JSON.stringify(holeCentres())};`,
      `export const LOGO_L_PATH = "${L_PATH}";`,
      `export const LOGO_COLOURS = { tile: "${C.rose}", paper: "${C.white}", shadow: "${C.roseLight}", ink: "${C.rose}" } as const;`,
      "",
    ].join("\n"),
  );

  // The web UI serves these from apps/web/public.
  const pub = join(ROOT, "apps", "web", "public");
  writeFileSync(join(pub, "favicon.svg"), icons["icon.svg"]);
  const png = async (source, size, file, density = 72) =>
    sharp(Buffer.from(source), { density: Math.max(density, (size / 64) * 72 * 4) }).resize(size, size).png().toFile(file);
  await png(icons["icon.svg"], 32, join(pub, "favicon-32.png"));
  await png(icons["icon.svg"], 180, join(pub, "apple-touch-icon.png"));
  await png(icons["icon.svg"], 192, join(pub, "icon-192.png"));
  await png(icons["icon.svg"], 512, join(pub, "icon-512.png"));
  await png(maskable, 512, join(pub, "icon-maskable-512.png"));

  const pngDir = join(HERE, "png");
  mkdirSync(pngDir, { recursive: true });
  for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
    for (const name of ["icon", "icon-dark", "icon-light"]) {
      await png(icons[`${name}.svg`], size, join(pngDir, `${name}-${size}.png`));
    }
  }
  console.log("Wrote the icon set to docs/assets/brand and apps/web/public");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
