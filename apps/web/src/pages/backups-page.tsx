import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  DatabaseBackup,
  Download,
  FolderOpen,
  KeyRound,
  Loader2,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { ConfirmDeleteButton } from "@/components/list-row";
import { ScheduleField, type ScheduleMode } from "@/components/schedule-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveActions } from "@/components/ui/save-actions";
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
  type BackupSettings,
  type BackupTrigger,
  backupDownloadUrl,
  createBackupNow,
  deleteBackup,
  getBackups,
  saveBackupSettings,
} from "@/lib/api";
import {
  DEFAULT_SIMPLE_SCHEDULE,
  formatScheduleForDisplay,
  parseCronToSimpleSchedule,
  type SimpleSchedule,
  simpleScheduleToCron,
} from "@/lib/schedule";
import { saveShortcutRef, useSavedSnapshot, useUnsavedChanges } from "@/lib/unsaved-changes";

const RESTORE_DOCS_URL = "https://github.com/jshields-ca/LatestArr/blob/main/docs/self-hosting.md#restoring-a-backup";
const BACKUP_PATH_DOCS_URL = "https://github.com/jshields-ca/LatestArr/blob/main/docs/self-hosting.md#backups";

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

function retentionSummary(retention: BackupRetention): string {
  return retention.mode === "count"
    ? `keeps the latest ${retention.keep}`
    : `keeps ${retention.daily} daily, ${retention.weekly} weekly, and ${retention.monthly} monthly`;
}

// "Daily at 3:00 AM (UTC), keeps the latest 7", for the settings card's header.
function settingsSummary(settings: BackupSettings): string {
  const schedule = settings.enabled ? formatScheduleForDisplay(settings.scheduleCron, settings.timezone) : "Scheduled backups are off";
  return `${schedule}, ${retentionSummary(settings.retention)}.`;
}

// One fact in the status card: an icon, a label, and its value.
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 pl-6 text-sm">{children}</dd>
    </div>
  );
}

