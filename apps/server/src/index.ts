import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, runMigrations } from "@latestarr/db";
import { buildApp } from "./app.js";
import { startScheduler } from "./scheduler/engine.js";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "latestarr.db");
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = createDb(databasePath);
runMigrations(db);

const scheduler = await startScheduler(db);

// The Docker image copies apps/web's build output to ./public next to this
// file's compiled dist/ directory (see docker/Dockerfile); local dev has no
// such directory since Vite serves the frontend separately, and buildApp()
// only registers static serving when the path actually exists.
const staticRoot =
  process.env.STATIC_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const app = await buildApp(db, scheduler, { staticRoot });

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
