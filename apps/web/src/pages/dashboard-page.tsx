import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ListChecks,
  Mail,
  Palette,
  Send,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useHasRole } from "@/components/auth-provider";
import { SendRunHistoryList } from "@/components/send-run-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingPlaceholder, Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  ApiError,
  getNotificationSettings,
  listGroups,
  listNewsletters,
  listRecipients,
  listSendRuns,
  listSmtpProfiles,
  listSources,
  listTemplates,
  listUsers,
  type Newsletter,
  type Recipient,
  type RecipientGroup,
  type SendRun,
  type SmtpProfile,
  type SourceConnection,
  type Template,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// Whether the setup checklist should default to its compact "Setup
// complete" summary. It's set the first time the checklist is seen fully
// done, and toggled again whenever the user expands/collapses it by hand —
// so re-opening it to double-check something "sticks" for next time, but a
// brand-new completion always starts collapsed rather than surprising a
// returning user with a suddenly-expanded card.
const CHECKLIST_EXPANDED_STORAGE_KEY = "latestarr:dashboard-checklist-expanded";

function readStoredChecklistExpanded(): boolean {
  try {
    return window.localStorage.getItem(CHECKLIST_EXPANDED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredChecklistExpanded(expanded: boolean) {
  try {
    window.localStorage.setItem(CHECKLIST_EXPANDED_STORAGE_KEY, String(expanded));
  } catch {
    // Best-effort only — a private window or blocked storage just means the
    // checklist won't remember its state across reloads.
  }
}

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  optional?: boolean;
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <Link
      to={item.href}
      className="-mx-2 flex items-start gap-3 rounded-md px-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-accent/50"
    >
      {item.done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {item.done ? <span className="sr-only">Done: </span> : null}
          {item.label}
          {item.optional ? <Badge variant="accent">Optional</Badge> : null}
        </span>
        <span className="text-sm text-muted-foreground">{item.description}</span>
      </div>
    </Link>
  );
}

// Every icon chip on this page — the stat tiles, the checklist header and
// the Recent sends header — is one pattern: a rose icon on a neutral
// circle. Colour is kept for meaning (#332), so only the checklist's
// "done" chip is green.
const CARD_ICON_ACCENTS = {
  neutral: "bg-muted text-primary",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
} as const;

function CardIconChip({
  icon: Icon,
  accent,
  size = "size-9",
  iconSize = "size-4",
}: {
  icon: LucideIcon;
  accent: keyof typeof CARD_ICON_ACCENTS;
  size?: string;
  iconSize?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size,
        CARD_ICON_ACCENTS[accent],
      )}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </span>
  );
}

