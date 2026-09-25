// Builds a GitHub Release body for one version. CHANGELOG.md stays the
// detailed record (Technical details included); the release body is the
// short, user-facing version of the same section:
//
//   ## Highlights          <- .github/release-highlights/vX.Y.Z.md, if present
//   ## What's changed      <- CHANGELOG.md section, <details> blocks stripped
//   ## Upgrading           <- docker pull line, plus a note if migrations ran
//   Full changelog link    <- previous tag ... this tag
//
// Usage:
//   node scripts/build-release-notes.mjs <version> [previousTag]
//   node scripts/build-release-notes.mjs --check-highlights <version>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function highlightsPath(version) {
  return path.join(rootDir, ".github", "release-highlights", `v${version}.md`);
}

// HTML comments are stripped so the reminder template (all comments) counts
// as "not written yet" rather than publishing an empty Highlights section.
export function readHighlights(version) {
  const file = highlightsPath(version);
  if (!existsSync(file)) return null;
  const content = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  return content || null;
}

function readChangelogSection(version) {
  const changelog = readFileSync(path.join(rootDir, "CHANGELOG.md"), "utf8");
  const heading = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\].*$`, "m");
  const start = changelog.match(heading);
  if (!start) throw new Error(`No CHANGELOG.md section found for version ${version}`);
  const rest = changelog.slice(start.index + start[0].length);
  const next = rest.search(/^## \[/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function stripTechnicalDetails(section) {
  return section.replace(/[ \t]*<details>[\s\S]*?<\/details>/g, "").replace(/[ \t]+$/gm, "");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function findPreviousTag(version) {
  const tags = git(["tag", "--list", "v*"]).split("\n").filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
  const older = tags
    .map((t) => t.slice(1))
    .filter((v) => compareVersions(v, version) < 0)
    .sort(compareVersions);
  return older.length ? `v${older[older.length - 1]}` : null;
}

function addedMigrations(fromTag, toRef) {
  const out = git(["diff", "--name-only", "--diff-filter=A", `${fromTag}..${toRef}`, "--", "packages/db/drizzle"]);
  return out.split("\n").filter((f) => f.endsWith(".sql"));
}

function repoSlug() {
  const config = JSON.parse(readFileSync(path.join(rootDir, ".changeset", "config.json"), "utf8"));
  return Array.isArray(config.changelog) ? config.changelog[1]?.repo : undefined;
}

export function buildReleaseNotes(version, previousTag = findPreviousTag(version)) {
  const repo = repoSlug();
  const tag = `v${version}`;
  const toRef = git(["rev-parse", "--verify", "--quiet", tag]) ? tag : "HEAD";
  const parts = [];

  const highlights = readHighlights(version);
  if (highlights) parts.push(`## Highlights\n\n${highlights}`);

  parts.push(`## What's changed\n\n${stripTechnicalDetails(readChangelogSection(version))}`);

  const upgrading = [];
  if (previousTag && addedMigrations(previousTag, toRef).length > 0) {
    upgrading.push(
      "This release includes database changes. They're applied automatically the first time the new version starts. Back up your data volume first if you want an easy way to roll back.",
    );
  }
  if (repo) {
    upgrading.push(
      `\`\`\`bash\ndocker pull ghcr.io/${repo.toLowerCase()}:${tag}\n\`\`\`\n\nOr, with Docker Compose: \`docker compose pull && docker compose up -d\`.`,
    );
  }
  if (upgrading.length) parts.push(`## Upgrading\n\n${upgrading.join("\n\n")}`);

  if (repo && previousTag) {
    parts.push(
      `**Full changelog** (including technical details): [${previousTag}...${tag}](https://github.com/${repo}/compare/${previousTag}...${tag}) · [CHANGELOG.md](https://github.com/${repo}/blob/${tag}/CHANGELOG.md)`,
    );
  }

  return parts.join("\n\n") + "\n";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === "--check-highlights") {
    const version = args[1];
    if (!version) {
      console.error("Usage: node build-release-notes.mjs --check-highlights <version>");
      process.exit(1);
    }
    if (!readHighlights(version)) {
      const rel = path.relative(rootDir, highlightsPath(version)).replace(/\\/g, "/");
      console.error(
        `Release highlights for v${version} are missing or still only the template. Write them in ${rel} (see CONTRIBUTING.md, "Release highlights").`,
      );
      process.exit(1);
    }
    console.log(`Release highlights for v${version} found.`);
  } else {
    const [version, previousTag] = args;
    if (!version) {
      console.error("Usage: node build-release-notes.mjs <version> [previousTag]");
      process.exit(1);
    }
    try {
      process.stdout.write(buildReleaseNotes(version, previousTag || undefined));
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }
}
