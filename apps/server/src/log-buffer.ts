import { Writable } from "node:stream";

export interface LogEntry {
  time: number;
  level: number;
  msg: string;
  err?: { type?: string; message?: string };
  [key: string]: unknown;
}

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];

// Fastify's built-in request logging emits exactly these two messages for
// every single request — capturing them would drown out the events an
// admin actually wants from a troubleshooting log (a failed send, an
// unreachable source, an auth failure) in routine traffic. Everything
// else — including request.log.error(...) calls with their own specific
// message, which still carry req/res context — is kept.
const ROUTINE_MESSAGES = new Set(["incoming request", "request completed"]);

/**
 * A pino destination stream that mirrors log output into a small in-memory
 * ring buffer, so GET /logs (apps/server/src/http/routes/logs.ts) has
 * something to read without standing up a log aggregator for a
 * single-instance self-hosted app. Wired in as one leg of a
 * pino.multistream alongside stdout — see app.ts.
 */
export const logBufferStream = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    try {
      for (const line of chunk.toString().split("\n")) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line) as LogEntry;
        if (ROUTINE_MESSAGES.has(entry.msg)) continue;
        buffer.push(entry);
        if (buffer.length > MAX_ENTRIES) buffer.shift();
      }
    } catch {
      // A malformed or split-across-chunks line shouldn't crash logging
      // itself — just skip capturing that one line into the buffer.
    }
    callback();
  },
});

/** Most recent entries first. */
export function getRecentLogs(limit = 200): LogEntry[] {
  return buffer.slice(-limit).reverse();
}

/** Test-only: clears the buffer between test runs. */
export function clearLogBuffer(): void {
  buffer.length = 0;
}
