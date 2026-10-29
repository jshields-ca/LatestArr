import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";
import {
  addGroupMember,
  ApiError,
  createGroup,
  importRecipients,
  listGroups,
  listSources,
  listSourceUsers,
  type RecipientGroup,
  type SourceConnection,
  type SourceUser,
} from "@/lib/api";

// Only these source kinds' adapters implement listUsers (see
// packages/adapters/*/src/*-adapter.ts) — checked here too so the
// "Import users" action only appears where it can actually work, rather
// than every row offering it and most of them 404ing.
export const KINDS_WITH_USER_IMPORT = new Set(["plex", "tautulli", "jellyfin", "emby", "audiobookshelf", "romm"]);

// Loose on purpose: the server validates properly on import.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// By name, so a list of friends reads like one (#398); the source's own
// order is often by email or account ID.
function byName(a: SourceUser, b: SourceUser): number {
  return a.username.localeCompare(b.username, undefined, { sensitivity: "base", numeric: true });
}

// Fetches the source's known users, lets the admin pick which ones (only
// those with a known email — a recipient can't exist without one) to
// import as recipients, and adds them to a group named after the source
// — reusing that name across repeat imports rather than creating a new
// group every time, the same way `importRecipients` itself skips a
// recipient whose email already exists rather than duplicating it.
// With `open` given, the caller opens it (the Recipients page's source
// picker); otherwise it has its own "Import users" button (Sources page).
export function ImportSourceUsersDialog({
  source,
  open: openProp,
  onOpenChange,
  onImported,
}: {
  source: SourceConnection;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onImported?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<SourceUser[] | null>(null);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Emails typed in for users the source has none for (Plex, Jellyfin, ...).
  const [typedEmails, setTypedEmails] = useState<Record<string, string>>({});
  const [groupName, setGroupName] = useState(source.name);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; addedToGroup: number; noEmail: number } | null>(
    null,
  );

  function setOpen(next: boolean) {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
  }

  // Each opening starts afresh, with the source's users and the current groups.
  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    setResult(null);
    setGroupName(source.name);
    setUsers(null);
    setTypedEmails({});
    setLoading(true);
    // Without the groups, an import still works; it just can't reuse one.
    Promise.all([listSourceUsers(source.id), listGroups().catch(() => ({ groups: [] as RecipientGroup[] }))])
      .then(([{ users: loaded }, { groups: loadedGroups }]) => {
        setUsers([...loaded].sort(byName));
        setGroups(loadedGroups);
        setSelected(new Set(loaded.filter((u) => u.email).map((u) => u.externalId)));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, [open, source.id, source.name]);

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
        setGroups((prev) => [...prev, created]);
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
      onImported?.();
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
    <Dialog open={open} onOpenChange={setOpen}>
      {controlled ? null : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlus />
            Import users
          </Button>
        </DialogTrigger>
      )}
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
                      {user.email && user.email !== user.username ? (
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

// The Recipients page's way in (#398): the setup checklist sends people
// there after connecting a source, so importing a source's users is
// offered there too, not only on each source's row.
export function ImportFromSourceButton({ onImported }: { onImported: () => void }) {
  const [sources, setSources] = useState<SourceConnection[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [active, setActive] = useState<SourceConnection | null>(null);

  useEffect(() => {
    listSources()
      .then(({ sources: loaded }) => setSources(loaded.filter((s) => KINDS_WITH_USER_IMPORT.has(s.kind))))
      .catch(() => setSources([]));
  }, []);

  if (!sources) return null;
  return (
    <>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <UserPlus />
            From a source
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex flex-col gap-1 p-2">
          {sources.length === 0 ? (
            <p className="p-1 text-sm text-muted-foreground">
              Connect Plex, Tautulli, Jellyfin, Emby, Audiobookshelf or RomM on the{" "}
              <Link to="/sources" className="font-medium text-foreground underline underline-offset-4">
                Sources
              </Link>{" "}
              page to import its users.
            </p>
          ) : (
            sources.map((source) => (
              <Button
                key={source.id}
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  setPickerOpen(false);
                  setActive(source);
                }}
              >
                Import users from {source.name}
              </Button>
            ))
          )}
        </PopoverContent>
      </Popover>
      {active ? (
        <ImportSourceUsersDialog
          source={active}
          open
          onOpenChange={(next) => {
            if (!next) setActive(null);
          }}
          onImported={onImported}
        />
      ) : null}
    </>
  );
}
