// Round 2 of the icon exploration for #269. Round 1 was mostly ways of
// drawing an "L"; this round leans on silhouettes that carry meaning on
// their own (a ticket, a stamp, marquee lights, a "new" seal) and tries a
// second colourway, white on deep rose, next to the current rose and ink.
// Run: node docs/assets/icon-exploration/round-2/generate.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

const ROSE = "#ef5d86";
const ROSE_DEEP = "#c31d4c";
const INK = "#0e1425";
const WHITE = "#ffffff";

const colourways = [
  { id: "rose", name: "Rose + ink", tile: ROSE, ink: INK },
  { id: "deep", name: "Deep rose + white", tile: ROSE_DEEP, ink: WHITE },
];

// Glyphs sit on a 64×64 grid, roughly inside 10..54. Cut-outs use a mask,
// so they show whatever is behind the mark (the tile, or the page) and the
// mark stays one colour.
const directions = [
  {
    id: "g-ticket",
    name: "G · Ticket",
    idea: "An admission ticket: notched sides and a tear line. New releases are an event, and the newsletter is your ticket in. The silhouette is recognisable at any size, and nothing else in the media-server space uses it.",
    verdict: "Distinctive among media apps. The risk is that ticketing and help-desk tools (\"support tickets\") use tickets too; the tear line and slight tilt help keep it about movies.",
    glyph: (ink, uid) => `
      <defs><mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect x="9" y="17" width="46" height="30" rx="5" fill="#fff"/>
        <circle cx="9" cy="32" r="6" fill="#000"/><circle cx="55" cy="32" r="6" fill="#000"/>
        ${[20.5, 26.5, 32.5, 38.5].map((y) => `<rect x="40" y="${y}" width="3" height="3.5" rx="1.2" fill="#000"/>`).join("")}
      </mask></defs>
      <g transform="rotate(-12 32 32)"><rect x="9" y="17" width="46" height="30" rx="5" fill="${ink}" mask="url(#${uid})"/></g>`,
  },
  {
    id: "h-arrival",
    name: "H · Arrival",
    idea: "An L whose foot turns into an arrow: “the latest, arriving”. It's one continuous stroke, so it reads as a single shape.",
    verdict: "Bold and simple, but in practice it reads as a “turn right” road sign or the ↳ “reply” symbol, which makes it a UI icon rather than a brand.",
    glyph: (ink) => `
      <path d="M21 11 V33 a11 11 0 0 0 11 11 H40" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
      <path d="M39 31 L55 44 L39 57 Z" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "i-stamp",
    name: "I · Postage stamp",
    idea: "A stamp with perforated edges and an L cut out: delivered to your inbox, without the envelope. The scalloped edge is a shape people know instantly.",
    verdict: "A strong “it arrives by mail” cue that's more characterful than an envelope. The perforations soften at 16px but the stamp still reads as a square with an L.",
    glyph: (ink, uid) => {
      const holes = [];
      for (let i = 0; i <= 6; i++) {
        const p = 11 + i * 7;
        holes.push([p, 11], [p, 53], [11, p], [53, p]);
      }
      return `
      <defs><mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect x="11" y="11" width="42" height="42" fill="#fff"/>
        ${holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#000"/>`).join("")}
        <path d="M22 20 H29.5 V36.5 H43 V44 H22 Z" fill="#000"/>
      </mask></defs>
      <rect x="8" y="8" width="48" height="48" fill="${ink}" mask="url(#${uid})"/>`;
    },
  },
  {
    id: "o-marquee",
    name: "O · Marquee L",
    idea: "An L spelled out in marquee lights, like a cinema's “now showing” sign. It combines the name, the media world, and a bit of showbiz fun.",
    verdict: "The most playful and the most “ours”. At 16px the lights merge into a solid L, which still works. Worth refining the dot count and spacing.",
    glyph: (ink) => {
      const r = 4.6;
      const dots = [[19, 13], [19, 23.5], [19, 34], [19, 44.5], [29.5, 44.5], [40, 44.5], [50.5, 44.5]];
      return dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`).join("")
        + `<circle cx="50.5" cy="23.5" r="${r}" fill="${ink}" opacity="0.45"/>`;
    },
  },
  {
    id: "j-new-seal",
    name: "J · “New” seal",
    idea: "The starburst “NEW” sticker from shop shelves, with an L punched through it: what's new, stamped with the brand.",
    verdict: "Ruled out after seeing it small: at 32px and 16px the round seal with an L inside reads as a clock face. At large sizes it says “new” loudly, but it's close to the scalloped “verified” badges on social networks. It's close to the scalloped “verified” badges on social networks, and a starburst can look cheap, ",
    glyph: (ink, uid) => {
      const pts = [];
      const n = 14;
      for (let i = 0; i < n * 2; i++) {
        const a = (Math.PI * i) / n - Math.PI / 2;
        const rad = i % 2 === 0 ? 23 : 19.5;
        pts.push(`${(32 + rad * Math.cos(a)).toFixed(2)},${(32 + rad * Math.sin(a)).toFixed(2)}`);
      }
      return `
      <defs><mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <polygon points="${pts.join(" ")}" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
        <path d="M25 20 H32 V36 H41 V43 H25 Z" fill="#000"/>
      </mask></defs>
      <rect x="0" y="0" width="64" height="64" fill="${ink}" mask="url(#${uid})"/>`;
    },
  },
  {
    id: "k-set-square",
    name: "K · L + A set square",
    idea: "A drafting set square: its upright and base form the L, and its slope forms an A, for LatestArr. It's precise and a little crafted.",
    verdict: "The cleverest monogram, but the least obvious meaning: it reads as “design tool” or a warning triangle before it reads as newsletters.",
    glyph: (ink) => `
      <path d="M15 12 L15 52 L55 52 Z M22.5 32 L22.5 44.5 L35 44.5 Z" fill="${ink}" fill-rule="evenodd" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`,
  },
];

