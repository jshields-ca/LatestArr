import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  BookOpen,
  Clapperboard,
  Gamepad2,
  Headphones,
  Loader2,
  Pencil,
  Plus,
  Server,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

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
import { toast } from "@/components/ui/use-toast";
import { ListRow } from "@/components/list-row";
import { hasSourceLogo, SourceLogo } from "@/components/source-logo";
import {
  ApiError,
  addGroupMember,
  createGroup,
  createSource,
  deleteSource,
  importRecipients,
  listGroups,
  listSourceKinds,
  listSources,
  listSourceUsers,
  testSourceConnection,
  updateSource,
  type RecipientGroup,
  type SourceConnection,
  type SourceUser,
} from "@/lib/api";

// Only these source kinds' adapters implement listUsers (see
// packages/adapters/*/src/*-adapter.ts) — checked here too so the
// "Import users" action only appears where it can actually work, rather
// than every row offering it and most of them 404ing.
const KINDS_WITH_USER_IMPORT = new Set(["plex", "tautulli", "jellyfin", "emby", "audiobookshelf", "romm"]);

// Loose on purpose: the server validates properly on import.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TESTERS_ISSUE_URL = "https://github.com/jshields-ca/LatestArr/issues/196";

interface SourceKindField {
  key: string;
  label: string;
  type?: string;
}

interface SourceKindConfig {
  label: string;
  description: string;
  fields: SourceKindField[];
  /** BookLore, BookOrbit, and Grimmory authenticate over OPDS, a protocol
   *  name most self-hosters won't recognize — this shows a plain-language
   *  note next to their username/password fields instead. */
  opdsHint?: boolean;
  /** Where to find the credential, shown under its field. */
  fieldHint?: string;
  /** Built from the API docs but not yet confirmed on a real server; asks
   *  the admin to report how it went. */
  needsTesters?: boolean;
  /** Example values for the Name, Base URL, and Public URL fields. */
  examples: { name: string; baseUrl: string; publicUrl: string };
}

// The SourceAdapter contract takes an opaque Record<string, string> of
// credentials, so field metadata (labels, how many fields, which are
// secrets) isn't discoverable from the server — it's tracked here per kind.
// A kind the server registers but that's missing from this map still works,
// falling back to a single generic "API key" field.
const KIND_CONFIG: Record<string, SourceKindConfig> = {
  tautulli: {
    label: "Tautulli",
    examples: { name: "Home Tautulli", baseUrl: "http://localhost:8181", publicUrl: "https://plex.example.com" },
    description: "Connect a Tautulli server for Plex activity data.",
    fields: [{ key: "apiKey", label: "Tautulli API key", type: "password" }],
  },
  plex: {
    label: "Plex",
    examples: { name: "Home Plex", baseUrl: "http://localhost:32400", publicUrl: "https://plex.example.com" },
    description: "Connect directly to a Plex Media Server.",
    fields: [{ key: "token", label: "Plex token", type: "password" }],
  },
  jellyfin: {
    label: "Jellyfin",
    examples: { name: "Home Jellyfin", baseUrl: "http://localhost:8096", publicUrl: "https://jellyfin.example.com" },
    description: "Connect to a Jellyfin server for movies, TV, books, and audiobooks.",
    fields: [{ key: "apiKey", label: "Jellyfin API key", type: "password" }],
    fieldHint: "Create one in Jellyfin's Dashboard, under API Keys.",
    needsTesters: true,
  },
  emby: {
    label: "Emby",
    examples: { name: "Home Emby", baseUrl: "http://localhost:8096", publicUrl: "https://emby.example.com" },
    description: "Connect to an Emby server for movies, TV, books, and audiobooks.",
    fields: [{ key: "apiKey", label: "Emby API key", type: "password" }],
    fieldHint: "Create one in Emby's server settings, under API Keys.",
    needsTesters: true,
  },
  booklore: {
    label: "BookLore",
    examples: { name: "Books", baseUrl: "http://localhost:6060", publicUrl: "https://books.example.com" },
    description: "Connect to a BookLore OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
    opdsHint: true,
  },
  bookorbit: {
    label: "BookOrbit",
    examples: { name: "Books", baseUrl: "http://bookorbit.local", publicUrl: "https://books.example.com" },
    description: "Connect to a BookOrbit OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
    opdsHint: true,
  },
  grimmory: {
    label: "Grimmory",
    examples: { name: "Books", baseUrl: "http://grimmory.local", publicUrl: "https://books.example.com" },
    description: "Connect to a Grimmory OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
    opdsHint: true,
  },
  audiobookshelf: {
    label: "Audiobookshelf",
    examples: { name: "Audiobooks", baseUrl: "http://localhost:13378", publicUrl: "https://audiobooks.example.com" },
    description: "Connect to an Audiobookshelf server.",
    fields: [{ key: "token", label: "Audiobookshelf API token", type: "password" }],
  },
  romm: {
    label: "RomM",
    examples: { name: "Games", baseUrl: "http://localhost:8080", publicUrl: "https://games.example.com" },
    description: "Connect to a RomM server.",
    fields: [{ key: "token", label: "RomM client API token", type: "password" }],
  },
};

