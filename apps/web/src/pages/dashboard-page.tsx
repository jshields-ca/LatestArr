import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const SEND_RUN_STATUS_VARIANT = {
  success: "success",
  partial_failure: "destructive",
  failed: "destructive",
  pending: "neutral",
  running: "neutral",
} as const;

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
          {item.optional ? <Badge variant="neutral">Optional</Badge> : null}
        </span>
        <span className="text-sm text-muted-foreground">{item.description}</span>
      </div>
    </Link>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link to={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="p-4">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {requiredDone
            ? "Your setup is complete — here's what's running."
            : "Finish setting up LatestArr to send your first newsletter."}
        </p>
      </div>

      {requiredDone ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sources" value={sources?.length ?? 0} href="/sources" />
          <StatCard label="Recipients" value={recipients?.length ?? 0} href="/recipients" />
          <StatCard label="SMTP profiles" value={smtpProfiles?.length ?? 0} href="/smtp" />
          <StatCard label="Newsletters" value={newsletters?.length ?? 0} href="/newsletters" />
        </div>
      ) : null}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{requiredDone ? "Setup checklist" : "Getting started"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {checklist.map((item) => (
            <ChecklistRow key={item.key} item={item} />
          ))}
        </CardContent>
      </Card>

      {requiredDone ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Recent sends</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading recent sends...
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sends yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recentRuns.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={SEND_RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                    <span className="font-medium">{run.newsletterName}</span>
                    <span className="text-muted-foreground">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Not started"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
