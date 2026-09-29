// Generates the icon exploration for #269: each direction as a tile icon
// (the app/favicon form), a bare mark, and a one-colour mark, plus a
// comparison sheet (index.html) showing them at real sizes on light and
// dark, next to the current icon. Run: node docs/assets/icon-exploration/generate.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

const ROSE = "#ef5d86"; // the current tile colour
const ROSE_DEEP = "#c31d4c"; // the UI accent
const INK = "#0e1425";

// Each glyph is drawn on a 64×64 grid, roughly inside 12..52, as markup
// using `ink` for the main colour; `soft` is the same colour at lower
// opacity, so every direction still prints in one colour.
const directions = [
  {
    id: "a-ribbon-l",
    verdict: "Strong runner-up. Reads as an L at every size and is unlike anything nearby. The fold and notch are subtle at 32px and below, so refining it means a bolder crease and a deeper notch.",
    name: "A · Folded ribbon L",
    idea: "One ribbon folded into an L, with a bookmark notch at its end: the “L”, a saved item, and a fold that reads as paper or mail without drawing an envelope.",
    glyph: (ink, soft) => `
      <path d="M17 12 H28 V39 L17 52 Z" fill="${ink}"/>
      <path d="M28 39 H52 L46.5 45.5 L52 52 H17 Z" fill="${soft}"/>`,
  },
  {
    id: "b-stack",
    verdict: "Weak. At small sizes it becomes the generic “layers” or “copy” icon found in every toolbar.",
    name: "B · Fresh stack",
    idea: "A stack of cards with the newest one on top: a digest of what's new, as a single solid shape.",
    glyph: (ink, soft) => `
      <rect x="23" y="12" width="29" height="21" rx="5" fill="${soft}" opacity="0.55"/>
      <rect x="17.5" y="19" width="29" height="21" rx="5" fill="${soft}"/>
      <rect x="12" y="26" width="30" height="26" rx="5.5" fill="${ink}"/>`,
  },
  {
    id: "c-l-digest",
    verdict: "Rejected. The rows turn the L into an “E”, which is exactly the kind of confusion to avoid.",
    name: "C · L digest",
    idea: "A list of items whose longest line becomes the base of an L: a newsletter's rows and the initial in one mark.",
    glyph: (ink) => `
      <rect x="13" y="12" width="10" height="40" rx="3" fill="${ink}"/>
      <rect x="27" y="14" width="13" height="7" rx="3.5" fill="${ink}"/>
      <rect x="27" y="28" width="19" height="7" rx="3.5" fill="${ink}"/>
      <rect x="13" y="42" width="39" height="10" rx="3" fill="${ink}"/>`,
  },
  {
    id: "d-poster-fan",
    verdict: "Says “media” most clearly, but turns into a blob at 16px, and the soft side posters look muddy on rose. It could work as an illustration, not as the icon.",
    name: "D · Poster fan",
    idea: "Three posters fanned out like new arrivals: media first, which sets it apart from mail and newsletter apps.",
    glyph: (ink, soft) => `
      <rect x="11" y="18" width="18" height="27" rx="3.5" fill="${soft}" transform="rotate(-14 20 45)"/>
      <rect x="35" y="18" width="18" height="27" rx="3.5" fill="${soft}" transform="rotate(14 44 45)"/>
      <rect x="22.5" y="13" width="19" height="29" rx="3.5" fill="${ink}"/>`,
  },
  {
    id: "e-l-new-dot",
    verdict: "Recommended. One bold glyph that stays crisp at 16px, reads as “L” plus “something new”, and isn't close to the *arr, Plex, Jellyfin, Tautulli, or mail-app icons. Refining it: weight balance, dot size and spacing, and corner radius matched to the UI.",
    name: "E · L with a “new” dot",
    idea: "A heavy L whose arm ends in a separate dot, the familiar “something new” badge. Monogram and meaning, with no extra symbol bolted on.",
    glyph: (ink) => `
      <path d="M14 13 a4 4 0 0 1 4 -4 h4 a4 4 0 0 1 4 4 V41 H44 a4 4 0 0 1 4 4 v4 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 Z" fill="${ink}"/>
      <circle cx="44" cy="22" r="7" fill="${ink}"/>`,
  },
  {
    id: "f-page-l",
    verdict: "Clear and legible, but a page with a folded corner is the standard “file” or “document” icon, so it's less distinctive.",
    name: "F · Page with an L",
    idea: "A page with a folded corner and an L cut through it: an issue of a newsletter, named by its initial.",
    glyph: (ink, soft) => `
      <path fill-rule="evenodd" fill="${ink}" d="M17 10 H38 L49 21 V50 a4 4 0 0 1 -4 4 H17 a4 4 0 0 1 -4 -4 V14 a4 4 0 0 1 4 -4 Z M22 20 V45 H40 V39 H28 V20 Z"/>
      <path d="M38 10 V21 H49 Z" fill="${soft}"/>`,
  },
];

const current = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${ROSE}"/><path d="M8.5 13h13v8.5h-13z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 13l6.5 5 6.5-5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 3.4 L25.9 7.1 L29.6 9 L25.9 10.9 L24 14.6 L22.1 10.9 L18.4 9 L22.1 7.1 Z" fill="${INK}"/></svg>`;

