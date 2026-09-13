import { mkdirSync } from "node:fs";
import path from "node:path";
import { createDb, runMigrations } from "@latestarr/db";
import { buildApp } from "./app.js";
import { startScheduler } from "./scheduler/engine.js";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "latestarr.db");
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = createDb(databasePath);
runMigrations(db);

const scheduler = await startScheduler(db);
const app = await buildApp(db, scheduler);

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
