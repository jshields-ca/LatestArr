import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";

import { ScheduleField, type ScheduleMode } from "@/components/schedule-field";
import { ListRow } from "@/components/list-row";
import { SendRunHistoryList } from "@/components/send-run-history";
import { SourceLogo } from "@/components/source-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { SubsectionHeading } from "@/components/ui/subsection-heading";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
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
import { EMAIL_FONT_OPTIONS } from "@/lib/email-fonts";
import {
  DEFAULT_SIMPLE_SCHEDULE,
  describeScheduleParts,
  detectBrowserTimezone,
  parseCronToSimpleSchedule,
  simpleScheduleToCron,
  type SimpleSchedule,
} from "@/lib/schedule";

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
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("simple");
  const [simpleSchedule, setSimpleSchedule] = useState<SimpleSchedule>(DEFAULT_SIMPLE_SCHEDULE);
  const [advancedCron, setAdvancedCron] = useState(simpleScheduleToCron(DEFAULT_SIMPLE_SCHEDULE));
  const [timezone, setTimezone] = useState(() => detectBrowserTimezone());
  const [lookbackDays, setLookbackDays] = useState("7");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [smtpProfileId, setSmtpProfileId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called on every open *and* close so the dialog always starts from a
  // clean slate: the browser's own timezone (not a hardcoded "UTC"), and
  // the sole SMTP profile pre-selected when there's exactly one — with 0 or
  // 2+ profiles it still starts unselected, since there's no unambiguous
  // choice to make for the user.
  function reset() {
    setName("");
    setScheduleMode("simple");
    setSimpleSchedule(DEFAULT_SIMPLE_SCHEDULE);
    setAdvancedCron(simpleScheduleToCron(DEFAULT_SIMPLE_SCHEDULE));
    setTimezone(detectBrowserTimezone());
    setLookbackDays("7");
    setSubjectTemplate("");
    setSmtpProfileId(smtpProfiles.length === 1 ? smtpProfiles[0]!.id : "");
    setTemplateId("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const scheduleCron = scheduleMode === "simple" ? simpleScheduleToCron(simpleSchedule) : advancedCron;
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
      toast({ variant: "success", title: "Newsletter added", description: newsletter.name });
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
        reset();
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
          <div className="rounded-md border border-border p-3">
            <ScheduleField
              idPrefix="newsletter"
              mode={scheduleMode}
              onModeChange={setScheduleMode}
              simple={simpleSchedule}
              onSimpleChange={setSimpleSchedule}
              scheduleCron={advancedCron}
              onScheduleCronChange={setAdvancedCron}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <SubsectionHeading>Delivery</SubsectionHeading>
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
      toast({ variant: "success", title: "Source linked", description: added?.name });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to add source.";
      setError(message);
      toast({ variant: "destructive", title: "Failed to link source", description: message });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(sourceId: string) {
    setRemovingId(sourceId);
    try {
      await removeNewsletterSource(newsletterId, sourceId);
      onChange(sources.filter((s) => s.id !== sourceId));
      toast({ variant: "success", title: "Source unlinked" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to unlink source",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SubsectionHeading>Sources</SubsectionHeading>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources linked yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <li key={source.id}>
              <Badge variant="neutral" className="gap-1.5 py-1 pl-2.5 pr-1">
                <SourceLogo kind={source.kind} className="size-3.5" />
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
      toast({ variant: "success", title: "Recipient group linked", description: added?.name });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to add group.";
      setError(message);
      toast({ variant: "destructive", title: "Failed to link recipient group", description: message });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(groupId: string) {
    setRemovingId(groupId);
    try {
      await removeNewsletterGroup(newsletterId, groupId);
      onChange(groups.filter((g) => g.id !== groupId));
      toast({ variant: "success", title: "Recipient group unlinked" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to unlink recipient group",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SubsectionHeading>Recipient groups</SubsectionHeading>
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
      const templateName = templates.find((t) => t.id === nextTemplateId)?.name;
      toast({
        variant: "success",
        title: "Template updated",
        description: templateName ?? "Using the default layout.",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update template.";
      setError(message);
      toast({ variant: "destructive", title: "Failed to update template", description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SubsectionHeading>Template</SubsectionHeading>
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

// Only meaningful for the default layout — a custom GrapesJS template
// defines its own fonts, so this is hidden once a template is picked above
// rather than shown-but-inert, which would just invite "why didn't this do
// anything" confusion.
function EmailFontPicker({
  newsletter,
  onChanged,
}: {
  newsletter: Newsletter;
  onChanged: (newsletter: Newsletter) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(nextFont: string) {
    setSaving(true);
    setError(null);
    try {
      const { newsletter: updated } = await updateNewsletter(newsletter.id, { emailFont: nextFont });
      onChanged(updated);
      toast({ variant: "success", title: "Font updated" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update font.";
      setError(message);
      toast({ variant: "destructive", title: "Failed to update font", description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SubsectionHeading>Font</SubsectionHeading>
      <Select
        aria-label="Font"
        value={newsletter.emailFont}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={saving}
        className="max-w-xs"
      >
        {EMAIL_FONT_OPTIONS.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </Select>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// The newsletter's own editable fields (name, schedule, delivery, subject) —
// what used to live in a separate "Edit newsletter" dialog, reached only via
// a pencil icon that didn't include the Template/Sources/Groups pickers
// below it. Moved inline into the Details tab so every configuration field
// for a newsletter lives in one place instead of being split between a
// modal and the expanded row (see Fix: newsletter edit consolidation).
// Local state is seeded from `newsletter` once, when the section mounts
// (i.e. whenever the row is expanded) — same "reset on open" behavior the
// dialog had, since this section is itself unmounted on collapse.
function NewsletterDetailsForm({
  newsletter,
  smtpProfiles,
  onSaved,
}: {
  newsletter: Newsletter;
  smtpProfiles: SmtpProfile[];
  onSaved: (newsletter: Newsletter) => void;
}) {
  const [name, setName] = useState(newsletter.name);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    () => (parseCronToSimpleSchedule(newsletter.scheduleCron) ? "simple" : "advanced"),
  );
  const [simpleSchedule, setSimpleSchedule] = useState<SimpleSchedule>(
    () => parseCronToSimpleSchedule(newsletter.scheduleCron) ?? DEFAULT_SIMPLE_SCHEDULE,
  );
  const [advancedCron, setAdvancedCron] = useState(newsletter.scheduleCron);
  const [timezone, setTimezone] = useState(newsletter.timezone);
  const [lookbackDays, setLookbackDays] = useState(String(newsletter.lookbackDays));
  const [subjectTemplate, setSubjectTemplate] = useState(newsletter.subjectTemplate ?? "");
  const [smtpProfileId, setSmtpProfileId] = useState(newsletter.smtpProfileId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idPrefix = `newsletter-${newsletter.id}`;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const scheduleCron = scheduleMode === "simple" ? simpleScheduleToCron(simpleSchedule) : advancedCron;
      const { newsletter: updated } = await updateNewsletter(newsletter.id, {
        name,
        scheduleCron,
        timezone,
        lookbackDays: Number(lookbackDays),
        subjectTemplate: subjectTemplate || undefined,
        smtpProfileId: smtpProfileId || null,
      });
      onSaved(updated);
      toast({ variant: "success", title: "Newsletter updated" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
      </div>

      {/* Schedule, Delivery, and Subject line grouped under one "Schedule"
          panel — previously three separate boxes stacked the full width of
          the expanded row; narrowing them into one column (see the
          Content-panel sibling this sits next to in NewsletterCard) also
          fixes how sparse the schedule grid looked stretched that wide. */}
      <div className="flex flex-col gap-4 rounded-md border border-border p-3">
        <SubsectionHeading>Schedule</SubsectionHeading>
        <ScheduleField
          idPrefix={idPrefix}
          mode={scheduleMode}
          onModeChange={setScheduleMode}
          simple={simpleSchedule}
          onSimpleChange={setSimpleSchedule}
          scheduleCron={advancedCron}
          onScheduleCronChange={setAdvancedCron}
          timezone={timezone}
          onTimezoneChange={setTimezone}
          disabled={submitting}
        />
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <SubsectionHeading>Delivery</SubsectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-lookback`}>Lookback (days)</Label>
              <Input
                id={`${idPrefix}-lookback`}
                type="number"
                min={1}
                required
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-smtp`}>SMTP profile</Label>
              <Select
                id={`${idPrefix}-smtp`}
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
            <Label htmlFor={`${idPrefix}-subject`}>Subject template (optional)</Label>
            <Input
              id={`${idPrefix}-subject`}
              placeholder="What's new this week"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}

function NewsletterCard({
  newsletter,
  allSources,
  allGroups,
  allTemplates,
  smtpProfiles,
  onChanged,
  onDeleted,
}: {
  newsletter: Newsletter;
  allSources: SourceConnection[];
  allGroups: RecipientGroup[];
  allTemplates: Template[];
  smtpProfiles: SmtpProfile[];
  onChanged: (newsletter: Newsletter) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [toggling, setToggling] = useState(false);
  const [detail, setDetail] = useState<NewsletterDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendRuns, setSendRuns] = useState<SendRun[] | null>(null);
  const [sendRunsError, setSendRunsError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || detail) return;
    getNewsletterDetail(newsletter.id)
      .then(setDetail)
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : "Failed to load details."));
  }, [expanded, detail, newsletter.id]);

  function refreshSendRuns() {
    listSendRuns(newsletter.id)
      .then(({ sendRuns: loaded }) => {
        setSendRuns(loaded);
        setSendRunsError(null);
      })
      .catch((err) => setSendRunsError(err instanceof ApiError ? err.message : "Failed to load send history."));
  }

  useEffect(() => {
    if (!expanded || sendRuns || sendRunsError) return;
    refreshSendRuns();
  }, [expanded, sendRuns, sendRunsError, newsletter.id]);

  async function handleToggleEnabled(next: boolean) {
    setToggling(true);
    try {
      const { newsletter: updated } = await updateNewsletter(newsletter.id, { isEnabled: next });
      onChanged(updated);
      toast({ variant: "success", title: next ? "Newsletter enabled" : "Newsletter disabled" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update newsletter",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setToggling(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      await sendNewsletterNow(newsletter.id);
      setSendResult("Send started.");
      toast({ variant: "success", title: "Send started", description: `${newsletter.name} is being sent.` });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to start send.";
      setSendError(message);
      toast({ variant: "destructive", title: "Failed to start send", description: message });
    } finally {
      setSending(false);
      // Whether the send succeeded or failed, a new (or updated) SendRun
      // row exists now — refresh so it shows up immediately instead of
      // only after a manual page reload (see Fix 6).
      refreshSendRuns();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteNewsletter(newsletter.id);
      onDeleted(newsletter.id);
      toast({ variant: "success", title: "Newsletter deleted", description: newsletter.name });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete.";
      setDeleting(false);
      setConfirmingDelete(false);
      setSendResult(message);
      toast({ variant: "destructive", title: "Failed to delete newsletter", description: message });
    }
  }

  const scheduleParts = describeScheduleParts(newsletter.scheduleCron, newsletter.timezone);

  return (
    <ListRow
      primary={<span className="truncate font-medium">{newsletter.name}</span>}
      secondary={
        // Split into a frequency badge, a bolder "when", and muted
        // timezone/lookback detail instead of one flat muted-gray sentence
        // — the pieces someone scans for (how often, when) stand out from
        // the pieces that are just context.
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Badge variant="neutral">{scheduleParts.frequency}</Badge>
          <span className="text-sm text-foreground">{scheduleParts.when}</span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            &middot;
          </span>
          <span className="text-xs text-muted-foreground">{scheduleParts.timezone}</span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            &middot;
          </span>
          <span className="text-xs text-muted-foreground">{newsletter.lookbackDays}-day lookback</span>
        </span>
      }
      expand={{ expanded, onToggle: () => setExpanded((e) => !e) }}
      actions={
        confirmingDelete ? (
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
        )
      }
    >
      {/* Stays outside the expand/Tabs block so it's toggleable from the
          collapsed row too, without needing to open the newsletter first —
          unchanged from before the Details/History restructure. */}
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
        <div className="flex flex-col border-t border-border pt-3">
          {/* Everything else editable about the newsletter — including the
              Template/Sources/Groups pickers that used to live only here,
              separate from the "Edit" dialog's name/schedule/delivery
              fields — now lives together under Details. History is the
              only thing left in what used to be this expanded section's
              flat content (see Fix: newsletter edit consolidation). */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              {/* Two columns once there's room — Schedule (the form, left)
                  and Content (Template/Sources/Groups, right) grouped as
                  their own panels instead of one long flat stack of boxes.
                  Below sm they stack, same as every other two-column form
                  section in this app. */}
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <NewsletterDetailsForm newsletter={newsletter} smtpProfiles={smtpProfiles} onSaved={onChanged} />

                <div className="flex flex-col gap-4 rounded-md border border-border p-3">
                  <SubsectionHeading>Content</SubsectionHeading>

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
                      {!newsletter.templateId ? (
                        <EmailFontPicker newsletter={newsletter} onChanged={onChanged} />
                      ) : null}
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
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void handleSendNow()} disabled={sending}>
                    {sending ? <Loader2 className="animate-spin" /> : <Send />}
                    Send now
                  </Button>
                  {sendResult ? <span className="text-sm text-muted-foreground">{sendResult}</span> : null}
                </div>
                {sendError ? (
                  <span role="alert" className="text-sm text-destructive">
                    {sendError}
                  </span>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <SendRunHistoryList runs={sendRuns} error={sendRunsError} />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </ListRow>
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
      <PageHeader
        title="Newsletters"
        description="Build, schedule, and send digests from your connected sources."
        actions={
          newsletters ? (
            <AddNewsletterDialog
              smtpProfiles={smtpProfiles}
              templates={allTemplates}
              onCreated={(newsletter) => setNewsletters((prev) => [...(prev ?? []), newsletter])}
            />
          ) : null
        }
      />

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
              smtpProfiles={smtpProfiles}
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