const softOf = (hex) => `${hex}99`; // same colour at 60%, so it's still one ink

function tile(d) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${ROSE}"/>${d.glyph(INK, softOf(INK))}</svg>`;
}
function mark(d, colour) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${d.glyph(colour, softOf(colour))}</svg>`;
}

// The sheet embeds every image as a data: URI, so index.html is one
// self-contained file that opens anywhere.
const files = new Map();
const save = (name, svg) => {
  writeFileSync(join(OUT, name), svg);
  files.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
};
save("current.svg", current);
for (const d of directions) {
  save(`${d.id}-tile.svg`, tile(d));
  save(`${d.id}-mark.svg`, mark(d, ROSE_DEEP));
  save(`${d.id}-mono.svg`, mark(d, "#000000"));
}

const sizes = [256, 64, 32, 16];
const row = (name, idea, tileFile, markFile, monoFile, verdict) => `
  <section>
    <h2>${name}</h2>
    ${idea ? `<p class="idea">${idea}</p>` : ""}
    ${verdict ? `<p class="verdict"><strong>Assessment:</strong> ${verdict}</p>` : ""}
    <div class="grid">
      <div class="panel light">${sizes.map((s) => `<img src="${files.get(tileFile)}" width="${s}" height="${s}" alt="">`).join("")}<span>Tile · 256 / 64 / 32 / 16</span></div>
      <div class="panel dark">${sizes.slice(1).map((s) => `<img src="${files.get(tileFile)}" width="${s}" height="${s}" alt="">`).join("")}<span>On dark</span></div>
      ${markFile ? `<div class="panel light">${[96, 32, 16].map((s) => `<img src="${files.get(markFile)}" width="${s}" height="${s}" alt="">`).join("")}<span>Mark, rose</span></div>` : ""}
      ${markFile ? `<div class="panel dark">${[96, 32, 16].map((s) => `<img src="${files.get(markFile)}" width="${s}" height="${s}" alt="">`).join("")}<span>Mark on dark</span></div>` : ""}
      ${monoFile ? `<div class="panel light">${[96, 32, 16].map((s) => `<img src="${files.get(monoFile)}" width="${s}" height="${s}" alt="">`).join("")}<span>One colour</span></div>` : ""}
      <div class="panel tabs">${["current.svg", tileFile].filter((f, i, a) => a.indexOf(f) === i).map((f) => `<div class="tab"><img src="${files.get(f)}" width="16" height="16" alt="">LatestArr</div>`).join("")}<span>In a browser tab</span></div>
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LatestArr icon exploration (#269)</title>
<style>
  body { margin: 0; padding: 32px; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; background: #fbf5f7; color: #241521; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 2px; }
  .verdict { margin: 0 0 10px; max-width: 900px; }
  .lede, .idea { color: #7c5a68; margin: 0 0 10px; max-width: 900px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; }
  .panel { position: relative; display: flex; align-items: flex-end; gap: 14px; padding: 16px 16px 30px; border-radius: 12px; border: 1px solid #e9dbe0; }
  .panel span { position: absolute; left: 16px; bottom: 8px; font-size: 11px; color: #9c8290; }
  .light { background: #fff; } .dark { background: #0e1425; border-color: #1f2a44; } .dark span { color: #8a94ad; }
  .tabs { flex-direction: column; align-items: flex-start; gap: 6px; background: #dfe3ea; }
  .glance { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  figure { margin: 0; padding: 14px; background: #fff; border: 1px solid #e9dbe0; border-radius: 12px; }
  .sizes { display: flex; align-items: flex-end; gap: 10px; }
  figcaption { margin-top: 8px; font-size: 12px; color: #7c5a68; }
  .tab { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 8px 8px 0 0; padding: 6px 12px; font-size: 12px; min-width: 140px; }
</style></head><body>
<h1>LatestArr icon exploration</h1>
<p class="lede">Six single-shape directions for <a href="https://github.com/jshields-ca/LatestArr/issues/269">#269</a>, each shown as the app tile, a bare mark in the rose accent, and one colour, at real sizes on light and dark, and in a browser tab beside the current icon. These are first-round sketches to pick a direction from, not finished artwork. <strong>Recommendation: E, with A as the alternative.</strong></p>
<section><h2>At a glance</h2><div class="glance">${[["Current","current.svg"],...directions.map((d)=>[d.name.split(" · ")[0] + " · " + d.name.split(" · ")[1],`${d.id}-tile.svg`])].map(([n,file])=>`<figure><div class="sizes"><img src="${files.get(file)}" width="96" height="96" alt=""><img src="${files.get(file)}" width="32" height="32" alt=""><img src="${files.get(file)}" width="16" height="16" alt=""></div><figcaption>${n}</figcaption></figure>`).join("")}</div></section>
${row("Current · envelope + sparkle", "", "current.svg", null, null)}
${directions.map((d) => row(d.name, d.idea, `${d.id}-tile.svg`, `${d.id}-mark.svg`, `${d.id}-mono.svg`, d.verdict)).join("")}
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`Wrote ${directions.length} directions to ${OUT}`);
