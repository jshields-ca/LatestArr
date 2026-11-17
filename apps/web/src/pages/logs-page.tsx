import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingPlaceholder, Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ApiError, listLogs, type LogEntry } from "@/lib/api";
import { formatDay, formatExactDateTime, isSameDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const LIVE_POLL_MS = 3000;

// Fixed colours, not theme ones: the log panel is dark in both themes, and
// the light theme's red is too dark to read on it.
const LEVEL_STYLES: Record<LogEntry["levelLabel"], string> = {
  fatal: "text-red-400",
  error: "text-red-400",
  warn: "text-amber-400",
  info: "text-sky-300",
  debug: "text-zinc-400",
  trace: "text-zinc-500",
};

const LEVEL_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All levels" },
  { value: "warn", label: "Warn & above" },
  { value: "error", label: "Error & above" },
];

const EMPTY_MESSAGES: Record<string, string> = {
  "": "Nothing has been logged since the server last started.",
  warn: "No warnings or errors since the server last started.",
  error: "No errors since the server last started.",
};

// The server keeps this many entries (apps/server/src/log-buffer.ts); ask
// for all of them so the page matches its own description.
const LOG_LIMIT = 500;

// Fields already surfaced directly (time, level, levelLabel, msg) or too
// noisy to be worth a raw-details dump (pid, hostname, reqId — the same on
// nearly every line) are left out of what expanding a line reveals.
const HIDDEN_DETAIL_KEYS = new Set(["time", "level", "levelLabel", "msg", "pid", "hostname", "reqId"]);

function formatClock(time: number): string {
  return new Date(time).toLocaleTimeString(undefined, { hour12: false });
}

// A line over each day's entries (#454), so a time like 08:00 says which
// day it was. It stays at the top while that day's lines scroll past, and
// is a heading, so screen readers can jump from day to day.
function DayLine({ time }: { time: number }) {
  const date = new Date(time);
  const iso = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 bg-zinc-950 px-3 pt-2 pb-1">
      <h2 className="shrink-0 font-sans text-xs font-semibold text-zinc-300">
        <time dateTime={iso}>{formatDay(time)}</time>
      </h2>
      <span className="h-px flex-1 bg-zinc-800" aria-hidden="true" />
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const details = Object.fromEntries(
    Object.entries(entry).filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && value !== undefined),
  );
  const hasDetails = Object.keys(details).length > 0;

  return (
    <div
      className={cn(
        "border-l-2 border-l-transparent px-3",
        (entry.levelLabel === "error" || entry.levelLabel === "fatal") && "border-l-destructive bg-destructive/10",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((e) => !e)}
        // Named by the line itself (time, level, message), with
        // aria-expanded saying whether its details are showing. A separate
        // "Show details" label hid the text from voice control.
        aria-expanded={hasDetails ? expanded : undefined}
        title={hasDetails ? (expanded ? "Hide details" : "Show details") : undefined}
        disabled={!hasDetails}
        className={cn(
          // py-1 here, not on the row, makes the whole 24px line the target.
          "flex w-full items-start gap-2 py-1 text-left disabled:cursor-default",
          hasDetails && "cursor-pointer",
        )}
      >
        {hasDetails ? (
          <ChevronRight
            className={cn("mt-0.5 size-3 shrink-0 text-zinc-500 transition-transform", expanded && "rotate-90")}
            aria-hidden="true"
          />
        ) : (
          <span className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0 text-zinc-400" title={formatExactDateTime(entry.time)}>
          {formatClock(entry.time)}
        </span>
        <span className={cn("w-12 shrink-0 font-semibold uppercase", LEVEL_STYLES[entry.levelLabel])}>
          {entry.levelLabel}
        </span>
        <span className="min-w-0 flex-1 break-words text-zinc-200">{entry.msg}</span>
      </button>
      {expanded ? (
        <pre className="mb-1 ml-9 overflow-x-auto whitespace-pre-wrap break-words text-zinc-400">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const levelRef = useRef(level);
  levelRef.current = level;

  function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true);
    listLogs({ limit: LOG_LIMIT, level: (levelRef.current || undefined) as LogEntry["levelLabel"] | undefined })
      .then(({ logs: loaded }) => {
        setLogs(loaded);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load logs."))
      .finally(() => {
        if (!options.silent) setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // level is the only dependency this effect should re-run for — load()
    // itself is a fresh closure every render (not memoized), including it
    // here would just re-trigger on every render instead of only on a
    // filter change.
  }, [level]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => load({ silent: true }), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [live]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logs"
        description="What LatestArr has been doing: newsletter sends, delivery and source problems, sign-ins, and settings changes along with who made them. Shows the latest 500 entries since the server last started; the same lines appear in docker logs."
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Filter by level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-40"
            >
              {LEVEL_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((l) => !l)}
              aria-pressed={live}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  live ? "animate-pulse bg-primary-foreground" : "bg-muted-foreground",
                )}
                aria-hidden="true"
              />
              Live
            </Button>
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {logs === null && !error ? (
        <LoadingPlaceholder
          label="Loading logs..."
          className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-inner"
        >
          {["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/2", "w-3/5", "w-3/4", "w-2/5", "w-2/3", "w-1/2"].map((width, i) => (
            <Skeleton key={i} className={cn("h-3 bg-zinc-800", width)} />
          ))}
        </LoadingPlaceholder>
      ) : null}

      {logs && logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_MESSAGES[level] ?? EMPTY_MESSAGES[""]}</p>
      ) : null}

      {logs && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs shadow-inner">
          <div className="max-h-[70vh] divide-y divide-zinc-900 overflow-y-auto pb-1">
            {logs.map((entry, index) => (
              <Fragment key={`${entry.time}-${index}`}>
                {/* Newest first, so a new day starts wherever the one above is a later day. */}
                {index === 0 || !isSameDay(logs[index - 1].time, entry.time) ? <DayLine time={entry.time} /> : null}
                <LogLine entry={entry} />
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