// "Am I protected?" at a glance. The last backup comes from the files
// actually in the backup folder, so it always agrees with the list below,
// unless the most recent attempt failed, which is shown instead.
function StatusCard({ overview }: { overview: BackupOverview }) {
  const { lastRun, nextRun, settings, location, backups } = overview;
  const newest = backups[0];
  const failed = lastRun && !lastRun.ok && (!newest || lastRun.at > newest.createdAt) ? lastRun : null;
  const totalBytes = backups.reduce((sum, backup) => sum + backup.sizeBytes, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact
            icon={
              failed ? (
                <XCircle className="text-destructive" aria-hidden="true" />
              ) : newest ? (
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <DatabaseBackup aria-hidden="true" />
              )
            }
            label="Last backup"
          >
            {failed ? (
              <span className="text-destructive">
                The last backup failed, {formatWhen(failed.at)}: {failed.error ?? "unknown error"}
              </span>
            ) : newest ? (
              <>
                {formatWhen(newest.createdAt)}{" "}
                <span className="text-muted-foreground">({TRIGGER_LABELS[newest.trigger].toLowerCase()})</span>
              </>
            ) : (
              "No backups yet."
            )}
          </Fact>
          <Fact icon={<CalendarClock aria-hidden="true" />} label="Next backup">
            {settings.enabled && nextRun ? formatWhen(nextRun) : <span className="text-muted-foreground">Scheduled backups are off.</span>}
          </Fact>
          <Fact icon={<FolderOpen aria-hidden="true" />} label="Saved to">
            <code className="break-all font-mono text-xs">{location.path}</code>
          </Fact>
          <Fact icon={<DatabaseBackup aria-hidden="true" />} label="Stored">
            {backups.length === 0
              ? "None"
              : `${backups.length} ${backups.length === 1 ? "backup" : "backups"}, ${formatSize(totalBytes)}`}
          </Fact>
        </dl>
        {location.sameDiskAsDatabase ? (
          <div role="note" className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <p>
              <span className="font-medium">On the same disk as the database,</span> so a failed disk would take both.
              Set <code className="font-mono text-xs">BACKUP_PATH</code> to another disk, a NAS, or a folder your own
              backup tool copies off this machine.{" "}
              <a href={BACKUP_PATH_DOCS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                How to set it
              </a>
              .
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BackupRow({ backup, onDeleted }: { backup: BackupFile; onDeleted: (filename: string) => void }) {
  const when = formatWhen(backup.createdAt);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{when}</p>
          <Badge variant={backup.trigger === "pre-upgrade" ? "accent" : "neutral"}>{TRIGGER_LABELS[backup.trigger]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {backup.version === "earlier" ? "From before 0.12" : `LatestArr ${backup.version}`} · {formatSize(backup.sizeBytes)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" asChild>
          <a href={backupDownloadUrl(backup.filename)} download aria-label={`Download the backup from ${when}`}>
            <Download />
            Download
          </a>
        </Button>
        <ConfirmDeleteButton
          label={`Delete the backup from ${when}`}
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
      </div>
    </li>
  );
}

function BackupsCard({ backups, onDeleted }: { backups: BackupFile[]; onDeleted: (filename: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle id="backups-list-heading">Saved backups</CardTitle>
        <CardDescription>Newest first. Each one is a single .zip file you can download.</CardDescription>
      </CardHeader>
      <CardContent>
        {backups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
            <DatabaseBackup className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">None yet. Back up now, or wait for the schedule.</p>
          </div>
        ) : (
          <ul aria-labelledby="backups-list-heading" className="flex flex-col divide-y divide-border">
            {backups.map((backup) => (
              <BackupRow key={backup.filename} backup={backup} onDeleted={onDeleted} />
            ))}
          </ul>
        )}
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

  function currentSettings() {
    const retention: BackupRetention =
      mode === "count"
        ? { mode, keep: Number(keep) }
        : { mode, daily: Number(daily), weekly: Number(weekly), monthly: Number(monthly) };
    return {
      enabled,
      scheduleCron: scheduleMode === "simple" ? simpleScheduleToCron(simpleSchedule) : advancedCron,
      timezone,
      retention,
    };
  }
  const { dirty, markSaved } = useSavedSnapshot(currentSettings());
  useUnsavedChanges(dirty);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const next = await saveBackupSettings(currentSettings());
      onSaved(next);
      markSaved();
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
        <CardDescription>{settingsSummary(saved)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={saveShortcutRef} className="flex max-w-xl flex-col gap-5" onSubmit={handleSubmit} noValidate>
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
          <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
            <legend className="sr-only">Retention</legend>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backups-retention">Which backups to keep</Label>
                <Select
                  id="backups-retention"
                  className="w-64"
                  value={mode}
                  disabled={saving}
                  onChange={(e) => setMode(e.target.value === "calendar" ? "calendar" : "count")}
                >
                  <option value="count">The most recent ones</option>
                  <option value="calendar">Daily, weekly, and monthly ones</option>
                </Select>
              </div>
              {mode === "count" ? numberField("backups-keep", "How many", keep, setKeep, 365) : null}
            </div>
            {mode === "calendar" ? (
              <div className="flex flex-wrap gap-4">
                {numberField("backups-daily", "Days", daily, setDaily, 90)}
                {numberField("backups-weekly", "Weeks", weekly, setWeekly, 52)}
                {numberField("backups-monthly", "Months", monthly, setMonthly, 120)}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Old backups are only removed after a new one succeeds, and the newest is always kept. The last three made
              before an upgrade are kept regardless.
            </p>
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <SaveActions dirty={dirty} saving={saving} label="Save" align="start" />
        </form>
      </CardContent>
    </Card>
  );
}

// A shell command with a copy button.
function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy", description: "Select the command and copy it instead." });
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 break-all py-1 font-mono text-xs">{command}</code>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => void copy()} aria-label={`Copy: ${command}`}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function RestoreCard({ newest }: { newest: BackupFile | undefined }) {
  const file = newest?.filename ?? "<file>";
  const steps = [
    { title: "Check it (optional)", command: `docker exec -it latestarr node dist/cli.js check-backup ${file}` },
    { title: "Stage the restore", command: `docker exec -it latestarr node dist/cli.js restore ${file}` },
    { title: "Restart to swap it in", command: "docker restart latestarr" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restoring a backup</CardTitle>
        <CardDescription>
          Run these on the server. {newest ? "They use your newest backup; swap in another file's name from the list. " : ""}
          If your container has a different name, use that instead of latestarr.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-sm font-medium">{step.title}</p>
                <Command command={step.command} />
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Your current database is kept beside it, renamed <code className="font-mono text-xs">latestarr.db.before-restore-&lt;time&gt;</code>,
          in case you change your mind.{" "}
          <a href={RESTORE_DOCS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Full restore guide
          </a>
          .
        </p>
        <div className="flex gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-sm">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Keep ENCRYPTION_KEY safe, separately.</span> Backups don&apos;t
            include it, so without it a restored backup&apos;s source and SMTP passwords can&apos;t be read. Backups hold
            every recipient&apos;s email address and your send history, so keep them as private as the server.
          </p>
        </div>
      </CardContent>
    </Card>
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
        description="Checked copies of everything LatestArr keeps, made while it runs."
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
          <BackupsCard
            backups={overview.backups}
            onDeleted={(filename) =>
              setOverview((prev) => prev && { ...prev, backups: prev.backups.filter((b) => b.filename !== filename) })
            }
          />
          <SettingsCard overview={overview} onSaved={setOverview} />
          <RestoreCard newest={overview.backups[0]} />
        </>
      ) : null}
    </div>
  );
}