const FALLBACK_CONFIG: SourceKindConfig = {
  label: "Source",
  examples: { name: "My server", baseUrl: "http://localhost:8080", publicUrl: "https://media.example.com" },
  description: "Connect a media source.",
  fields: [{ key: "apiKey", label: "API key", type: "password" }],
};

// BookLore, BookOrbit, and Grimmory are three separate forks of the same
// OPDS-based catalog server, so they share both a field shape (above) and
// an icon here.
const KIND_ICON: Record<string, LucideIcon> = {
  tautulli: Activity,
  plex: Clapperboard,
  jellyfin: Clapperboard,
  emby: Clapperboard,
  booklore: BookOpen,
  bookorbit: BookOpen,
  grimmory: BookOpen,
  audiobookshelf: Headphones,
  romm: Gamepad2,
};

function kindLabel(kind: string): string {
  return KIND_CONFIG[kind]?.label ?? kind;
}

// Alphabetical by display name, so the Source type list is easy to scan.
function sortKinds(kinds: string[]): string[] {
  return [...kinds].sort((a, b) => kindLabel(a).localeCompare(kindLabel(b)));
}

// Used before the server's own list of registered kinds has loaded, so the
// dialog is usable immediately rather than waiting on a second request.
const FALLBACK_KINDS = sortKinds(Object.keys(KIND_CONFIG));

function OpdsHint({ id, label }: { id: string; label: string }) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      OPDS is just how {label} shares its catalog — use the same username and password you already use to sign in to {label}&apos;s own web reader, not a separate API key.
    </p>
  );
}

function TestersNote({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      {label} support is new and hasn&apos;t been confirmed on a real server yet. If you try it, please{" "}
      <a href={TESTERS_ISSUE_URL} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
        tell us how it went
      </a>
      : your server version, what worked, and any errors from the Logs page.
    </p>
  );
}

function PublicUrlHint({ id }: { id: string }) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      The address your recipients can actually reach, used for item links and a design&apos;s Where to watch
      buttons (like Watch on Plex) — leave blank to use the address above for links. Useful when
      the address above is internal-only (e.g. a Tailscale IP or an API host like Tautulli that isn&apos;t
      itself the link you want people to click).
    </p>
  );
}

function StatusBadge({ status }: { status: SourceConnection["status"] }) {
  if (status === "ok") return <Badge variant="success" dot>Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="neutral">Not yet tested</Badge>;
}

