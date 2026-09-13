// Changesets bumps every workspace package's version in lockstep (see
// .changeset/config.json's "fixed" group), but the root package.json isn't
// itself a workspace member, so it doesn't get touched by `changeset
// version`. Root's version is what README badges and `docker run --version`
// (once that exists) point to, so copy the now-bumped app version into it.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const serverPkgPath = path.join(rootDir, "apps/server/package.json");
const rootPkgPath = path.join(rootDir, "package.json");

const serverPkg = JSON.parse(readFileSync(serverPkgPath, "utf8"));
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));

if (rootPkg.version !== serverPkg.version) {
  rootPkg.version = serverPkg.version;
  writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
  console.log(`Synced root package.json version to ${serverPkg.version}`);
} else {
  console.log(`Root package.json already at ${rootPkg.version}, nothing to sync`);
}
