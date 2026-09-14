// Pulls one version's section out of CHANGELOG.md (between its own
// "## [X.Y.Z]" heading and the next one, or EOF) so the release workflow
// can use it verbatim as a GitHub Release body — one source of truth
// instead of a second, hand-maintained release-notes format.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node extract-changelog-section.mjs <version>");
  process.exit(1);
}

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const changelog = readFileSync(path.join(rootDir, "CHANGELOG.md"), "utf8");

const headingPattern = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\].*$`, "m");
const startMatch = changelog.match(headingPattern);
if (!startMatch) {
  console.error(`No CHANGELOG.md section found for version ${version}`);
  process.exit(1);
}

const startIndex = startMatch.index + startMatch[0].length;
const rest = changelog.slice(startIndex);
const nextHeadingIndex = rest.search(/^## \[/m);
const section = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);

process.stdout.write(section.trim() + "\n");
