import type { FastifyBaseLogger } from "fastify";
import pino from "pino";
import { logBufferStream } from "./log-buffer.js";

// Fastify's logger interface, so a route's request.log (a child that also
// carries the request id and user) can be passed wherever this is expected.
export type Logger = FastifyBaseLogger;

// One process-wide logger, shared by Fastify (as its loggerInstance), the
// send pipeline, and the scheduler — so a scheduled send, which has no
// request to hang a logger off, still reaches the Logs page.
//
// pino's destination is its *second* argument: pino(multistreamResult)
// alone silently falls back to its default stdout destination and never
// writes to any custom stream in the multistream array.
const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase() || "info";
const validLevel = requestedLevel in pino.levels.values || requestedLevel === "silent";

export const logger: Logger = pino(
  {
    level: validLevel ? requestedLevel : "info",
    // Nothing logs these today; this keeps a future log line (or an error
    // carrying a request or config) from writing a secret out.
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "*.password",
        "*.passwordHash",
        "*.currentPassword",
        "*.newPassword",
        "*.apiKey",
        "*.token",
        "*.credentials",
        "*.clientSecret",
        "*.authPass",
      ],
      censor: "[redacted]",
    },
  },
  pino.multistream([
    { stream: process.stdout, level: "trace" },
    { stream: logBufferStream, level: "trace" },
  ]),
);

// A typo in .env shouldn't stop the container from starting (pino throws on
// an unknown level), so fall back to the default and say why.
if (!validLevel) {
  logger.warn(`Unknown LOG_LEVEL "${process.env.LOG_LEVEL}"; using "info". Valid levels: ${Object.keys(pino.levels.values).join(", ")}`);
}
