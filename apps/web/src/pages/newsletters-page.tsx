import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import {
  ApiError,
  addNewsletterGroup,
  addNewsletterSource,
  createNewsletter,
  deleteNewsletter,
  getNewsletterDetail,
  listGroups,
  listNewsletters,
  listSendRuns,
  listSmtpProfiles,
  listSources,
  listTemplates,
  removeNewsletterGroup,
  removeNewsletterSource,
  sendNewsletterNow,
  updateNewsletter,
  type Newsletter,
  type NewsletterDetail,
  type RecipientGroup,
  type SendRun,
  type SmtpProfile,
  type SourceConnection,
  type Template,
} from "@/lib/api";

function AddNewsletterDialog({
  smtpProfiles,
  templates,
  onCreated,
}: {
  smtpProfiles: SmtpProfile[];
  templates: Template[];
  onCreated: (newsletter: Newsletter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scheduleCron, setScheduleCron] = useState("0 8 * * 1");
  const [timezone, setTimezone] = useState("UTC");
  const [lookbackDays, setLookbackDays] = useState("7");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [smtpProfileId, setSmtpProfileId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setScheduleCron("0 8 * * 1");
    setTimezone("UTC");
    setLookbackDays("7");
    setSubjectTemplate("");
    setSmtpProfileId("");
    setTemplateId("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { newsletter } = await createNewsletter({
        name,
        scheduleCron,
        timezone,
        lookbackDays: Number(lookbackDays),
        subjectTemplate: subjectTemplate || undefined,
        smtpProfileId: smtpProfileId || undefined,
        templateId: templateId || undefined,
      });
      onCreated(newsletter);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add newsletter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a newsletter</DialogTitle>
          <DialogDescription>Connect sources and recipient groups after creating it.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-name">Name</Label>
            <Input
              id="newsletter-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newsletter-cron">Schedule (cron)</Label>
              <Input
                id="newsletter-cron"
                required
                value={scheduleCron}
                onChange={(e) => setScheduleCron(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newsletter-timezone">Timezone</Label>
              <Input
                id="newsletter-timezone"
                required
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newsletter-lookback">Lookback (days)</Label>
              <Input
                id="newsletter-lookback"
                type="number"
                min={1}
                required
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newsletter-smtp">SMTP profile</Label>
              <Select
                id="newsletter-smtp"
                value={smtpProfileId}
                onChange={(e) => setSmtpProfileId(e.target.value)}
                disabled={submitting}
              >
                <option value="">None yet</option>
                {smtpProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-template">Template</Label>
            <Select
              id="newsletter-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Use the default layout</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-subject">Subject template (optional)</Label>
            <Input
              id="newsletter-subject"
              placeholder="What's new this week"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Add newsletter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type LinkedSource = NewsletterDetail["sources"][number];

function LinkedSources({
  newsletterId,
  sources,
  allSources,
  onChange,
}: {
  newsletterId: string;
  sources: LinkedSource[];
  allSources: SourceConnection[];
  onChange: (sources: LinkedSource[]) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableToAdd = allSources.filter((s) => !sources.some((linked) => linked.id === s.id));

  async function handleAdd() {
    if (!selectedId) return;
    setAdding(true);
    setError(null);
    try {
      await addNewsletterSource(newsletterId, selectedId);
      const added = allSources.find((s) => s.id === selectedId);
      if (added) onChange([...sources, { ...added, mediaTypeFilter: null, libraryFilter: null }]);
      setSelectedId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add source.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(sourceId: string) {
    setRemovingId(sourceId);
    try {
      await removeNewsletterSource(newsletterId, sourceId);
      onChange(sources.filter((s) => s.id !== sourceId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Sources</p>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources linked yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <li key={source.id}>
              <Badge variant="neutral" className="gap-1.5 py-1 pl-2.5 pr-1">
                {source.name}
                <button
                  type="button"
                  aria-label={`Remove ${source.name} from newsletter`}
                  onClick={() => void handleRemove(source.id)}
                  disabled={removingId === source.id}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {availableToAdd.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label="Add a source to this newsletter"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Select a source...</option>
            {availableToAdd.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" onClick={() => void handleAdd()} disabled={!selectedId || adding}>
            {adding ? <Loader2 className="animate-spin" /> : null}
            Add
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LinkedGroups({
  newsletterId,
  groups,
  allGroups,
  onChange,
}: {
  newsletterId: string;
  groups: RecipientGroup[];
  allGroups: RecipientGroup[];
  onChange: (groups: RecipientGroup[]) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableToAdd = allGroups.filter((g) => !groups.some((linked) => linked.id === g.id));

  async function handleAdd() {
    if (!selectedId) return;
    setAdding(true);
    setError(null);
    try {
      await addNewsletterGroup(newsletterId, selectedId);
      const added = allGroups.find((g) => g.id === selectedId);
      if (added) onChange([...groups, added]);
      setSelectedId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add group.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(groupId: string) {
    setRemovingId(groupId);
    try {
      await removeNewsletterGroup(newsletterId, groupId);
      onChange(groups.filter((g) => g.id !== groupId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Recipient groups</p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recipient groups linked yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Badge variant="neutral" className="gap-1.5 py-1 pl-2.5 pr-1">
                {group.name}
                <button
                  type="button"
                  aria-label={`Remove ${group.name} from newsletter`}
                  onClick={() => void handleRemove(group.id)}
                  disabled={removingId === group.id}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {availableToAdd.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label="Add a recipient group to this newsletter"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Select a group...</option>
            {availableToAdd.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" onClick={() => void handleAdd()} disabled={!selectedId || adding}>
            {adding ? <Loader2 className="animate-spin" /> : null}
            Add
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TemplatePicker({
  newsletter,
  templates,
  onChanged,
}: {
  newsletter: Newsletter;
  templates: Template[];
  onChanged: (newsletter: Newsletter) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(nextTemplateId: string) {
    setSaving(true);
    setError(null);
    try {
      const { newsletter: updated } = await updateNewsletter(newsletter.id, {
        templateId: nextTemplateId || null,
      });
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Template</p>
      <div className="flex items-center gap-2">
        <Select
          aria-label="Template"
          value={newsletter.templateId ?? ""}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          className="max-w-xs"
        >
          <option value="">Use the default layout</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
        {newsletter.templateId ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/templates/${newsletter.templateId}/edit`}>
              <Pencil />
              Edit template
            </Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const SEND_RUN_STATUS_VARIANT = {
  success: "success",
  partial_failure: "destructive",
  failed: "destructive",
  pending: "neutral",
  running: "neutral",
} as const;

function SendRunHistory({ newsletterId }: { newsletterId: string }) {
  const [runs, setRuns] = useState<SendRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSendRuns(newsletterId)
      .then(({ sendRuns }) => setRuns(sendRuns))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load send history."));
  }, [newsletterId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (runs === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading send history...
      </div>
    );
  }

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No sends yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {runs.slice(0, 10).map((run) => (
        <li key={run.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={SEND_RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
          <span className="text-muted-foreground">
            {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Not started"}
          </span>
          <span className="text-muted-foreground">
            {run.itemCountIncluded} items &middot; {run.recipientCount} recipients
          </span>
          {run.error ? <span className="text-destructive">{run.error}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function NewsletterCard({
  newsletter,
  allSources,
  allGroups,
  allTemplates,
  onChanged,
  onDeleted,
}: {
  newsletter: Newsletter;
  allSources: SourceConnection[];
  allGroups: RecipientGroup[];
  allTemplates: Template[];
  onChanged: (newsletter: Newsletter) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [detail, setDetail] = useState<NewsletterDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!expanded || detail) return;
    getNewsletterDetail(newsletter.id)
      .then(setDetail)
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : "Failed to load details."));
  }, [expanded, detail, newsletter.id]);

  async function handleToggleEnabled(next: boolean) {
    setToggling(true);
    try {
      const { newsletter: updated } = await updateNewsletter(newsletter.id, { isEnabled: next });
      onChanged(updated);
    } finally {
      setToggling(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    setSendResult(null);
    try {
      await sendNewsletterNow(newsletter.id);
      setSendResult("Send started.");
    } catch (err) {
      setSendResult(err instanceof ApiError ? err.message : "Failed to start send.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteNewsletter(newsletter.id);
      onDeleted(newsletter.id);
    } catch (err) {
      setDeleting(false);
      setConfirmingDelete(false);
      setSendResult(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{newsletter.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {newsletter.scheduleCron} ({newsletter.timezone}) &middot; {newsletter.lookbackDays}-day lookback
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-sm text-muted-foreground">Delete?</span>
                <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" /> : null}
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${newsletter.name}`}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>

        <SettingRow
          label="Enabled"
          description="Send this newsletter on its configured schedule."
          htmlFor={`newsletter-enabled-${newsletter.id}`}
          control={
            <Switch
              id={`newsletter-enabled-${newsletter.id}`}
              checked={newsletter.isEnabled}
              onCheckedChange={(checked) => void handleToggleEnabled(checked)}
              disabled={toggling}
            />
          }
        />

        {expanded ? (
          <div className="flex flex-col gap-4 border-t border-border pt-3">
            {detailError ? (
              <p role="alert" className="text-sm text-destructive">
                {detailError}
              </p>
            ) : null}

            {!detail && !detailError ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading details...
              </div>
            ) : null}

            {detail ? (
              <>
                <TemplatePicker newsletter={newsletter} templates={allTemplates} onChanged={onChanged} />
                <LinkedSources
                  newsletterId={newsletter.id}
                  sources={detail.sources}
                  allSources={allSources}
                  onChange={(sources) => setDetail((d) => (d ? { ...d, sources } : d))}
                />
                <LinkedGroups
                  newsletterId={newsletter.id}
                  groups={detail.recipientGroups}
                  allGroups={allGroups}
                  onChange={(recipientGroups) => setDetail((d) => (d ? { ...d, recipientGroups } : d))}
                />
              </>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void handleSendNow()} disabled={sending}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send now
                </Button>
                {sendResult ? <span className="text-sm text-muted-foreground">{sendResult}</span> : null}
              </div>
              <p className="text-sm font-medium">Send history</p>
              <SendRunHistory newsletterId={newsletter.id} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function NewslettersPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allSources, setAllSources] = useState<SourceConnection[]>([]);
  const [allGroups, setAllGroups] = useState<RecipientGroup[]>([]);
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);

  useEffect(() => {
    listNewsletters()
      .then(({ newsletters: loaded }) => setNewsletters(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load newsletters."));
    listSources()
      .then(({ sources }) => setAllSources(sources))
      .catch(() => {
        // Surfaced via each newsletter's own "Sources" section if it matters there.
      });
    listGroups()
      .then(({ groups }) => setAllGroups(groups))
      .catch(() => {
        // Surfaced via each newsletter's own "Recipient groups" section.
      });
    listSmtpProfiles()
      .then(({ smtpProfiles: profiles }) => setSmtpProfiles(profiles))
      .catch(() => {
        // The add-newsletter dialog just shows no SMTP options if this fails.
      });
    listTemplates()
      .then(({ templates: loaded }) => setAllTemplates(loaded))
      .catch(() => {
        // The template picker just shows the default-layout option if this fails.
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletters</h1>
          <p className="text-sm text-muted-foreground">
            Build, schedule, and send digests from your connected sources.
          </p>
        </div>
        {newsletters ? (
          <AddNewsletterDialog
            smtpProfiles={smtpProfiles}
            templates={allTemplates}
            onCreated={(newsletter) => setNewsletters((prev) => [...(prev ?? []), newsletter])}
          />
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {newsletters === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading newsletters...
        </div>
      ) : null}

      {newsletters && newsletters.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No newsletters yet</CardTitle>
            <CardDescription>Add one to start sending digests on a schedule.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {newsletters && newsletters.length > 0 ? (
        <div className="flex flex-col gap-3">
          {newsletters.map((newsletter) => (
            <NewsletterCard
              key={newsletter.id}
              newsletter={newsletter}
              allSources={allSources}
              allGroups={allGroups}
              allTemplates={allTemplates}
              onChanged={(updated) =>
                setNewsletters((prev) => (prev ?? []).map((n) => (n.id === updated.id ? updated : n)))
              }
              onDeleted={(id) => setNewsletters((prev) => (prev ?? []).filter((n) => n.id !== id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
