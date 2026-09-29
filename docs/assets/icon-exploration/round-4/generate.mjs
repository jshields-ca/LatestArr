// Round 4 of the icon exploration for #269: refining S7, the lifted stamp.
// In round 3 the L sat about 2 units right of and below the stamp's centre
// (the stamp face was centred near 30.5,30, the L near 32.5,32), so it looked
// off-centre. Every version here is built from one parametric function:
// the stamp and its shadow are centred on the tile as a group, and the L is
// centred on the stamp face, either by its bounding box or optically.
// Run: node docs/assets/icon-exploration/round-4/generate.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

// White stamp is the primary. Dark and light tiles are for dark and light
// contexts (a dark-mode favicon, the site on a white header, and so on).
const colourways = [
  { id: "deep", name: "Deep rose (primary)", tile: "#c31d4c", paper: "#ffffff", shadow: "#ef5d86", ink: "#c31d4c" },
  { id: "dark", name: "Dark", tile: "#0e1425", paper: "#ffffff", shadow: "#c31d4c", ink: "#c31d4c" },
  { id: "light", name: "Light", tile: "#fbf1f4", paper: "#c31d4c", shadow: "#f2a3b9", border: "#ecd3dc", ink: "#ffffff" },
];
const markColours = { paper: "#c31d4c", shadow: "#ef5d86", ink: "#ffffff" };
const markOnDark = { paper: "#ffffff", shadow: "#c31d4c", ink: "#c31d4c" };
const monoColours = { paper: "#000000", shadow: "#00000055" };

let seq = 0;
const uid = () => `m${++seq}`;

// Perforation holes on each edge, spaced evenly with a hole on every corner,
// so the edge pattern is symmetric.
function perforations(x, y, size, r) {
  const n = Math.round(size / 7);
  const step = size / n;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = i * step;
    out.push([x + p, y], [x + p, y + size], [x, y + p], [x + size, y + p]);
  }
  return out.map(([cx, cy]) => `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="#000"/>`).join("");
}

/**
 * The lifted stamp.
 * face: stamp size; dx, dy: shadow offset; blur: soft shadow (0 = hard);
 * stem: the L's stroke weight; nudge: optical shift of the L (x, y).
 */
