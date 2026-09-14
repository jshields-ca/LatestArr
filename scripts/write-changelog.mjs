// Changesets' own per-package changelog generation (one CHANGELOG.md per
// workspace package, cross-referencing internal "Updated dependencies"
// bumps) makes sense for a library monorepo published to npm, but this is
// a single self-hosted app that ships as one Docker image — a self-hoster
// doesn't care that `@latestarr/adapter-plex` bumped internally. So
// `.changeset/config.json` sets `"changelog": false` (no per-package
// files) and this script writes ONE consolidated entry to the root
// CHANGELOG.md instead, run *before* `changeset version` deletes the
// pending changeset files.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const changesetDir = path.join(rootDir, ".changeset");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const rootPkgPath = path.join(rootDir, "package.json");

function parseChangeset(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatter, body] = match;
  const bumps = [...frontmatter.matchAll(/"[^"]+":\s*(major|minor|patch)/g)].map((m) => m[1]);
  const summary = body.trim();
  return { bumps, summary };
}

function bumpVersion(version, bumpType) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (bumpType === "major") return `${major + 1}.0.0`;
  if (bumpType === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const files = readdirSync(changesetDir)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .sort();

const changesets = files
  .map((f) => parseChangeset(path.join(changesetDir, f)))
  .filter((c) => c && c.summary.length > 0);

if (changesets.length === 0) {
  console.log("No pending changesets — nothing to write to CHANGELOG.md");
  process.exit(0);
}

const highestBump = changesets.some((c) => c.bumps.includes("major"))
  ? "major"
  : changesets.some((c) => c.bumps.includes("minor"))
    ? "minor"
    : "patch";

const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
const newVersion = bumpVersion(rootPkg.version, highestBump);
const today = new Date().toISOString().slice(0, 10);

const bullets = changesets.map((c) => `- ${c.summary.replace(/\n+/g, " ")}`).join("\n");
const newSection = `## [${newVersion}] - ${today}\n\n${bullets}\n\n`;

const changelog = readFileSync(changelogPath, "utf8");
const firstEntryIndex = changelog.search(/^## \[/m);
const insertAt = firstEntryIndex === -1 ? changelog.length : firstEntryIndex;
const updated = changelog.slice(0, insertAt) + newSection + changelog.slice(insertAt);

writeFileSync(changelogPath, updated);
console.log(`Wrote CHANGELOG.md entry for ${newVersion} (${changesets.length} changeset(s), ${highestBump} bump)`);
