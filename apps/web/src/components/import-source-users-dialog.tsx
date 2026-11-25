import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectAllCheckbox } from "@/components/select-all-checkbox";
import { toast } from "@/components/ui/use-toast";
import {
  addGroupMember,
  ApiError,
  createGroup,
  importRecipients,
  listGroups,
  listRecipients,
  listSources,
  listSourceUsers,
  type Recipient,
  type RecipientGroup,
  type SourceConnection,
  type SourceUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

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

// Group names match ignoring case and surrounding spaces, as the file
// import's do, so "friends" finds Friends rather than making a second one.
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Fetches the source's known users, lets the admin pick which ones (only
// those with a known email — a recipient can't exist without one) to
// import as recipients, and adds them to a group if they like (#472): by
// default one named after the source, reused across repeat imports rather
// than creating a new group every time. Anyone whose email is already on the list is shown as
// such and can't be picked (#452): the import leaves them as they are,
// name, groups and all.
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
  // Emails already on the list, lowercased: those people aren't imported again.
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Emails typed in for users the source has none for (Plex, Jellyfin, ...).
  const [typedEmails, setTypedEmails] = useState<Record<string, string>>({});
  // "none", "new", or `group:<id>` for one already there (#472).
  const [groupChoice, setGroupChoice] = useState("new");
  const [newGroupName, setNewGroupName] = useState(source.name);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    addedToGroup: number;
    groupName?: string;
    noEmail: number;
    alreadyOnList: number;
  } | null>(null);

  function setOpen(next: boolean) {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
  }

  // Each opening starts afresh, with the source's users and the current groups.
  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    setResult(null);
    setGroupChoice("new");
    setNewGroupName(source.name);
    setUsers(null);
    setTypedEmails({});
    setLoading(true);
    // Without the groups, an import still works; it just can't reuse one.
    // Without the recipients, no one's marked as already on the list, but
    // the import still leaves them as they are.
    Promise.all([
      listSourceUsers(source.id),
      listGroups().catch(() => ({ groups: [] as RecipientGroup[] })),
      listRecipients().catch(() => ({ recipients: [] as Recipient[] })),
    ])
      .then(([{ users: loaded }, { groups: loadedGroups }, { recipients: loadedRecipients }]) => {
        const emails = new Set(loadedRecipients.map((r) => r.email.toLowerCase()));
        setUsers([...loaded].sort(byName));
        setGroups(loadedGroups);
        // As before, a group named after the source by default: the one
        // already there, or a new one.
        const named = loadedGroups.find((g) => sameName(g.name, source.name));
        setGroupChoice(named ? `group:${named.id}` : "new");
        setExistingEmails(emails);
        setSelected(
          new Set(loaded.filter((u) => u.email && !emails.has(u.email.toLowerCase())).map((u) => u.externalId)),
        );
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, [open, source.id, source.name]);

  function emailFor(user: SourceUser): string | undefined {
    if (user.email) return user.email;
    const typed = typedEmails[user.externalId]?.trim();
    return typed && EMAIL_PATTERN.test(typed) ? typed : undefined;
  }

  function isOnList(user: SourceUser): boolean {
    const email = emailFor(user);
    return email !== undefined && existingEmails.has(email.toLowerCase());
  }

  // Who can be imported: with an email, and not already on the list.
  function canImport(user: SourceUser): boolean {
    return Boolean(emailFor(user)) && !isOnList(user);
  }

  // Who will be: those of them who are ticked.
  function importable(user: SourceUser): boolean {
    return selected.has(user.externalId) && canImport(user);
  }

  // Typing a complete address selects the user; clearing it deselects them.
  function typeEmail(user: SourceUser, value: string) {
    setTypedEmails((prev) => ({ ...prev, [user.externalId]: value }));
    const valid = EMAIL_PATTERN.test(value.trim()) && !existingEmails.has(value.trim().toLowerCase());
    setSelected((prev) => {
      const next = new Set(prev);
      if (valid) next.add(user.externalId);
      else next.delete(user.externalId);
      return next;
    });
  }

  // Select all ticks everyone who can be imported (#453).
  function selectAll(all: boolean) {
    setSelected(all && users ? new Set(users.filter(canImport).map((u) => u.externalId)) : new Set());
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
    const rows = users.filter(importable).map((u) => ({ email: emailFor(u)!, displayName: u.username }));
    if (rows.length === 0) return;

    setSubmitting(true);
    try {
      const importResult = await importRecipients(rows);

      let group: RecipientGroup | undefined;
      if (groupChoice.startsWith("group:")) {
        group = groups.find((g) => g.id === groupChoice.slice("group:".length));
      } else if (groupChoice === "new") {
        // A name that's already a group's joins that group, not a second one.
        const name = newGroupName.trim();
        group = groups.find((g) => sameName(g.name, name));
        if (!group && name) {
          const { group: created } = await createGroup({ name });
          group = created;
          setGroups((prev) => [...prev, created]);
        }
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
        groupName: group?.name,
        noEmail: users.filter((u) => !emailFor(u)).length,
        alreadyOnList: users.filter(isOnList).length,
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

  const importCount = users ? users.filter(importable).length : 0;
  const canImportCount = users ? users.filter(canImport).length : 0;
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));
  const newNameMatch = groupChoice === "new" ? groups.find((g) => sameName(g.name, newGroupName)) : undefined;
  const needsGroupName = groupChoice === "new" && !newGroupName.trim();

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
            Add its users as recipients, and to a group if you like. Anyone already on your list is left as they are. Type an
            email for anyone {source.name} doesn&apos;t have one for.
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
                  to <strong>{result.groupName}</strong>
                </>
              ) : null}
              .{" "}
              {result.alreadyOnList > 0
                ? `${result.alreadyOnList} already on your list ${result.alreadyOnList === 1 ? "was" : "were"} left as they are. `
                : ""}
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
              <div className="flex flex-col gap-1.5">
                <SelectAllCheckbox
                  total={canImportCount}
                  selected={importCount}
                  onChange={selectAll}
                  disabled={submitting}
                  className="px-2"
                />
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                  {users.map((user) => {
                    const onList = isOnList(user);
                    // Plex can list an account with no name; it still needs one here.
                    const name = user.username.trim() || `Unnamed user ${user.externalId}`;
                    return (
                      <li key={user.externalId} className="flex flex-wrap items-center gap-2 rounded px-1.5 py-1">
                        <input
                          type="checkbox"
                          id={`import-user-${source.id}-${user.externalId}`}
                          checked={selected.has(user.externalId) && !onList}
                          disabled={!emailFor(user) || onList}
                          onChange={() => toggle(user.externalId)}
                          className="size-4 shrink-0 accent-primary disabled:opacity-50"
                        />
                        <label
                          htmlFor={`import-user-${source.id}-${user.externalId}`}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={cn("truncate", !user.username.trim() && "italic text-muted-foreground")}>{name}</span>
                            {onList ? (
                              <Badge variant="neutral" className="shrink-0">
                                Already on your list
                              </Badge>
                            ) : null}
                          </span>
                          {user.email && user.email !== user.username ? (
                            // Narrow, the email gives way before the name does.
                            <span className="shrink-[3] truncate text-xs text-muted-foreground">{user.email}</span>
                          ) : null}
                        </label>
                        {user.email ? null : (
                          <Input
                            type="email"
                            aria-label={`Email for ${name}`}
                            placeholder="Add an email"
                            value={typedEmails[user.externalId] ?? ""}
                            onChange={(e) => typeEmail(user, e.target.value)}
                            disabled={submitting}
                            className="h-8 basis-full sm:basis-56"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-users-group">Group</Label>
                <Select
                  id="import-users-group"
                  value={groupChoice}
                  onChange={(e) => setGroupChoice(e.target.value)}
                  disabled={submitting}
                >
                  <option value="none">Don't add to a group</option>
                  {sortedGroups.map((g) => (
                    <option key={g.id} value={`group:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                  <option value="new">New group…</option>
                </Select>
                {groupChoice === "new" ? (
                  <Input
                    aria-label="New group name"
                    placeholder="Group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    disabled={submitting}
                    aria-describedby="import-users-group-hint"
                  />
                ) : null}
                <p id="import-users-group-hint" className="text-xs text-muted-foreground">
                  {groupChoice === "none"
                    ? "They're added as recipients only. You can add them to groups later."
                    : groupChoice !== "new"
                      ? "They're added to this group."
                      : needsGroupName
                        ? "Name the new group, or choose Don't add to a group."
                        : newNameMatch
                          ? `You already have ${newNameMatch.name}; they're added to it.`
                          : "A new group is created for them."}
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={submitting || importCount === 0 || needsGroupName}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  {importCount === 0 ? "Import" : `Import ${importCount} ${importCount === 1 ? "person" : "people"}`}
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
        <PopoverContent align="end" aria-label="Import users from a source" className="flex flex-col gap-1 p-2">
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
