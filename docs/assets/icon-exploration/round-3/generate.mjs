// Round 3 of the icon exploration for #269: variations on the postage
// stamp from round 2 (kept here as S0), each adding depth the way real
// stamps have it: a printed centre, a frame, a second stamp, a postmark, a
// curled corner, a shadow.
// Run: node docs/assets/icon-exploration/round-3/generate.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

// "paper" is the stamp itself, "print" a second tone of the same family
// for printed areas and depth, "tile" the app-icon background.
const colourways = [
  { id: "deep", name: "Deep rose + white", tile: "#c31d4c", paper: "#ffffff", print: "#ef5d86" },
  { id: "rose", name: "Rose + ink", tile: "#ef5d86", paper: "#0e1425", print: "#c31d4c" },
];
// A bare mark on a page, and one colour (print as a tint of the same ink).
const markColours = { paper: "#c31d4c", print: "#ef5d86" };
const monoColours = { paper: "#000000", print: "#00000066" };

let seq = 0;
const uid = () => `m${++seq}`;

// A perforated stamp outline as mask content: the paper in white, the
// perforation holes in black. Holes sit on the edges, 7 units apart.
function perforated(x, y, size, r = 2.4) {
  const holes = [];
  const n = Math.round(size / 7);
  const step = size / n;
  for (let i = 0; i <= n; i++) {
    const p = i * step;
    holes.push([x + p, y], [x + p, y + size], [x, y + p], [x + size, y + p]);
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff"/>${holes.map(([cx, cy]) => `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="#000"/>`).join("")}`;
}
const L = (x, y, s = 1) =>
  `<path d="M${x} ${y} h${7.5 * s} v${16.5 * s} h${13.5 * s} v${7.5 * s} h${-21 * s} Z"/>`;
const stamp = (c, id, inner = "", attrs = "", box = [11, 11, 42]) => {
  const [x, y, size] = box;
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">${perforated(x, y, size)}${inner}</mask></defs>
    <rect x="${x - 4}" y="${y - 4}" width="${size + 8}" height="${size + 8}" fill="${c.paper}" mask="url(#${id})" ${attrs}/>`;
};
const wave = (y, x0 = 26, x1 = 62) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += 8) d += ` q2 -3 4 0 t4 0`;
  return d;
};

const directions = [
  {
    id: "s0-original",
    name: "S0 · Original stamp (round 2)",
    idea: "The round 2 stamp, unchanged: perforated edges, with an L cut through it.",
    verdict: "Still the cleanest at 16px. Everything below adds to it, and this is the baseline to compare against.",
    glyph: (c) => stamp(c, uid(), L(22, 20).replace("<path", '<path fill="#000"')),
  },
  {
    id: "s1-printed",
    name: "S1 · Printed stamp",
    idea: "Like a real stamp: a white perforated paper edge with a printed panel in the second tone and the L printed on it. Two layers give it depth without extra shapes.",
    verdict: "The most “real stamp”, and the richest at large sizes. At 16px the panel and paper still separate clearly. A strong candidate.",
    glyph: (c) => `${stamp(c, uid())}
      <rect x="16.5" y="16.5" width="31" height="31" rx="1.5" fill="${c.print}"/>
      <g fill="${c.paper}">${L(23, 21, 0.95)}</g>`,
  },
  {
    id: "s2-frame",
    name: "S2 · Framed stamp",
    idea: "The original stamp with a thin printed frame just inside the perforations, the detail that makes a stamp look engraved.",
    verdict: "A subtle, classy step up from S0 at large sizes. The frame disappears at 16px, which is fine: it falls back to S0.",
    glyph: (c) => stamp(c, uid(), `<rect x="15.5" y="15.5" width="33" height="33" fill="none" stroke="#000" stroke-width="1.4"/>${L(22, 20).replace("<path", '<path fill="#000"')}`),
  },
  {
    id: "s3-pair",
    name: "S3 · Stamp pair",
    idea: "Two stamps, the newest on top and slightly turned: a collection building up issue by issue.",
    verdict: "Ruled out. The back stamp reads as a smudge or rendering glitch rather than depth, especially on deep rose, and the two shapes compete at every size.",
    glyph: (c) => `<g transform="rotate(10 36 32)" opacity="1">${stamp({ paper: c.print }, uid(), "", "", [16, 9, 38])}</g>
      <g transform="rotate(-6 28 34)">${stamp(c, uid(), L(18, 22).replace("<path", '<path fill="#000"'), "", [8, 14, 38])}</g>`,
  },
  {
    id: "s4-postmark",
    name: "S4 · Postmarked",
    idea: "The stamp with the wavy cancellation lines of a postmark running across its top corner: it's been sent, it's arrived.",
    verdict: "Tells the “delivered” story, but drawn over the stamp the waves read as scribbles, and at 16px they become noise. The idea works better in S6, where the waves cross the printed panel in the paper colour.",
    glyph: (c) => `${stamp(c, uid(), L(22, 20).replace("<path", '<path fill="#000"'), "", [11, 13, 40])}
      <g fill="none" stroke="${c.print}" stroke-width="2.6" stroke-linecap="round">
        <path d="${wave(10, 28, 60)}"/><path d="${wave(17, 32, 60)}"/><path d="${wave(24, 38, 60)}"/>
      </g>`,
  },
  {
    id: "s5-curl",
    name: "S5 · Peeled corner",
    idea: "One corner of the stamp lifting off, as if it has just arrived or is being peeled from the sheet. A little bit of motion and freshness.",
    verdict: "Recommended. The most natural depth: a single shape that looks freshly arrived, peeling off the sheet. The curl reads clearly at 32px and above, and at 16px it becomes a clean cut corner, which still looks intentional.",
    glyph: (c) => {
      const id = uid();
      return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">${perforated(11, 11, 42)}
        <path d="M36 54 L54 36 L54 54 Z" fill="#000"/>${L(20, 18).replace("<path", '<path fill="#000"')}</mask></defs>
        <rect x="7" y="7" width="50" height="50" fill="${c.paper}" mask="url(#${id})"/>
        <path d="M36.5 53.5 L53.5 36.5 Q40 38 36.5 53.5 Z" fill="${c.print}"/>`;
    },
  },
  {
    id: "s6-printed-postmark",
    name: "S6 · Printed + postmarked",
    idea: "S1's printed stamp with S4's postmark waves crossing from the panel out past the edge: the most detailed, “illustrated” take.",
    verdict: "The best-looking at 128px and above, and perfect for the site hero or social image. Too busy for a favicon, so it would be the “full” version, with S1 as the small one.",
    glyph: (c) => `${stamp(c, uid(), "", "", [11, 13, 40])}
      <rect x="16" y="18" width="30" height="30" rx="1.5" fill="${c.print}"/>
      <g fill="${c.paper}">${L(22, 23, 0.9)}</g>
      <g fill="none" stroke="${c.paper}" stroke-width="2.2" stroke-linecap="round" opacity="0.95">
        <path d="${wave(22, 34, 62)}"/><path d="${wave(28, 38, 62)}"/>
      </g>`,
  },
  {
    id: "s7-shadow",
    name: "S7 · Lifted stamp",
    idea: "The original stamp sitting slightly above the tile, with a soft offset shadow in the second tone: the simplest way to add depth.",
    verdict: "A clean, modern depth effect that keeps S0's clarity at every size. An easy upgrade if S0 feels flat.",
    glyph: (c) => `<g transform="translate(2.5 3)">${stamp({ paper: c.print }, uid())}</g>
      ${stamp(c, uid(), L(22, 20).replace("<path", '<path fill="#000"'), "", [9.5, 9, 42])}`,
  },
];

