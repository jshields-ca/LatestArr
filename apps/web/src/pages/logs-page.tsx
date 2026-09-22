import { useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ApiError, listLogs, type LogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "success" | "destructive" | "warning";

const LEVEL_VARIANT: Record<LogEntry["levelLabel"], BadgeVariant> = {
  fatal: "destructive",
  error: "destructive",
  warn: "warning",
  info: "neutral",
  debug: "neutral",
  trace: "neutral",
};

const LEVEL_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All levels" },
  { value: "warn", label: "Warn & above" },
  { value: "error", label: "Error & above" },
];

// Fields already surfaced directly (time, level, levelLabel, msg) or too
// noisy to be worth a raw-details dump (pid, hostname, reqId — the same on
// nearly every line) are left out of what "Details" expands into.
const HIDDEN_DETAIL_KEYS = new Set(["time", "level", "levelLabel", "msg", "pid", "hostname", "reqId"]);

function formatTime(time: number): string {
  return new Date(time).toLocaleString();
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const details = Object.fromEntries(
    Object.entries(entry).filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && value !== undefined),
  );
  const hasDetails = Object.keys(details).length > 0;

  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-3",
        (entry.levelLabel === "error" || entry.levelLabel === "fatal") &&
          "border-l-4 border-l-destructive bg-destructive/5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={LEVEL_VARIANT[entry.levelLabel]}>{entry.levelLabel}</Badge>
          <span className="text-xs text-muted-foreground">{formatTime(entry.time)}</span>
        </div>
        {hasDetails ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
          >
            Details
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <p className="break-words text-sm">{entry.msg}</p>
      {expanded ? (
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 text-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listLogs({ level: (level || undefined) as LogEntry["levelLabel"] | undefined })
      .then(({ logs: loaded }) => setLogs(loaded))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load logs."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // level is the only dependency this effect should re-run for — load()
    // itself is a fresh closure every render (not memoized), including it
    // here would just re-trigger on every render instead of only on a
    // filter change.
  }, [level]);

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
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
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
        <ul className="flex flex-col gap-2">
          {logs.map((entry, index) => (
            <LogRow key={`${entry.time}-${index}`} entry={entry} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