function AddSourceDialog({
  kinds,
  onCreated,
}: {
  kinds: string[];
  onCreated: (source: SourceConnection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [kind, setKind] = useState(kinds[0] ?? "tautulli");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = KIND_CONFIG[kind] ?? FALLBACK_CONFIG;

  function reset() {
    setName("");
    setBaseUrl("");
    setPublicUrl("");
    setKind(kinds[0] ?? "tautulli");
    setCredentialValues({});
    setError(null);
  }

  function handleKindChange(nextKind: string) {
    setKind(nextKind);
    setCredentialValues({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { source } = await createSource({
        name,
        kind,
        baseUrl,
        ...(publicUrl.trim() && { publicUrl: publicUrl.trim() }),
        credentials: credentialValues,
      });
      onCreated(source);
      setOpen(false);
      reset();
      toast({ variant: "success", title: "Source added", description: `${source.name} is ready to connect.` });
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
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-kind">Source type</Label>
            <Select
              id="source-kind"
              value={kind}
              onChange={(e) => handleKindChange(e.target.value)}
              disabled={submitting}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  <span className="flex items-center gap-2">
                    <SourceLogo kind={k} />
                    {kindLabel(k)}
                  </span>
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-name">Name</Label>
            <Input
              id="source-name"
              placeholder={config.examples.name}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-base-url">Base URL</Label>
            <Input
              id="source-base-url"
              type="url"
              placeholder={config.examples.baseUrl}
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-public-url">Public URL (optional)</Label>
            <Input
              id="source-public-url"
              type="url"
              placeholder={config.examples.publicUrl}
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              disabled={submitting}
              aria-describedby="source-public-url-hint"
            />
            <PublicUrlHint id="source-public-url-hint" />
          </div>
          {config.fields.map((field) => (
            <div className="flex flex-col gap-1.5" key={field.key}>
              <Label htmlFor={`source-field-${field.key}`}>{field.label}</Label>
              <Input
                id={`source-field-${field.key}`}
                type={field.type ?? "text"}
                required
                value={credentialValues[field.key] ?? ""}
                onChange={(e) =>
                  setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={submitting}
                aria-describedby={
                  config.opdsHint ? "source-opds-hint" : config.fieldHint ? "source-field-hint" : undefined
                }
              />
            </div>
          ))}
          {config.opdsHint ? <OpdsHint id="source-opds-hint" label={config.label} /> : null}
          {config.fieldHint ? (
            <p id="source-field-hint" className="text-xs text-muted-foreground">
              {config.fieldHint}
            </p>
          ) : null}
          {config.needsTesters ? <TestersNote label={config.label} /> : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Add source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSourceDialog({
  source,
  onSaved,
}: {
  source: SourceConnection;
  onSaved: (source: SourceConnection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(source.name);
  const [baseUrl, setBaseUrl] = useState(source.baseUrl);
  const [publicUrl, setPublicUrl] = useState(source.publicUrl ?? "");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = KIND_CONFIG[source.kind] ?? FALLBACK_CONFIG;

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setName(source.name);
      setBaseUrl(source.baseUrl);
      setPublicUrl(source.publicUrl ?? "");
      setCredentialValues({});
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Credentials are a full replace (they're never returned decrypted, so
    // there's nothing to merge partial edits into) — either leave every
    // field blank to keep what's already stored, or fill in all of them.
    const filledCount = config.fields.filter((f) => credentialValues[f.key]).length;
    if (filledCount > 0 && filledCount < config.fields.length) {
      setError("Fill in every credential field, or leave them all blank to keep the current ones.");
      return;
    }

    setSubmitting(true);
    try {
      const { source: updated } = await updateSource(source.id, {
        name,
        baseUrl,
        publicUrl: publicUrl.trim(),
        ...(filledCount > 0 && { credentials: credentialValues }),
      });
      onSaved(updated);
      setOpen(false);
      toast({ variant: "success", title: "Source updated" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openWithCurrentValues}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${source.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit source</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-source-name">Name</Label>
            <Input
              id="edit-source-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-source-base-url">Base URL</Label>
            <Input
              id="edit-source-base-url"
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-source-public-url-${source.id}`}>Public URL (optional)</Label>
            <Input
              id={`edit-source-public-url-${source.id}`}
              type="url"
              placeholder={config.examples.publicUrl}
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              disabled={submitting}
              aria-describedby={`edit-source-public-url-hint-${source.id}`}
            />
            <PublicUrlHint id={`edit-source-public-url-hint-${source.id}`} />
          </div>
          {config.fields.map((field) => (
            <div className="flex flex-col gap-1.5" key={field.key}>
              <Label htmlFor={`edit-source-field-${field.key}`}>{field.label} (leave blank to keep current)</Label>
              <Input
                id={`edit-source-field-${field.key}`}
                type={field.type ?? "text"}
                value={credentialValues[field.key] ?? ""}
                onChange={(e) =>
                  setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={submitting}
                aria-describedby={config.opdsHint ? `edit-source-opds-hint-${source.id}` : undefined}
              />
            </div>
          ))}
          {config.opdsHint ? (
            <OpdsHint id={`edit-source-opds-hint-${source.id}`} label={config.label} />
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Fetches the source's known users, lets the admin pick which ones (only
// those with a known email — a recipient can't exist without one) to
// import as recipients, and adds them to a group named after the source
// — reusing that name across repeat imports rather than creating a new
// group every time, the same way `importRecipients` itself skips a
// recipient whose email already exists rather than duplicating it.
function ImportSourceUsersDialog({
  source,
  groups,
  onGroupsChange,
}: {
  source: SourceConnection;
  groups: RecipientGroup[];
  onGroupsChange: (updater: (prev: RecipientGroup[]) => RecipientGroup[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<SourceUser[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Emails typed in for users the source has none for (Plex, Jellyfin, ...).
  const [typedEmails, setTypedEmails] = useState<Record<string, string>>({});
  const [groupName, setGroupName] = useState(source.name);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; addedToGroup: number; noEmail: number } | null>(
    null,
  );

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setLoadError(null);
    setResult(null);
    setGroupName(source.name);
    setUsers(null);
    setTypedEmails({});
    setLoading(true);
    listSourceUsers(source.id)
      .then(({ users: loaded }) => {
        setUsers(loaded);
        setSelected(new Set(loaded.filter((u) => u.email).map((u) => u.externalId)));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }

  function emailFor(user: SourceUser): string | undefined {
    if (user.email) return user.email;
    const typed = typedEmails[user.externalId]?.trim();
    return typed && EMAIL_PATTERN.test(typed) ? typed : undefined;
  }

  // Typing a complete address selects the user; clearing it deselects them.
  function typeEmail(user: SourceUser, value: string) {
    setTypedEmails((prev) => ({ ...prev, [user.externalId]: value }));
    const valid = EMAIL_PATTERN.test(value.trim());
    setSelected((prev) => {
      const next = new Set(prev);
      if (valid) next.add(user.externalId);
      else next.delete(user.externalId);
      return next;
    });
  }

  function toggle(externalId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  async function handleImport() {
    if (!users) return;
    const rows = users
      .filter((u) => emailFor(u) && selected.has(u.externalId))
      .map((u) => ({ email: emailFor(u)!, displayName: u.username }));
    if (rows.length === 0) return;

    setSubmitting(true);
    try {
      const importResult = await importRecipients(rows);

      const trimmedGroupName = groupName.trim();
      let group = groups.find((g) => g.name === trimmedGroupName);
      if (!group && trimmedGroupName) {
        const { group: created } = await createGroup({ name: trimmedGroupName });
        group = created;
        onGroupsChange((prev) => [...prev, created]);
      }

      let addedToGroup = 0;
      if (group) {
        for (const recipient of importResult.created) {
          await addGroupMember(group.id, recipient.id);
          addedToGroup += 1;
        }
      }

      setResult({
        created: importResult.created.length,
        addedToGroup,
        noEmail: users.filter((u) => !emailFor(u)).length,
      });
      toast({
        variant: "success",
        title: `Imported ${importResult.created.length} recipient${importResult.created.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedWithEmailCount = users
    ? users.filter((u) => emailFor(u) && selected.has(u.externalId)).length
    : 0;
  const groupExists = groups.some((g) => g.name === groupName.trim());

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus />
          Import users
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import users from {source.name}</DialogTitle>
          <DialogDescription>
            Add its users as recipients, grouped together. Type an email for anyone {source.name} doesn&apos;t
            have one for.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading users...
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        ) : result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Added <strong>{result.created}</strong> recipient{result.created === 1 ? "" : "s"}
              {result.addedToGroup > 0 ? (
                <>
                  {" "}
                  to <strong>{groupName.trim()}</strong>
                </>
              ) : null}
              .{" "}
              {result.noEmail > 0
                ? `${result.noEmail} user${result.noEmail === 1 ? "" : "s"} without an email ${result.noEmail === 1 ? "wasn't" : "weren't"} imported.`
                : ""}
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : users ? (
          users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{source.name} has no known users yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                {users.map((user) => (
                  <li key={user.externalId} className="flex flex-wrap items-center gap-2 rounded px-1.5 py-1">
                    <input
                      type="checkbox"
                      id={`import-user-${source.id}-${user.externalId}`}
                      checked={selected.has(user.externalId)}
                      disabled={!emailFor(user)}
                      onChange={() => toggle(user.externalId)}
                      className="size-4 shrink-0 accent-primary disabled:opacity-50"
                    />
                    <label
                      htmlFor={`import-user-${source.id}-${user.externalId}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{user.username}</span>
                      {user.email ? (
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      ) : null}
                    </label>
                    {user.email ? null : (
                      <Input
                        type="email"
                        aria-label={`Email for ${user.username}`}
                        placeholder="Add an email"
                        value={typedEmails[user.externalId] ?? ""}
                        onChange={(e) => typeEmail(user, e.target.value)}
                        disabled={submitting}
                        className="h-8 basis-full sm:basis-56"
                      />
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-users-group">Add to group</Label>
                <Input
                  id="import-users-group"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  {groupExists
                    ? "Existing group — imported recipients will be added to it."
                    : "A new group will be created."}
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={submitting || selectedWithEmailCount === 0}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Import {selectedWithEmailCount || ""} recipient{selectedWithEmailCount === 1 ? "" : "s"}
                </Button>
              </DialogFooter>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface RowState {
  testing: boolean;
  testResult: string | null;
  confirmingDelete: boolean;
  deleting: boolean;
}

function SourceRow({
  source,
  groups,
  onGroupsChange,
  onChanged,
  onDeleted,
  onStatusChange,
}: {
  source: SourceConnection;
  groups: RecipientGroup[];
  onGroupsChange: (updater: (prev: RecipientGroup[]) => RecipientGroup[]) => void;
  onChanged: (source: SourceConnection) => void;
  onDeleted: (id: string) => void;
  onStatusChange: (id: string, status: SourceConnection["status"], lastError: string | null) => void;
}) {
  const [state, setState] = useState<RowState>({
    testing: false,
    testResult: null,
    confirmingDelete: false,
    deleting: false,
  });

  async function handleTest() {
    setState((s) => ({ ...s, testing: true, testResult: null }));
    try {
      const result = await testSourceConnection(source.id);
      onStatusChange(source.id, result.ok ? "ok" : "error", result.ok ? null : (result.message ?? "Unknown error"));
      const message = result.ok ? "Connection succeeded." : (result.message ?? "Connection failed.");
      setState((s) => ({ ...s, testing: false, testResult: message }));
      toast({
        variant: result.ok ? "success" : "destructive",
        title: result.ok ? "Connection succeeded" : "Connection failed",
        description: result.ok ? undefined : message,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setState((s) => ({ ...s, testing: false, testResult: message }));
      toast({ variant: "destructive", title: "Connection failed", description: message });
    }
  }

  async function handleDelete() {
    setState((s) => ({ ...s, deleting: true }));
    try {
      await deleteSource(source.id);
      onDeleted(source.id);
      toast({ variant: "success", title: "Source deleted", description: `${source.name} was removed.` });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete.";
      setState((s) => ({
        ...s,
        deleting: false,
        confirmingDelete: false,
        testResult: message,
      }));
      toast({ variant: "destructive", title: "Failed to delete source", description: message });
    }
  }

  const Icon = KIND_ICON[source.kind] ?? Server;

  return (
    <ListRow
      leading={
        // The service's own logo when one is bundled; a category icon otherwise.
        hasSourceLogo(source.kind) ? (
          <SourceLogo kind={source.kind} className="size-9" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )
      }
      primary={
        <>
          <p className="truncate font-medium">{source.name}</p>
          <Badge variant="neutral">{kindLabel(source.kind)}</Badge>
          <StatusBadge status={source.status} />
        </>
      }
      secondary={
        <>
          <p className="truncate text-sm text-muted-foreground">{source.baseUrl}</p>
          {state.testResult ? <p className="text-sm text-muted-foreground">{state.testResult}</p> : null}
        </>
      }
      actions={
        state.confirmingDelete ? (
          <>
            <span className="text-sm text-muted-foreground">Delete this source?</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={state.deleting}
            >
              {state.deleting ? <Loader2 className="animate-spin" /> : null}
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState((s) => ({ ...s, confirmingDelete: false }))}
              disabled={state.deleting}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={state.testing}>
              {state.testing ? <Loader2 className="animate-spin" /> : null}
              Test connection
            </Button>
            {KINDS_WITH_USER_IMPORT.has(source.kind) ? (
              <ImportSourceUsersDialog source={source} groups={groups} onGroupsChange={onGroupsChange} />
            ) : null}
            <EditSourceDialog source={source} onSaved={onChanged} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${source.name}`}
              onClick={() => setState((s) => ({ ...s, confirmingDelete: true }))}
            >
              <Trash2 />
            </Button>
          </>
        )
      }
    />
  );
}

export function SourcesPage() {
  const [sources, setSources] = useState<SourceConnection[] | null>(null);
  const [kinds, setKinds] = useState<string[]>(FALLBACK_KINDS);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listSources()
      .then(({ sources: loaded }) => setSources(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load sources."));
    // A failure here just keeps the FALLBACK_KINDS default — it shouldn't
    // block the sources list (the more important half of this page) from
    // loading.
    listSourceKinds()
      .then(({ kinds: loaded }) => {
        if (loaded.length > 0) setKinds(sortKinds(loaded));
      })
      .catch(() => undefined);
    // Only needed for ImportSourceUsersDialog's "reuse an existing group"
    // check — a failure here just means every import creates a fresh
    // group instead of reusing one, not worth its own error state.
    listGroups()
      .then(({ groups: loaded }) => setGroups(loaded))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sources"
        description="Connect and manage Tautulli, Plex, and other media source connections."
        actions={
          sources ? (
            <AddSourceDialog
              kinds={kinds}
              onCreated={(source) => setSources((prev) => [...(prev ?? []), source])}
            />
          ) : null
        }
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {sources === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading sources...
        </div>
      ) : null}

      {sources && sources.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sources yet</CardTitle>
            <CardDescription>Add a source to start pulling in recently-added content.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {sources && sources.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              groups={groups}
              onGroupsChange={(updater) => setGroups(updater)}
              onChanged={(updated) =>
                setSources((prev) => (prev ?? []).map((s) => (s.id === updated.id ? updated : s)))
              }
              onDeleted={(id) => setSources((prev) => (prev ?? []).filter((s) => s.id !== id))}
              onStatusChange={(id, status, lastError) =>
                setSources((prev) =>
                  (prev ?? []).map((s) => (s.id === id ? { ...s, status, lastError } : s)),
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