// The dashboard as it is once set up: the title, the checklist's one-line
// summary (admins), the tiles and Recent sends. A first run shows the
// checklist instead of the tiles, and settles when it loads.
function DashboardSkeleton({ showChecklist, tiles }: { showChecklist: boolean; tiles: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={<Skeleton className="my-0.5 h-4 w-72 max-w-full" />} />
      <LoadingPlaceholder label="Loading dashboard..." className="flex flex-col gap-6">
        {showChecklist ? (
          <Card>
            <div className="flex items-center gap-3 px-6 py-4">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-4 w-36" />
            </div>
          </Card>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="size-11 shrink-0 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </CardContent>
        </Card>
      </LoadingPlaceholder>
    </div>
  );
}

function StatCard({
  label,
  value,
  secondary,
  href,
  icon,
}: {
  label: string;
  value: number;
  secondary?: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link to={href} className="group block">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-elevated group-hover:border-primary/40">
        <CardContent className="flex items-center gap-4 p-4">
          <CardIconChip icon={icon} accent="neutral" size="size-11" iconSize="size-5" />
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            {secondary ? (
              <p className="truncate text-xs text-muted-foreground">{secondary}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

type RecentRun = SendRun & { newsletterName: string };

export function DashboardPage() {
  const isAdmin = useHasRole("admin");
  const canEdit = useHasRole("editor");
  const [sources, setSources] = useState<SourceConnection[] | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [groups, setGroups] = useState<RecipientGroup[] | null>(null);
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[] | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[] | null>(null);
  // Only feed the optional checklist items, so a failure just leaves them unticked.
  const [alertsOn, setAlertsOn] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpandedState] = useState(readStoredChecklistExpanded);

  function setChecklistExpanded(expanded: boolean) {
    setChecklistExpandedState(expanded);
    writeStoredChecklistExpanded(expanded);
  }

  useEffect(() => {
    function fail(err: unknown) {
      setLoadError(
        (prev) => prev ?? (err instanceof ApiError ? err.message : "Failed to load dashboard data."),
      );
    }
    listSources().then(({ sources }) => setSources(sources)).catch(fail);
    // Each role loads only what it can see; the rest stays empty.
    if (canEdit) {
      listRecipients().then(({ recipients }) => setRecipients(recipients)).catch(fail);
      listGroups().then(({ groups }) => setGroups(groups)).catch(fail);
      listSmtpProfiles().then(({ smtpProfiles }) => setSmtpProfiles(smtpProfiles)).catch(fail);
    } else {
      setRecipients([]);
      setGroups([]);
      setSmtpProfiles([]);
    }
    listTemplates().then(({ templates }) => setTemplates(templates)).catch(fail);
    listNewsletters().then(({ newsletters }) => setNewsletters(newsletters)).catch(fail);
    if (isAdmin) {
      getNotificationSettings()
        .then(({ settings }) =>
          setAlertsOn((settings.onFailure || settings.onPartialFailure) && (settings.email.enabled || settings.webhook.enabled)),
        )
        .catch(() => undefined);
      listUsers()
        .then(({ users }) => setUserCount(users.length))
        .catch(() => undefined);
    }
  }, [canEdit, isAdmin]);

  useEffect(() => {
    if (newsletters === null) return;
    if (newsletters.length === 0) {
      setRecentRuns([]);
      return;
    }
    Promise.all(
      newsletters.map((newsletter) =>
        listSendRuns(newsletter.id)
          .then(({ sendRuns }) =>
            sendRuns.slice(0, 3).map((run) => ({ ...run, newsletterName: newsletter.name })),
          )
          .catch(() => [] as RecentRun[]),
      ),
    ).then((groupedRuns) => {
      const merged = groupedRuns.flat().sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return bTime - aTime;
      });
      setRecentRuns(merged.slice(0, 5));
    });
  }, [newsletters]);

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  const loading = [sources, recipients, groups, smtpProfiles, templates, newsletters].some(
    (value) => value === null,
  );

  if (loading) {
    return (
      <DashboardSkeleton showChecklist={isAdmin} tiles={canEdit ? 4 : 3} />
    );
  }

  const hasRecipientsAndGroups = (recipients?.length ?? 0) > 0 && (groups?.length ?? 0) > 0;

  const checklist: ChecklistItem[] = [
    {
      key: "source",
      label: "Connect a source",
      description: "Plex/Tautulli, a book library, Audiobookshelf, or RomM.",
      href: "/sources",
      done: (sources?.length ?? 0) > 0,
    },
    {
      key: "recipients",
      label: "Add recipients and a group",
      description: "Add at least one recipient, then add them to a group.",
      href: "/recipients",
      done: hasRecipientsAndGroups,
    },
    {
      key: "smtp",
      label: "Add an email server",
      description: "The SMTP server LatestArr should send through.",
      href: "/smtp",
      done: (smtpProfiles?.length ?? 0) > 0,
    },
    {
      key: "template",
      label: "Choose a design",
      description: "Optional — newsletters use the Default design until you make your own.",
      href: "/designs",
      done: (templates?.length ?? 0) > 0,
      optional: true,
    },
    {
      key: "newsletter",
      label: "Create a newsletter",
      description: "Link a source, a recipient group, and a schedule.",
      href: "/newsletters",
      done: (newsletters?.length ?? 0) > 0,
    },
    {
      key: "alerts",
      label: "Get failure alerts",
      description: "Hear by email or webhook when a newsletter fails to send.",
      href: "/notifications",
      done: alertsOn,
      optional: true,
    },
    {
      key: "users",
      label: "Add another admin",
      description: "A second account means you're never locked out if one is lost.",
      href: "/users",
      done: userCount > 1,
      optional: true,
    },
  ];

  // Setting up is an admin's job, so editors and viewers skip the
  // checklist and go straight to what's running.
  const requiredDone = !isAdmin || checklist.filter((item) => !item.optional).every((item) => item.done);
  const showFullChecklist = !requiredDone || checklistExpanded;

  const sourcesWithErrors = sources?.filter((s) => s.status === "error").length ?? 0;
  // "unconfigured" is a source nobody has tested yet (the Sources page's
  // "Not yet tested"), which isn't the same as connected.
  const sourcesUntested = sources?.filter((s) => s.status === "unconfigured").length ?? 0;
  const sourcesSummary =
    sourcesWithErrors > 0
      ? `${sourcesWithErrors} need${sourcesWithErrors === 1 ? "s" : ""} attention`
      : sourcesUntested > 0
        ? `${sourcesUntested} not yet tested`
        : "All connected";
  const enabledNewsletters = newsletters?.filter((n) => n.isEnabled).length ?? 0;

  // A single card that's a true accordion (one header, conditionally
  // rendered content) rather than swapping between two differently-shaped
  // Cards — collapsed, it's just the header row (icon chip + title +
  // toggle), full width and one row tall, positioned above the stat tiles
  // (not squeezed into half of a two-column row next to Recent sends) so a
  // returning user's next action — or its completion — is the first thing
  // under the page header. Before setup is done there's nothing to
  // collapse to, so the toggle button and the icon's "done" color only
  // show once `requiredDone`.
  const checklistSection = (
    <Card>
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between gap-3 space-y-0",
          !showFullChecklist && "py-4",
        )}
      >
        <div className="flex items-center gap-3">
          {/* The collapsed "Setup complete" summary gets the emerald
              checkmark chip; both in-progress states ("Getting started"
              and the re-expanded "Setup checklist") get the neutral
              ListChecks chip — the icon reflects "is this the itemized
              list or the completion confirmation", independent of
              `requiredDone` alone. */}
          <CardIconChip
            icon={requiredDone && !showFullChecklist ? CheckCircle2 : ListChecks}
            accent={requiredDone && !showFullChecklist ? "emerald" : "neutral"}
          />
          <CardTitle>
            {!requiredDone ? "Getting started" : showFullChecklist ? "Setup checklist" : "Setup complete"}
          </CardTitle>
        </div>
        {requiredDone ? (
          showFullChecklist ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChecklistExpanded(false)}
              aria-label="Collapse setup checklist"
            >
              Collapse
              <ChevronDown className="rotate-180" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setChecklistExpanded(true)}>
              Review checklist
              <ChevronDown aria-hidden="true" />
            </Button>
          )
        ) : null}
      </CardHeader>
      {showFullChecklist ? (
        <CardContent className="flex flex-col divide-y divide-border">
          {checklist.map((item) => (
            <ChecklistRow key={item.key} item={item} />
          ))}
        </CardContent>
      ) : null}
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={
          requiredDone
            ? isAdmin
              ? "Your setup is complete — here's what's running."
              : "Here's what's running."
            : "Finish setting up LatestArr to send your first newsletter."
        }
      />

      {isAdmin ? checklistSection : null}

      {requiredDone ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Sources"
            value={sources?.length ?? 0}
            secondary={sources?.length ? sourcesSummary : undefined}
            href="/sources"
            icon={Server}
          />
          {canEdit ? (
            <StatCard
              label="Recipients"
              value={recipients?.length ?? 0}
              secondary={`${groups?.length ?? 0} group${groups?.length === 1 ? "" : "s"}`}
              href="/recipients"
              icon={Users}
            />
          ) : null}
          {isAdmin ? (
            <StatCard label="Email servers" value={smtpProfiles?.length ?? 0} href="/smtp" icon={Mail} />
          ) : null}
          {!isAdmin ? (
            <StatCard
              label="Designs"
              value={(templates?.length ?? 0) + 1}
              secondary="Including Default"
              href="/designs"
              icon={Palette}
            />
          ) : null}

          <StatCard
            label="Newsletters"
            value={newsletters?.length ?? 0}
            secondary={`${enabledNewsletters} active`}
            href="/newsletters"
            icon={Send}
          />
        </div>
      ) : null}

      {requiredDone ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <CardIconChip icon={Send} accent="neutral" />
            <CardTitle>Recent sends</CardTitle>
          </CardHeader>
          <CardContent>
            <SendRunHistoryList runs={recentRuns} error={null} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