let maskSeq = 0;
const uid = () => `m${++maskSeq}`;

function tile(d, cw) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${cw.tile}"/>${d.glyph(cw.ink, uid())}</svg>`;
}
function mark(d, colour) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${d.glyph(colour, uid())}</svg>`;
}

const files = new Map();
const save = (name, svg) => {
  writeFileSync(join(OUT, name), svg);
  files.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
};
const current = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${ROSE}"/><path d="M8.5 13h13v8.5h-13z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 13l6.5 5 6.5-5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 3.4 L25.9 7.1 L29.6 9 L25.9 10.9 L24 14.6 L22.1 10.9 L18.4 9 L22.1 7.1 Z" fill="${INK}"/></svg>`;
save("current.svg", current);
for (const d of directions) {
  for (const cw of colourways) save(`${d.id}-tile-${cw.id}.svg`, tile(d, cw));
  save(`${d.id}-mark.svg`, mark(d, ROSE_DEEP));
  save(`${d.id}-mono.svg`, mark(d, "#000000"));
}

const img = (file, s) => `<img src="${files.get(file)}" width="${s}" height="${s}" alt="">`;
const glance = `
  <section><h2>At a glance: both colourways at 96, 32, and 16px</h2>
  <div class="glance">
    <figure><div class="sizes">${[96, 32, 16].map((s) => img("current.svg", s)).join("")}</div><figcaption>Current</figcaption></figure>
    ${directions.map((d) => `<figure>${colourways.map((cw) => `<div class="sizes">${[96, 32, 16].map((s) => img(`${d.id}-tile-${cw.id}.svg`, s)).join("")}</div>`).join("")}<figcaption>${d.name}</figcaption></figure>`).join("")}
  </div></section>`;

const detail = (d) => `
  <section>
    <h2>${d.name}</h2>
    <p class="idea">${d.idea}</p>
    <p class="verdict"><strong>Assessment:</strong> ${d.verdict}</p>
    <div class="grid">
      ${colourways.map((cw) => `<div class="panel light">${[128, 64, 32, 16].map((s) => img(`${d.id}-tile-${cw.id}.svg`, s)).join("")}<span>${cw.name}</span></div>`).join("")}
      <div class="panel dark">${[64, 32, 16].map((s) => img(`${d.id}-tile-deep.svg`, s)).join("")}<span>On dark</span></div>
      <div class="panel light">${[64, 32, 16].map((s) => img(`${d.id}-mark.svg`, s)).join("")}<span>Mark</span></div>
      <div class="panel dark">${[64, 32, 16].map((s) => img(`${d.id}-mark.svg`, s)).join("")}<span>Mark on dark</span></div>
      <div class="panel light">${[64, 32, 16].map((s) => img(`${d.id}-mono.svg`, s)).join("")}<span>One colour</span></div>
      <div class="panel tabs">${colourways.map((cw) => `<div class="tab">${img(`${d.id}-tile-${cw.id}.svg`, 16)}LatestArr</div>`).join("")}<span>Browser tab</span></div>
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LatestArr icon exploration, round 2 (#269)</title>
<style>
  body { margin: 0; padding: 32px; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; background: #fbf5f7; color: #241521; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 4px; }
  .lede, .idea { color: #7c5a68; margin: 0 0 6px; max-width: 900px; } .verdict { margin: 0 0 10px; max-width: 900px; }
  .glance { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
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
<h1>LatestArr icon exploration, round 2</h1>
<p class="lede">Round 1 was mostly different ways of drawing an L. This round tries silhouettes that mean something on their own, and a second colourway (white on deep rose) beside the current rose and ink. These are still sketches, for choosing a direction. Directions can be combined, too (for example, marquee lights on a ticket). <strong>Strongest: G (ticket) and I (stamp), with O (marquee) as the playful option.</strong></p>
${glance}
${directions.map(detail).join("")}
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`Wrote ${directions.length} directions × ${colourways.length} colourways to ${OUT}`);
