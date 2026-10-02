import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, DatabaseBackup, Download, Loader2, TriangleAlert, XCircle } from "lucide-react";

import { ConfirmDeleteButton, ListRow } from "@/components/list-row";
import { ScheduleField, type ScheduleMode } from "@/components/schedule-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  type BackupFile,
  type BackupOverview,
  type BackupRetention,
  type BackupTrigger,
  backupDownloadUrl,
  createBackupNow,
  deleteBackup,
  getBackups,
  saveBackupSettings,
} from "@/lib/api";
import {
  DEFAULT_SIMPLE_SCHEDULE,
  parseCronToSimpleSchedule,
  type SimpleSchedule,
  simpleScheduleToCron,
} from "@/lib/schedule";

const RESTORE_DOCS_URL = "https://github.com/jshields-ca/LatestArr/blob/main/docs/self-hosting.md#restoring-a-backup";

const TRIGGER_LABELS: Record<BackupTrigger, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  "pre-upgrade": "Before upgrade",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function StatusCard({ overview }: { overview: BackupOverview }) {
  const { lastRun, nextRun, settings } = overview;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6 text-sm">
        <div className="flex items-start gap-2">
          {lastRun === null ? (
            <DatabaseBackup className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : lastRun.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <p>
            {lastRun === null
              ? "No backups yet."
              : lastRun.ok
                ? `Last backup ${formatWhen(lastRun.at)} (${TRIGGER_LABELS[lastRun.trigger].toLowerCase()}).`
                : `The last backup failed, ${formatWhen(lastRun.at)}: ${lastRun.error ?? "unknown error"}`}
          </p>
        </div>
        <p className="pl-6 text-muted-foreground">
          {settings.enabled && nextRun ? `Next scheduled backup: ${formatWhen(nextRun)}.` : "Scheduled backups are off."}
        </p>
      </CardContent>
    </Card>
  );
}

function SettingsCard({ overview, onSaved }: { overview: BackupOverview; onSaved: (next: BackupOverview) => void }) {
  const saved = overview.settings;
  const [enabled, setEnabled] = useState(saved.enabled);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(() =>
    parseCronToSimpleSchedule(saved.scheduleCron) ? "simple" : "advanced",
  );
  const [simpleSchedule, setSimpleSchedule] = useState<SimpleSchedule>(
    () => parseCronToSimpleSchedule(saved.scheduleCron) ?? { ...DEFAULT_SIMPLE_SCHEDULE, frequency: "daily", hour: 3 },
  );
  const [advancedCron, setAdvancedCron] = useState(saved.scheduleCron);
  const [timezone, setTimezone] = useState(saved.timezone);
  const [mode, setMode] = useState<BackupRetention["mode"]>(saved.retention.mode);
  const [keep, setKeep] = useState(String(saved.retention.mode === "count" ? saved.retention.keep : 7));
  const [daily, setDaily] = useState(String(saved.retention.mode === "calendar" ? saved.retention.daily : 7));
  const [weekly, setWeekly] = useState(String(saved.retention.mode === "calendar" ? saved.retention.weekly : 4));
  const [monthly, setMonthly] = useState(String(saved.retention.mode === "calendar" ? saved.retention.monthly : 6));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const retention: BackupRetention =
      mode === "count"
        ? { mode, keep: Number(keep) }
        : { mode, daily: Number(daily), weekly: Number(weekly), monthly: Number(monthly) };
    setSaving(true);
    try {
      const next = await saveBackupSettings({
        enabled,
        scheduleCron: scheduleMode === "simple" ? simpleScheduleToCron(simpleSchedule) : advancedCron,
        timezone,
        retention,
      });
      onSaved(next);
      toast({ variant: "success", title: "Backup settings saved" });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the backup settings."));
    } finally {
      setSaving(false);
    }
  }

  const numberField = (id: string, label: string, value: string, onChange: (value: string) => void, max: number) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24"
        disabled={saving}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule and retention</CardTitle>
        <CardDescription>
          Old backups are only removed after a new one succeeds, and the newest is always kept. The last three
          made before an upgrade are kept regardless.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <SettingRow
            label="Back up on a schedule"
            htmlFor="backups-enabled"
            className="py-0"
            control={<Switch id="backups-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />}
          />
          {enabled ? (
            <ScheduleField
              idPrefix="backups"
              mode={scheduleMode}
              onModeChange={setScheduleMode}
              simple={simpleSchedule}
              onSimpleChange={setSimpleSchedule}
              scheduleCron={advancedCron}
              onScheduleCronChange={setAdvancedCron}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              disabled={saving}
            />
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="backups-retention">Which backups to keep</Label>
            <Select
              id="backups-retention"
              className="w-72"
              value={mode}
              disabled={saving}
              onChange={(e) => setMode(e.target.value === "calendar" ? "calendar" : "count")}
            >
              <option value="count">The most recent ones</option>
              <option value="calendar">Daily, weekly, and monthly ones</option>
            </Select>
          </div>
          {mode === "count" ? (
            numberField("backups-keep", "How many", keep, setKeep, 365)
          ) : (
            <div className="flex flex-wrap gap-4">
              {numberField("backups-daily", "Days", daily, setDaily, 90)}
              {numberField("backups-weekly", "Weeks", weekly, setWeekly, 52)}
              {numberField("backups-monthly", "Months", monthly, setMonthly, 120)}
            </div>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BackupRow({ backup, onDeleted }: { backup: BackupFile; onDeleted: (filename: string) => void }) {
  return (
    <ListRow
      leading={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <DatabaseBackup className="size-4" aria-hidden="true" />
        </span>
      }
      primary={
        <>
          <p className="truncate font-medium">{formatWhen(backup.createdAt)}</p>
          <Badge variant={backup.trigger === "pre-upgrade" ? "accent" : "neutral"}>{TRIGGER_LABELS[backup.trigger]}</Badge>
        </>
      }
      secondary={
        <p className="truncate text-sm text-muted-foreground">
          {backup.version === "earlier" ? "From before 0.12" : `LatestArr ${backup.version}`} · {formatSize(backup.sizeBytes)}
        </p>
      }
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <a href={backupDownloadUrl(backup.filename)} download aria-label={`Download the backup from ${formatWhen(backup.createdAt)}`}>
              <Download />
              Download
            </a>
          </Button>
          <ConfirmDeleteButton
            label={`Delete the backup from ${formatWhen(backup.createdAt)}`}
            onConfirm={() =>
              deleteBackup(backup.filename)
                .then(() => {
                  onDeleted(backup.filename);
                  toast({ variant: "success", title: "Backup deleted" });
                })
                .catch((err) => {
                  toast({ variant: "destructive", title: "Couldn't delete the backup", description: errorMessage(err, "") || undefined });
                  throw err;
                })
            }
          />
        </>
      }
    />
  );
}

export function BackupsPage() {
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  function load() {
    getBackups()
      .then(setOverview)
      .catch((err) => setLoadError(errorMessage(err, "Couldn't load backups.")));
  }

  useEffect(load, []);

  async function backUpNow() {
    setBackingUp(true);
    try {
      const { backup } = await createBackupNow();
      toast({ variant: "success", title: "Backed up", description: formatSize(backup.sizeBytes) });
    } catch (err) {
      toast({ variant: "destructive", title: "The backup failed", description: errorMessage(err, "") || undefined });
    } finally {
      setBackingUp(false);
      load();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Backups"
        description="Copies of LatestArr's database: sources, designs, newsletters, recipients, users, and send history. Made while LatestArr keeps running, and checked after each one."
        actions={
          overview ? (
            <Button onClick={() => void backUpNow()} disabled={backingUp}>
              {backingUp ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
              Back up now
            </Button>
          ) : null
        }
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {overview === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading backups...
        </div>
      ) : null}

      {overview ? (
        <>
          <StatusCard overview={overview} />

          {overview.location.sameDiskAsDatabase ? (
            <div role="note" className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <p>
                Backups are saved on the same disk as the database ({overview.location.path}), so a failed disk would
                take both. Set <code className="font-mono text-xs">BACKUP_PATH</code> to another disk, a NAS, or a
                folder your own backup tool copies off this machine.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Saved to <code className="font-mono text-xs">{overview.location.path}</code>.
            </p>
          )}

          <SettingsCard overview={overview} onSaved={setOverview} />

          <section className="flex flex-col gap-3" aria-labelledby="backups-list-heading">
            <h2 id="backups-list-heading" className="text-sm font-semibold">
              Saved backups
            </h2>
            {overview.backups.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet. Back up now, or wait for the schedule.</p>
            ) : (
              overview.backups.map((backup) => (
                <BackupRow
                  key={backup.filename}
                  backup={backup}
                  onDeleted={(filename) =>
                    setOverview((prev) => prev && { ...prev, backups: prev.backups.filter((b) => b.filename !== filename) })
                  }
                />
              ))
            )}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Keep them safe, and restoring one</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                Backups hold every recipient&apos;s email address and your send history, so keep them as private as the
                server. They don&apos;t include <code className="font-mono text-xs">ENCRYPTION_KEY</code>: keep a copy of it
                somewhere safe, or a restored backup&apos;s source and SMTP passwords can&apos;t be read.
              </p>
              <p>
                To restore one, run{" "}
                <code className="font-mono text-xs">docker exec -it latestarr node dist/cli.js restore &lt;file&gt;</code>
                , then restart LatestArr. The current database is kept, in case you change your mind.{" "}
                <a href={RESTORE_DOCS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  Step-by-step restore guide
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