function tile(d, cw) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${cw.tile}"/>${d.glyph(cw)}</svg>`;
}
function mark(d, colours) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${d.glyph(colours)}</svg>`;
}

const files = new Map();
const save = (name, svg) => {
  writeFileSync(join(OUT, name), svg);
  files.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
};
for (const d of directions) {
  for (const cw of colourways) save(`${d.id}-tile-${cw.id}.svg`, tile(d, cw));
  save(`${d.id}-mark.svg`, mark(d, markColours));
  save(`${d.id}-mono.svg`, mark(d, monoColours));
}

const img = (file, s) => `<img src="${files.get(file)}" width="${s}" height="${s}" alt="">`;
const glance = `
  <section><h2>At a glance: both colourways at 128, 32, and 16px</h2>
  <div class="glance">
    ${directions.map((d) => `<figure>${colourways.map((cw) => `<div class="sizes">${[128, 32, 16].map((s) => img(`${d.id}-tile-${cw.id}.svg`, s)).join("")}</div>`).join("")}<figcaption>${d.name}</figcaption></figure>`).join("")}
  </div></section>`;

const detail = (d) => `
  <section>
    <h2>${d.name}</h2>
    <p class="idea">${d.idea}</p>
    <p class="verdict"><strong>Assessment:</strong> ${d.verdict}</p>
    <div class="grid">
      ${colourways.map((cw) => `<div class="panel light">${[192, 64, 32, 16].map((s) => img(`${d.id}-tile-${cw.id}.svg`, s)).join("")}<span>${cw.name}</span></div>`).join("")}
      <div class="panel dark">${[64, 32, 16].map((s) => img(`${d.id}-tile-deep.svg`, s)).join("")}<span>On dark</span></div>
      <div class="panel light">${[96, 32, 16].map((s) => img(`${d.id}-mark.svg`, s)).join("")}<span>Mark</span></div>
      <div class="panel dark">${[96, 32, 16].map((s) => img(`${d.id}-mark.svg`, s)).join("")}<span>Mark on dark</span></div>
      <div class="panel light">${[96, 32, 16].map((s) => img(`${d.id}-mono.svg`, s)).join("")}<span>One colour</span></div>
      <div class="panel tabs">${colourways.map((cw) => `<div class="tab">${img(`${d.id}-tile-${cw.id}.svg`, 16)}LatestArr</div>`).join("")}<span>Browser tab</span></div>
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LatestArr icon exploration, round 3: the stamp (#269)</title>
<style>
  body { margin: 0; padding: 32px; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; background: #fbf5f7; color: #241521; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 4px; }
  .lede, .idea { color: #7c5a68; margin: 0 0 6px; max-width: 900px; } .verdict { margin: 0 0 10px; max-width: 900px; }
  .glance { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
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
<h1>LatestArr icon exploration, round 3: the postage stamp</h1>
<p class="lede">Variations on the round 2 stamp, each adding depth the way real stamps have it. S0 is the original, kept for comparison. Each is shown white on deep rose and in the current rose and ink. An icon family is also an option: a detailed version for large sizes (the site, social images) and a simpler one for the favicon. <strong>Recommendation: S5 (peeled corner), with S1 (printed) as the alternative. S7 (lifted) is the most subtle upgrade on S0. S6 could be the large-size illustration for either.</strong></p>
${glance}
${directions.map(detail).join("")}
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`Wrote ${directions.length} stamp variations × ${colourways.length} colourways to ${OUT}`);