function liftedStamp(c, { face = 40, dx = 2.5, dy = 3, blur = 0, stem = 8, nudge = [0, 0], hole = 2.4, guides = false }) {
  // Centre the stamp and its shadow together on the 64 grid.
  const groupW = face + Math.abs(dx);
  const groupH = face + Math.abs(dy);
  const x = (64 - groupW) / 2 + (dx < 0 ? -dx : 0);
  const y = (64 - groupH) / 2 + (dy < 0 ? -dy : 0);
  const cx = x + face / 2;
  const cy = y + face / 2;

  // The L is printed on the stamp in its own colour (c.ink), not cut out:
  // a cut-out would show the shadow through it, turning the L two-tone
  // wherever the shadow falls. One-colour marks (no ink) still cut it out.
  // The L: about half the face wide and 57% tall, centred on the face.
  const lw = face * 0.5;
  const lh = face * 0.57;
  const lx = cx - lw / 2 + nudge[0];
  const ly = cy - lh / 2 + nudge[1];
  const L = `M${lx} ${ly} h${stem} v${lh - stem} h${lw - stem} v${stem} h${-lw} Z`;

  const faceMask = uid();
  const shadowMask = uid();
  const blurId = uid();
  const mask = (id, withL) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">
      <rect x="${x}" y="${y}" width="${face}" height="${face}" fill="#fff"/>${perforations(x, y, face, hole)}${withL ? `<path d="${L}" fill="#000"/>` : ""}</mask>`;
  const shadow = `<g transform="translate(${dx} ${dy})"${blur ? ` filter="url(#${blurId})"` : ""}><rect x="${x - 4}" y="${y - 4}" width="${face + 8}" height="${face + 8}" fill="${c.shadow}" mask="url(#${shadowMask})"/></g>`;
  const front = `<rect x="${x - 4}" y="${y - 4}" width="${face + 8}" height="${face + 8}" fill="${c.paper}" mask="url(#${faceMask})"/>${c.ink ? `<path d="${L}" fill="${c.ink}"/>` : ""}`;
  const guideMarks = guides
    ? `<g stroke="#00b3ff" stroke-width="0.35" fill="none" opacity="0.9">
        <line x1="${cx}" y1="${y - 3}" x2="${cx}" y2="${y + face + 3}"/><line x1="${x - 3}" y1="${cy}" x2="${x + face + 3}" y2="${cy}"/>
        <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" stroke-dasharray="1 1"/>
        <line x1="32" y1="0" x2="32" y2="64" stroke="#ff9d00"/><line x1="0" y1="32" x2="64" y2="32" stroke="#ff9d00"/>
      </g>`
    : "";
  return `<defs>${mask(faceMask, !c.ink)}${mask(shadowMask, false)}${blur ? `<filter id="${blurId}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter>` : ""}</defs>${shadow}${front}${guideMarks}`;
}

const variants = [
  {
    id: "s7-round3",
    name: "S7 · Round 3 original",
    note: "For comparison. The L is about 2 units right of and below the stamp's centre, and the diagonal shadow pulls the whole icon to one side.",
    opts: { face: 42, dx: 2.5, dy: 3, nudge: [2, 2], stem: 7.5 },
    raw: true,
  },
  {
    id: "r1-centred",
    name: "R1 · Centred",
    note: "The same design with the fixes: stamp and shadow centred on the tile as a group, and the L centred on the stamp by its outline.",
    opts: { dx: 2.5, dy: 3 },
  },
  {
    id: "r2-optical",
    name: "R2 · Optically centred",
    note: "R1 with the L nudged slightly up and right. An L's weight sits at its bottom-left, so centring by outline alone still looks a little low and left; this nudge balances it by eye.",
    opts: { dx: 2.5, dy: 3, nudge: [0.8, -0.6] },
  },
  {
    id: "r3-straight",
    name: "R3 · Straight lift",
    note: "The shadow falls straight down instead of diagonally, so the icon is symmetrical left to right and nothing pulls it sideways. The L is optically centred.",
    opts: { dx: 0, dy: 3.5, nudge: [0.8, -0.6] },
  },
  {
    id: "r4-straight-bold",
    name: "R4 · Straight lift, bolder",
    note: "R3 with a slightly heavier L and a smaller shadow, for more punch at 16 and 32px.",
    opts: { dx: 0, dy: 2.8, stem: 9, nudge: [0.8, -0.6] },
  },
  {
    id: "r5-soft",
    name: "R5 · Soft shadow",
    note: "R3 with a blurred shadow, so the stamp floats rather than sitting on a hard offset. It's more modern, but softer at 16px.",
    opts: { dx: 0, dy: 3, blur: 1.4, nudge: [0.8, -0.6] },
  },
];

// The round 3 S7, redrawn exactly as it was (stamp at 9.5,9, shadow at the
// default position offset by 2.5,3, L at 22,20) so the comparison is fair.
function round3S7(c) {
  const a = uid(), b = uid();
  const holes = (x, y, s) => perforations(x, y, s, 2.4);
  return `<defs>
    <mask id="${a}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="11" y="11" width="42" height="42" fill="#fff"/>${holes(11, 11, 42)}</mask>
    <mask id="${b}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="9.5" y="9" width="42" height="42" fill="#fff"/>${holes(9.5, 9, 42)}<path d="M22 20 h7.5 v16.5 h13.5 v7.5 h-21 Z" fill="#000"/></mask></defs>
    <g transform="translate(2.5 3)"><rect x="7" y="7" width="50" height="50" fill="${c.shadow}" mask="url(#${a})"/></g>
    <rect x="5.5" y="5" width="50" height="50" fill="${c.paper}" mask="url(#${b})"/>`;
}

const glyph = (v, c, extra = {}) => (v.raw ? round3S7(c) : liftedStamp(c, { ...v.opts, ...extra }));
const tile = (v, cw, extra) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="${cw.border ? 0.5 : 0}" y="${cw.border ? 0.5 : 0}" width="${cw.border ? 63 : 64}" height="${cw.border ? 63 : 64}" rx="18" fill="${cw.tile}"${cw.border ? ` stroke="${cw.border}"` : ""}/>${glyph(v, cw, extra)}</svg>`;
const mark = (v, colours) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${glyph(v, colours)}</svg>`;

const files = new Map();
const save = (name, svg) => {
  writeFileSync(join(OUT, name), svg);
  files.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
};
for (const v of variants) {
  for (const cw of colourways) save(`${v.id}-tile-${cw.id}.svg`, tile(v, cw));
  save(`${v.id}-mark.svg`, mark(v, markColours));
  save(`${v.id}-mark-on-dark.svg`, mark(v, markOnDark));
  save(`${v.id}-mono.svg`, mark(v, monoColours));
  if (!v.raw) save(`${v.id}-guides.svg`, tile(v, colourways[0], { guides: true }));
}

const img = (file, s) => `<img src="${files.get(file)}" width="${s}" height="${s}" alt="">`;
const glance = `
  <section><h2>At a glance: deep rose, dark, and light, at 128, 32, and 16px</h2>
  <div class="glance">
    ${variants.map((v) => `<figure><div class="sizes">${colourways.map((cw) => img(`${v.id}-tile-${cw.id}.svg`, 88)).join("")}</div><div class="sizes">${colourways.flatMap((cw) => [img(`${v.id}-tile-${cw.id}.svg`, 32), img(`${v.id}-tile-${cw.id}.svg`, 16)]).join("")}</div><figcaption>${v.name}</figcaption></figure>`).join("")}
  </div></section>`;

const detail = (v) => `
  <section>
    <h2>${v.name}</h2>
    <p class="idea">${v.note}</p>
    <div class="grid">
      ${v.raw ? "" : `<div class="panel light">${img(`${v.id}-guides.svg`, 256)}<span>Construction: blue = stamp centre and L box, orange = tile centre</span></div>`}
      ${colourways.map((cw) => `<div class="panel ${cw.id === "dark" ? "dark" : "light"}">${[128, 64, 32, 16].map((s) => img(`${v.id}-tile-${cw.id}.svg`, s)).join("")}<span>${cw.name}</span></div>`).join("")}
      <div class="panel light">${[96, 32, 16].map((s) => img(`${v.id}-mark.svg`, s)).join("")}<span>Mark on light</span></div>
      <div class="panel dark">${[96, 32, 16].map((s) => img(`${v.id}-mark-on-dark.svg`, s)).join("")}<span>Mark on dark</span></div>
      <div class="panel light">${[96, 32, 16].map((s) => img(`${v.id}-mono.svg`, s)).join("")}<span>One colour</span></div>
      <div class="panel tabs">${colourways.map((cw) => `<div class="tab">${img(`${v.id}-tile-${cw.id}.svg`, 16)}LatestArr</div>`).join("")}<span>Browser tab</span></div>
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LatestArr icon exploration, round 4: refining the lifted stamp (#269)</title>
<style>
  body { margin: 0; padding: 32px; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; background: #fbf5f7; color: #241521; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 4px; }
  .lede, .idea { color: #7c5a68; margin: 0 0 10px; max-width: 900px; }
  .glance { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  figure { margin: 0; padding: 14px; background: #fff; border: 1px solid #e9dbe0; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
  .sizes { display: flex; align-items: flex-end; gap: 10px; }
  figcaption { font-size: 12px; color: #7c5a68; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .panel { position: relative; display: flex; align-items: flex-end; gap: 14px; padding: 16px 16px 30px; border-radius: 12px; border: 1px solid #e9dbe0; }
  .panel span { position: absolute; left: 16px; bottom: 8px; font-size: 11px; color: #9c8290; }
  .light { background: #fff; } .dark { background: #0e1425; border-color: #1f2a44; } .dark span { color: #8a94ad; }
  .tabs { flex-direction: column; align-items: flex-start; gap: 6px; background: #dfe3ea; }
  .tab { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 8px 8px 0 0; padding: 6px 12px; font-size: 12px; min-width: 140px; }
</style></head><body>
<h1>LatestArr icon exploration, round 4: refining the lifted stamp</h1>
<p class="lede">The L is now printed on the stamp in solid colour rather than cut through it. As a cut-out it showed the shadow behind it, so it came out pink in some versions and crimson in others. Every version below also fixes round 3's off-centre L. The stamp and its shadow are centred on the tile as a group, and the L is centred on the stamp face. Each has a construction view with guide lines, so the centring can be checked rather than judged by eye. White stays the primary. Dark and light tiles show how it works for a dark-mode favicon, or on a white page. <strong>Recommendation: R4 (straight lift, bolder) for its balance and punch at 16px, with R3 as the lighter alternative.</strong> Still to tune in the final pass: the pink crescents where the shadow shows through the side perforations (texture at large sizes, gone at small ones).</p>
${glance}
${variants.map(detail).join("")}
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`Wrote ${variants.length} variants × ${colourways.length} colourways to ${OUT}`);
