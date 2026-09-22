import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ListChecks,
  Loader2,
  Mail,
  Send,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { SendRunHistoryList } from "@/components/send-run-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  ApiError,
  listGroups,
  listNewsletters,
  listRecipients,
  listSendRuns,
  listSmtpProfiles,
  listSources,
  listTemplates,
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
          {item.label}
          {item.optional ? <Badge variant="accent">Optional</Badge> : null}
        </span>
        <span className="text-sm text-muted-foreground">{item.description}</span>
      </div>
    </Link>
  );
}

// Shared accent palette for every icon chip on this page — the four stat
// tiles, the checklist header, and the Recent sends header — so "an icon in
// a colored circle" reads as one consistent pattern across the dashboard
// instead of each card inventing its own icon treatment (a bare Lucide
// icon here, a filled circle there). Text/icon shades are picked (not the
// raw 500-weight swatch) so each clears WCAG AA/non-text contrast against
// its own tinted chip background in both themes — same approach as the
// Badge variants elsewhere in the app.
const CARD_ICON_ACCENTS = {
  primary: "bg-primary/15 text-primary",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  // Matches the Recent sends card's own tertiary-glass tint (see its
  // `className` below) rather than one of the stat-tile hues, so the icon
  // chip reads as part of that card's existing accent instead of a fifth
  // unrelated color.
  tertiary: "bg-tertiary/15 text-tertiary",
} as const;

const STAT_GLOWS = {
  primary: "group-hover:border-primary/40",
  sky: "group-hover:border-sky-500/40",
  violet: "group-hover:border-violet-500/40",
  amber: "group-hover:border-amber-500/40",
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

function StatCard({
  label,
  value,
  secondary,
  href,
  icon,
  accent,
}: {
  label: string;
  value: number;
  secondary?: string;
  href: string;
  icon: LucideIcon;
  accent: keyof typeof STAT_GLOWS;
}) {
  return (
    <Link to={href} className="group block">
      <Card
        className={cn(
          "h-full transition-all hover:-translate-y-0.5 hover:shadow-elevated",
          STAT_GLOWS[accent],
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <CardIconChip icon={icon} accent={accent} size="size-11" iconSize="size-5" />
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            {secondary ? (
              <p className="truncate text-xs text-muted-foreground/80">{secondary}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

type RecentRun = SendRun & { newsletterName: string };

export function DashboardPage() {
  const [sources, setSources] = useState<SourceConnection[] | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [groups, setGroups] = useState<RecipientGroup[] | null>(null);
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[] | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[] | null>(null);
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
    listRecipients().then(({ recipients }) => setRecipients(recipients)).catch(fail);
    listGroups().then(({ groups }) => setGroups(groups)).catch(fail);
    listSmtpProfiles().then(({ smtpProfiles }) => setSmtpProfiles(smtpProfiles)).catch(fail);
    listTemplates().then(({ templates }) => setTemplates(templates)).catch(fail);
    listNewsletters().then(({ newsletters }) => setNewsletters(newsletters)).catch(fail);
  }, []);

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading dashboard...
      </div>
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
      label: "Configure SMTP",
      description: "Add the mail server LatestArr should send through.",
      href: "/smtp",
      done: (smtpProfiles?.length ?? 0) > 0,
    },
    {
      key: "template",
      label: "Build a template",
      description: "Optional — newsletters use a starter template until you design your own.",
      href: "/templates",
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
  ];

  const requiredDone = checklist.filter((item) => !item.optional).every((item) => item.done);
  const showFullChecklist = !requiredDone || checklistExpanded;

  const sourcesWithErrors = sources?.filter((s) => s.status === "error").length ?? 0;
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
            accent={requiredDone && !showFullChecklist ? "emerald" : "primary"}
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
            ? "Your setup is complete — here's what's running."
            : "Finish setting up LatestArr to send your first newsletter."
        }
      />

      {checklistSection}

      {requiredDone ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Sources"
            value={sources?.length ?? 0}
            secondary={sourcesWithErrors > 0 ? `${sourcesWithErrors} need attention` : "All connected"}
            href="/sources"
            icon={Server}
            accent="sky"
          />
          <StatCard
            label="Recipients"
            value={recipients?.length ?? 0}
            secondary={`${groups?.length ?? 0} group${groups?.length === 1 ? "" : "s"}`}
            href="/recipients"
            icon={Users}
            accent="violet"
          />
          <StatCard label="SMTP Profiles" value={smtpProfiles?.length ?? 0} href="/smtp" icon={Mail} accent="amber" />
          <StatCard
            label="Newsletters"
            value={newsletters?.length ?? 0}
            secondary={`${enabledNewsletters} active`}
            href="/newsletters"
            icon={Send}
            accent="primary"
          />
        </div>
      ) : null}

      {requiredDone ? (
        // A tertiary-tinted glass surface (see the "Tertiary" note in
        // index.css) — a deliberate accent for this secondary-info panel
        // (recent activity, not an action) so it reads as distinct from
        // the checklist card above and the rose-primary stat tiles,
        // without competing with either. Its own icon chip picks up the
        // same tertiary hue (see CARD_ICON_ACCENTS.tertiary above) so the
        // header reads as one accent rather than an unrelated color.
        <Card className="border-tertiary/20 bg-tertiary/[0.04] backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <CardIconChip icon={Send} accent="tertiary" />
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
