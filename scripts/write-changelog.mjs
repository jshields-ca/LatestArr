// Changesets also writes its own per-package CHANGELOG.md files (one per
// workspace package, cross-referencing internal "Updated dependencies"
// bumps) — `changesets/action` reads those to build the "Version
// Packages" PR's own description, so they have to keep existing even
// though this is a single self-hosted app, not a set of independently-
// consumed libraries. This script instead gives *people* a single
// source of truth: one consolidated entry in the root CHANGELOG.md,
// written from the pending changeset files *before* `changeset version`
// deletes them. That's what the release workflow pulls from for actual
// release notes — the scattered per-package files are internal
// bookkeeping a self-hoster never needs to look at.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCommitInfo } from "@changesets/get-github-info";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const changesetDir = path.join(rootDir, ".changeset");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const rootPkgPath = path.join(rootDir, "package.json");
const changesetConfigPath = path.join(changesetDir, "config.json");

// Matches the category tags CONTRIBUTING.md's "Writing a changeset"
// section asks every changeset to start with. A changeset that doesn't
// follow the convention (e.g. one written before this convention existed)
// still renders — it just lands in "Other" with no lede/details split —
// rather than being silently dropped.
const CATEGORY_ORDER = ["New", "Improved", "Fixed", "Other"];

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

// Every changeset in this repo lands on main as a single squash-merge
// commit, so the commit that added its .md file *is* the commit
// `getCommitInfo` needs to look up the PR it came from. Returns null
// (never throws) if git can't find one — e.g. a changeset file staged
// but not yet committed during local testing.
function findIntroducingCommit(filePath) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%H", "--", filePath], {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// Resolves a changeset file to the PR that carried it, for an inline
// "([#123](...))" link on its CHANGELOG.md bullet. Best-effort only —
// this script runs as part of the automated release pipeline, and a
// missing link is a cosmetic issue, never a reason to fail a release:
// no GITHUB_TOKEN (e.g. a local dry run), a network hiccup, or GitHub not
// yet having indexed a very fresh commit all degrade to "no link".
async function resolvePrLink(filePath, repo) {
  if (!repo || !process.env.GITHUB_TOKEN) return null;
  const commit = findIntroducingCommit(filePath);
  if (!commit) return null;
  try {
    const info = await getCommitInfo({ repo, commit });
    return info?.pull ? { number: info.pull.number, url: info.pull.url } : null;
  } catch (err) {
    console.warn(`Couldn't resolve a PR link for ${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

// Splits a changeset body into its category, its plain-language lede
// (the bit that should be visible at a glance, before any PR link), and
// the rest (a <details> technical block, if present) — so the lede and
// link can sit together on one line ahead of the collapsed details,
// rather than the link landing wherever the flattened text happens to end.
function splitChangeset(summary) {
  const flat = summary.replace(/\n+/g, " ").trim();
  const categoryMatch = flat.match(/^\*\*(New|Improved|Fixed):\*\*\s*/);
  const category = categoryMatch ? categoryMatch[1] : "Other";
  const withoutTag = categoryMatch ? flat.slice(categoryMatch[0].length) : flat;
  const detailsIndex = withoutTag.indexOf("<details>");
  const lede = detailsIndex === -1 ? withoutTag : withoutTag.slice(0, detailsIndex).trim();
  const rest = detailsIndex === -1 ? "" : ` ${withoutTag.slice(detailsIndex)}`;
  return { category, lede, rest };
}

function formatBullet({ lede, rest }, prLink) {
  const link = prLink ? ` ([#${prLink.number}](${prLink.url}))` : "";
  return `- ${lede}${link}${rest}`;
}

const files = readdirSync(changesetDir)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .sort();

const changesets = files
  .map((f) => ({ file: f, ...parseChangeset(path.join(changesetDir, f)) }))
  .filter((c) => c && c.summary && c.summary.length > 0);

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

// Single source of truth for the GitHub repo slug, shared with
// changeset version's own per-package changelogs (see .changeset/config.json).
const changesetConfig = JSON.parse(readFileSync(changesetConfigPath, "utf8"));
const repo = Array.isArray(changesetConfig.changelog) ? changesetConfig.changelog[1]?.repo : undefined;

let linksResolved = 0;
const entries = [];
for (const c of changesets) {
  const split = splitChangeset(c.summary);
  const prLink = await resolvePrLink(path.join(changesetDir, c.file), repo);
  if (prLink) linksResolved++;
  entries.push({ ...split, bullet: formatBullet(split, prLink) });
}

const byCategory = new Map();
for (const entry of entries) {
  if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
  byCategory.get(entry.category).push(entry.bullet);
}

const sections = CATEGORY_ORDER.filter((category) => byCategory.has(category))
  .map((category) => `### ${category}\n\n${byCategory.get(category).join("\n")}`)
  .join("\n\n");

const newSection = `## [${newVersion}] - ${today}\n\n${sections}\n\n`;

const changelog = readFileSync(changelogPath, "utf8");
const firstEntryIndex = changelog.search(/^## \[/m);
const insertAt = firstEntryIndex === -1 ? changelog.length : firstEntryIndex;
const updated = changelog.slice(0, insertAt) + newSection + changelog.slice(insertAt);

writeFileSync(changelogPath, updated);
console.log(
  `Wrote CHANGELOG.md entry for ${newVersion} (${changesets.length} changeset(s), ${highestBump} bump, ${linksResolved} PR link(s) resolved)`,
);
