import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ApiError, listLogs, type LogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

const LIVE_POLL_MS = 3000;

const LEVEL_STYLES: Record<LogEntry["levelLabel"], string> = {
  fatal: "text-destructive",
  error: "text-destructive",
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

// Fields already surfaced directly (time, level, levelLabel, msg) or too
// noisy to be worth a raw-details dump (pid, hostname, reqId — the same on
// nearly every line) are left out of what expanding a line reveals.
const HIDDEN_DETAIL_KEYS = new Set(["time", "level", "levelLabel", "msg", "pid", "hostname", "reqId"]);

function formatClock(time: number): string {
  return new Date(time).toLocaleTimeString(undefined, { hour12: false });
}

function formatFullTime(time: number): string {
  return new Date(time).toLocaleString();
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
        "border-l-2 border-l-transparent px-3 py-1",
        (entry.levelLabel === "error" || entry.levelLabel === "fatal") && "border-l-destructive bg-destructive/10",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((e) => !e)}
        aria-expanded={hasDetails ? expanded : undefined}
        aria-label={hasDetails ? (expanded ? "Hide details" : "Show details") : undefined}
        disabled={!hasDetails}
        className={cn(
          "flex w-full items-start gap-2 text-left disabled:cursor-default",
          hasDetails && "cursor-pointer",
        )}
      >
        {hasDetails ? (
          <ChevronRight
            className={cn("mt-0.5 size-3 shrink-0 text-zinc-600 transition-transform", expanded && "rotate-90")}
            aria-hidden="true"
          />
        ) : (
          <span className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0 text-zinc-500" title={formatFullTime(entry.time)}>
          {formatClock(entry.time)}
        </span>
        <span className={cn("w-12 shrink-0 font-semibold uppercase", LEVEL_STYLES[entry.levelLabel])}>
          {entry.levelLabel}
        </span>
        <span className="min-w-0 flex-1 break-words text-zinc-200">{entry.msg}</span>
      </button>
      {expanded ? (
        <pre className="ml-9 mt-1 overflow-x-auto whitespace-pre-wrap break-words text-zinc-400">
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
    listLogs({ level: (levelRef.current || undefined) as LogEntry["levelLabel"] | undefined })
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
        description="Recent server activity — sends, source sync errors, auth events, and anything else worth troubleshooting. Routine request traffic is filtered out."
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading logs...
        </div>
      ) : null}

      {logs && logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No log entries to show.</p>
      ) : null}

      {logs && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs shadow-inner">
          <div className="max-h-[70vh] divide-y divide-zinc-900 overflow-y-auto py-1">
            {logs.map((entry, index) => (
              <LogLine key={`${entry.time}-${index}`} entry={entry} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
