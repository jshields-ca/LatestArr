import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Pencil, Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
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
import { SaveActions } from "@/components/ui/save-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { ImportRecipientsDialog, UndoLastImport } from "@/components/import-recipients-dialog";
import { ConfirmDeleteButton, ListRow } from "@/components/list-row";
import {
  ApiError,
  addGroupMember,
  createGroup,
  createRecipient,
  deleteGroup,
  deleteRecipient,
  getGroupMembers,
  getRecipientGroups,
  listGroups,
  listRecipients,
  removeGroupMember,
  updateGroup,
  updateRecipient,
  type Recipient,
  type RecipientGroup,
} from "@/lib/api";
import { compareText, matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { guardClose, saveShortcutRef, useUnsavedChanges } from "@/lib/unsaved-changes";

// The edit panel and the Groups section both show group membership. The
// panel reports its changes here so the section updates without a page
// refresh (#286): a new group joins the list, and open groups reload their
// members.
interface GroupSync {
  /** Bumped whenever the edit panel changes someone's groups. */
  membershipVersion: number;
  groupCreated: (group: RecipientGroup) => void;
  membershipChanged: () => void;
  /** Loads recipients and groups again, e.g. after an import is undone. */
  reload: () => void;
}

const GroupSyncContext = createContext<GroupSync>({
  membershipVersion: 0,
  groupCreated: () => {},
  membershipChanged: () => {},
  reload: () => {},
});

function AddRecipientDialog({ onCreated }: { onCreated: (recipient: Recipient) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { recipient } = await createRecipient({
        email,
        displayName: displayName || undefined,
      });
      onCreated(recipient);
      setOpen(false);
      setEmail("");
      setDisplayName("");
      toast({ variant: "success", title: "Recipient added", description: recipient.email });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add recipient
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a recipient</DialogTitle>
          <DialogDescription>They'll be eligible to receive any newsletter you add them to.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipient-email">Email</Label>
            <Input
              id="recipient-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipient-name">Name (optional)</Label>
            <Input
              id="recipient-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
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
              Add recipient
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Which groups someone is in, as the Edit dialog holds them until Save:
// existing groups by id, plus names of new groups to create.
interface GroupChoice {
  memberIds: string[];
  newGroups: string[];
}

// Recipient-centric mirror of the Newsletters page's LinkedGroups pattern
// (add-via-dropdown, remove-via-chip), plus "new group", so adding someone
// to a brand-new group doesn't mean leaving the Edit dialog. Like the name
// and email, nothing here is saved until Save (#295). Buttons are
// type="button" because this sits inside the dialog's form.
function RecipientGroupsField({
  allGroups,
  value,
  disabled,
  onChange,
}: {
  allGroups: RecipientGroup[];
  value: GroupChoice;
  disabled: boolean;
  onChange: (value: GroupChoice) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const members = value.memberIds
    .map((id) => allGroups.find((g) => g.id === id))
    .filter((g): g is RecipientGroup => g !== undefined);
  const availableToAdd = allGroups
    .filter((g) => !value.memberIds.includes(g.id))
    .sort((a, b) => compareText(a.name, b.name));

  function handleAdd() {
    if (!selectedId) return;
    onChange({ ...value, memberIds: [...value.memberIds, selectedId] });
    setSelectedId("");
  }

  function handleNewGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    // A name that's already a group adds them to it instead.
    const existing = allGroups.find((g) => compareText(g.name, name) === 0);
    if (existing) {
      if (!value.memberIds.includes(existing.id)) onChange({ ...value, memberIds: [...value.memberIds, existing.id] });
    } else if (!value.newGroups.some((n) => compareText(n, name) === 0)) {
      onChange({ ...value, newGroups: [...value.newGroups, name] });
    }
    setNewGroupName("");
  }

  const chips = [
    ...members.map((group) => ({
      key: group.id,
      name: group.name,
      isNew: false,
      remove: () => onChange({ ...value, memberIds: value.memberIds.filter((id) => id !== group.id) }),
    })),
    ...value.newGroups.map((name) => ({
      key: `new:${name}`,
      name,
      isNew: true,
      remove: () => onChange({ ...value, newGroups: value.newGroups.filter((n) => n !== name) }),
    })),
  ];

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Groups</legend>
      {chips.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not in any groups yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Their groups">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Badge variant="neutral" className="gap-1.5 py-1 pl-2.5 pr-1">
                {chip.name}
                {chip.isNew ? <span className="text-xs font-normal text-muted-foreground">(new)</span> : null}
                <button
                  type="button"
                  aria-label={`Remove from ${chip.name}`}
                  onClick={chip.remove}
                  className="-my-1 rounded-full p-1.5 hover:bg-muted-foreground/20"
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
            aria-label="Add to a group"
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
          <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={!selectedId}>
            Add
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          aria-label="New group name"
          placeholder="New group name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the group, rather than saving the form.
            if (e.key === "Enter") {
              e.preventDefault();
              handleNewGroup();
            }
          }}
          className="max-w-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleNewGroup} disabled={!newGroupName.trim()}>
          <Plus />
          New group
        </Button>
      </div>
    </fieldset>
  );
}

const NO_GROUP_CHANGES: GroupChoice = { memberIds: [], newGroups: [] };

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function EditRecipientDialog({
  recipient,
  onSaved,
}: {
  recipient: Recipient;
  onSaved: (recipient: Recipient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(recipient.email);
  const [displayName, setDisplayName] = useState(recipient.displayName ?? "");
  const [allGroups, setAllGroups] = useState<RecipientGroup[] | null>(null);
  // Their groups as saved, and as chosen in the dialog.
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupChoice>(NO_GROUP_CHANGES);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = useContext(GroupSyncContext);

  function loadGroups() {
    setAllGroups(null);
    setGroupsError(null);
    Promise.all([listGroups(), getRecipientGroups(recipient.id)])
      .then(([{ groups: all }, { groups: member }]) => {
        const ids = member.map((g) => g.id);
        setAllGroups(all);
        setSavedIds(ids);
        setGroups({ memberIds: ids, newGroups: [] });
      })
      .catch((err) => setGroupsError(err instanceof ApiError ? err.message : "Failed to load groups."));
  }

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setEmail(recipient.email);
      setDisplayName(recipient.displayName ?? "");
      setError(null);
      loadGroups();
    }
  }

  const detailsChanged = email !== recipient.email || displayName !== (recipient.displayName ?? "");
  const groupsChanged = !sameIds(groups.memberIds, savedIds) || groups.newGroups.length > 0;
  const dirty = detailsChanged || groupsChanged;
  useUnsavedChanges(open && dirty);
  const changeOpen = guardClose(dirty, openWithCurrentValues);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    let membershipChanged = false;
    try {
      if (detailsChanged) {
        const { recipient: updated } = await updateRecipient(recipient.id, {
          email,
          displayName: displayName || undefined,
        });
        onSaved(updated);
      }
      const add = groups.memberIds.filter((id) => !savedIds.includes(id));
      const remove = savedIds.filter((id) => !groups.memberIds.includes(id));
      for (const name of groups.newGroups) {
        const { group } = await createGroup({ name });
        sync.groupCreated(group);
        add.push(group.id);
      }
      for (const id of add) {
        await addGroupMember(id, recipient.id);
        membershipChanged = true;
      }
      for (const id of remove) {
        await removeGroupMember(id, recipient.id);
        membershipChanged = true;
      }
      toast({ variant: "success", title: "Recipient updated" });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      // Some changes may have saved: show their groups as they are now.
      if (groupsChanged) loadGroups();
    } finally {
      if (membershipChanged) sync.membershipChanged();
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${recipient.email}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit recipient</DialogTitle>
          <DialogDescription>Update their details and which groups they belong to, then save.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} ref={saveShortcutRef} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-recipient-email">Email</Label>
            <Input
              id="edit-recipient-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-recipient-name">Name (optional)</Label>
            <Input
              id="edit-recipient-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="border-t border-border pt-4">
            {groupsError ? (
              <p role="alert" className="text-sm text-destructive">
                {groupsError}
              </p>
            ) : allGroups === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading groups...
              </div>
            ) : (
              <RecipientGroupsField allGroups={allGroups} value={groups} disabled={submitting} onChange={setGroups} />
            )}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <SaveActions dirty={dirty} saving={submitting} disabled={allGroups === null}>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </SaveActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecipientTableRow({
  recipient,
  onChanged,
  onDeleted,
}: {
  recipient: Recipient;
  onChanged: (recipient: Recipient) => void;
  onDeleted: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle(nextActive: boolean) {
    setToggling(true);
    try {
      const { recipient: updated } = await updateRecipient(recipient.id, { isActive: nextActive });
      onChanged(updated);
      toast({ variant: "success", title: nextActive ? "Recipient activated" : "Recipient deactivated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update recipient",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setToggling(false);
    }
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30">
      <td className="max-w-0 py-2.5 pl-4 pr-4">
        <p className="truncate font-medium">
          {recipient.displayName || <span className="text-muted-foreground">&mdash;</span>}
        </p>
        {/* Phones don't have room for a separate Email column, so the
            address sits under the name instead. */}
        <p className="truncate text-xs text-muted-foreground sm:hidden">{recipient.email}</p>
      </td>
      <td className="hidden max-w-0 py-2.5 pr-4 sm:table-cell">
        <p className="truncate text-muted-foreground">{recipient.email}</p>
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <Switch
            id={`recipient-active-${recipient.id}`}
            checked={recipient.isActive}
            onCheckedChange={(checked) => void handleToggle(checked)}
            disabled={toggling}
            aria-label={recipient.isActive ? "Active" : "Inactive"}
          />
          <Label htmlFor={`recipient-active-${recipient.id}`} className="hidden text-muted-foreground sm:block">
            {recipient.isActive ? "Active" : "Inactive"}
          </Label>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center justify-end gap-1">
          <EditRecipientDialog recipient={recipient} onSaved={onChanged} />
          <ConfirmDeleteButton
            label={`Delete ${recipient.email}`}
            onConfirm={() =>
              deleteRecipient(recipient.id)
                .then(() => {
                  onDeleted(recipient.id);
                  toast({ variant: "success", title: "Recipient deleted" });
                })
                .catch((err) => {
                  toast({
                    variant: "destructive",
                    title: "Failed to delete recipient",
                    description: err instanceof ApiError ? err.message : undefined,
                  });
                  throw err;
                })
            }
          />
        </div>
      </td>
    </tr>
  );
}

// How many rows render per page. Large imported lists (see issue #153 —
// a Tautulli/Plex user import can easily add several dozen recipients at
// once) turned the page into one long scroll with nothing to orient by;
// this plus the search box and sortable columns below keep the page
// navigable regardless of list size without needing real pagination on
// the API side.
const RECIPIENTS_PAGE_SIZE = 25;

function matchesRecipientQuery(recipient: Recipient, query: string): boolean {
  return matchesSearch(query, recipient.displayName, recipient.email);
}

type RecipientSortKey = "name" | "email" | "status";

function recipientSortValue(recipient: Recipient, key: RecipientSortKey): string | number {
  switch (key) {
    case "name":
      return recipient.displayName || recipient.email;
    case "email":
      return recipient.email;
    case "status":
      return recipient.isActive ? 1 : 0;
  }
}

function SortableColumnHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: RecipientSortKey;
  activeSortKey: RecipientSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: RecipientSortKey) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-my-1.5 flex items-center gap-1 py-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden="true" />
      </button>
    </th>
  );
}

function RecipientsSection({
  recipients,
  loadError,
  onRecipientsChange,
}: {
  recipients: Recipient[] | null;
  loadError: string | null;
  onRecipientsChange: (updater: (prev: Recipient[]) => Recipient[]) => void;
}) {
  // An import can create groups and add people to them.
  const groupSync = useContext(GroupSyncContext);
  // Bumped after an import, so Undo last import looks again.
  const [importVersion, setImportVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<RecipientSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: RecipientSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(
    () => (recipients ?? []).filter((r) => matchesRecipientQuery(r, query)),
    [recipients, query],
  );
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = recipientSortValue(a, sortKey);
      const bv = recipientSortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") return compareText(av, bv) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / RECIPIENTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * RECIPIENTS_PAGE_SIZE;
  const pageItems = sorted.slice(pageStart, pageStart + RECIPIENTS_PAGE_SIZE);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Recipients</h2>
        {recipients ? (
          <div className="flex items-center gap-2">
            <ImportRecipientsDialog
              onImported={({ created, updated, createdGroups, membershipsAdded }) => {
                onRecipientsChange((prev) => [
                  ...prev.map((recipient) => updated.find((row) => row.id === recipient.id) ?? recipient),
                  ...created,
                ]);
                createdGroups.forEach(groupSync.groupCreated);
                if (membershipsAdded > 0) groupSync.membershipChanged();
                setImportVersion((v) => v + 1);
              }}
            />
            <UndoLastImport refreshKey={importVersion} onUndone={groupSync.reload} />
            <AddRecipientDialog onCreated={(r) => onRecipientsChange((prev) => [...prev, r])} />
          </div>
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {recipients === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading recipients...
        </div>
      ) : null}

      {recipients && recipients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No recipients yet</CardTitle>
            <CardDescription>Add a recipient to start building a distribution list.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {recipients && recipients.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search recipients by name or email"
                placeholder="Search by name or email..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <p className="shrink-0 text-sm text-muted-foreground">
              {query.trim()
                ? `${filtered.length} of ${recipients.length} match`
                : `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipients match "{query.trim()}".</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Recipients</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs">
                      <SortableColumnHeader
                        label="Name"
                        sortKey="name"
                        activeSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="px-4 py-2.5 sm:w-2/5"
                      />
                      <SortableColumnHeader
                        label="Email"
                        sortKey="email"
                        activeSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="hidden w-2/5 py-2.5 sm:table-cell"
                      />
                      <SortableColumnHeader
                        label="Status"
                        sortKey="status"
                        activeSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="w-px py-2.5 pr-4"
                      />
                      <th scope="col" className="w-px py-2.5 pr-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((recipient) => (
                      <RecipientTableRow
                        key={recipient.id}
                        recipient={recipient}
                        onChanged={(updated) =>
                          onRecipientsChange((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
                        }
                        onDeleted={(id) => onRecipientsChange((prev) => prev.filter((r) => r.id !== id))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {safePage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AddGroupDialog({ onCreated }: { onCreated: (group: RecipientGroup) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { group } = await createGroup({ name, description: description || undefined });
      onCreated(group);
      setOpen(false);
      setName("");
      setDescription("");
      toast({ variant: "success", title: "Group added", description: group.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a group</DialogTitle>
          <DialogDescription>Groups are what a newsletter actually sends to.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              Add group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupDialog({
  group,
  onSaved,
}: {
  group: RecipientGroup;
  onSaved: (group: RecipientGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setName(group.name);
      setDescription(group.description ?? "");
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { group: updated } = await updateGroup(group.id, {
        name,
        description: description || undefined,
      });
      onSaved(updated);
      setOpen(false);
      toast({ variant: "success", title: "Group updated" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const dirty = name !== group.name || description !== (group.description ?? "");
  useUnsavedChanges(open && dirty);

  return (
    <Dialog open={open} onOpenChange={guardClose(dirty, openWithCurrentValues)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${group.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>Update this group's name or description.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} ref={saveShortcutRef} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-group-name">Name</Label>
            <Input
              id="edit-group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-group-description">Description (optional)</Label>
            <Input
              id="edit-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <SaveActions dirty={dirty} saving={submitting} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupMembers({ groupId, allRecipients }: { groupId: string; allRecipients: Recipient[] }) {
  const [members, setMembers] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { membershipVersion } = useContext(GroupSyncContext);

  // Reloads when the edit panel changes anyone's groups. The current list
  // stays up while it does, and a slower earlier load can't overwrite it.
  useEffect(() => {
    let current = true;
    getGroupMembers(groupId)
      .then(({ members: loaded }) => {
        if (current) setMembers(loaded);
      })
      .catch((err) => {
        if (current) setLoadError(err instanceof ApiError ? err.message : "Failed to load members.");
      });
    return () => {
      current = false;
    };
  }, [groupId, membershipVersion]);

  // Everyone not already in the group, by name (#287). Inactive people can
  // still be added, and say so.
  const pickerOptions = useMemo(
    () =>
      allRecipients
        .filter((r) => !members?.some((m) => m.id === r.id))
        .sort((a, b) => compareText(a.displayName || a.email, b.displayName || b.email))
        .map((r) => ({
          value: r.id,
          label: r.displayName || r.email,
          detail: [r.displayName ? r.email : null, r.isActive ? null : "inactive"].filter(Boolean).join(" · ") || undefined,
        })),
    [allRecipients, members],
  );

  async function handleAdd(recipientId: string) {
    const added = allRecipients.find((r) => r.id === recipientId);
    try {
      await addGroupMember(groupId, recipientId);
      if (added) setMembers((prev) => (prev?.some((m) => m.id === added.id) ? prev : [...(prev ?? []), added]));
      toast({ variant: "success", title: "Member added to group", description: added?.displayName || added?.email });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to add member",
        description: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  async function handleRemove(recipientId: string) {
    setRemovingId(recipientId);
    try {
      await removeGroupMember(groupId, recipientId);
      setMembers((prev) => (prev ?? []).filter((m) => m.id !== recipientId));
      toast({ variant: "success", title: "Member removed from group" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to remove member",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRemovingId(null);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (members === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading members...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li key={member.id}>
              <Badge variant="neutral" className="gap-1.5 py-1 pl-2.5 pr-1">
                {member.displayName || member.email}
                <button
                  type="button"
                  aria-label={`Remove ${member.email} from group`}
                  onClick={() => void handleRemove(member.id)}
                  disabled={removingId === member.id}
                  className="-my-1 rounded-full p-1.5 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {pickerOptions.length > 0 ? (
        <Combobox
          aria-label="Add a recipient to this group"
          placeholder="Add someone: type a name or email..."
          options={pickerOptions}
          onSelect={(recipientId) => void handleAdd(recipientId)}
          emptyText="Nobody matches."
          className="max-w-sm"
        />
      ) : null}
    </div>
  );
}

function GroupCard({
  group,
  allRecipients,
  onChanged,
  onDeleted,
}: {
  group: RecipientGroup;
  allRecipients: Recipient[];
  onChanged: (group: RecipientGroup) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ListRow
      primary={<span className="truncate font-medium">{group.name}</span>}
      secondary={
        group.description ? (
          <span className="block truncate text-sm text-muted-foreground">{group.description}</span>
        ) : null
      }
      expand={{ expanded, onToggle: () => setExpanded((e) => !e) }}
      actions={
        <>
          <EditGroupDialog group={group} onSaved={onChanged} />
          <ConfirmDeleteButton
            label={`Delete ${group.name}`}
            onConfirm={() =>
              deleteGroup(group.id)
                .then(() => {
                  onDeleted(group.id);
                  toast({ variant: "success", title: "Group deleted" });
                })
                .catch((err) => {
                  toast({
                    variant: "destructive",
                    title: "Failed to delete group",
                    description: err instanceof ApiError ? err.message : undefined,
                  });
                  throw err;
                })
            }
          />
        </>
      }
    >
      {expanded ? (
        <div className="border-t border-border pt-3">
          <GroupMembers groupId={group.id} allRecipients={allRecipients} />
        </div>
      ) : null}
    </ListRow>
  );
}

function GroupsSection({
  allRecipients,
  groups,
  loadError,
  setGroups,
}: {
  allRecipients: Recipient[];
  groups: RecipientGroup[] | null;
  loadError: string | null;
  setGroups: (updater: (prev: RecipientGroup[] | null) => RecipientGroup[] | null) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Groups</h2>
        {groups ? <AddGroupDialog onCreated={(g) => setGroups((prev) => [...(prev ?? []), g])} /> : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {groups === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading groups...
        </div>
      ) : null}

      {groups && groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>Groups are what a newsletter actually sends to — add one to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {groups && groups.length > 0 ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              allRecipients={allRecipients}
              onChanged={(updated) =>
                setGroups((prev) => (prev ?? []).map((g) => (g.id === updated.id ? updated : g)))
              }
              onDeleted={(id) => setGroups((prev) => (prev ?? []).filter((g) => g.id !== id))}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groups, setGroups] = useState<RecipientGroup[] | null>(null);
  const [groupsLoadError, setGroupsLoadError] = useState<string | null>(null);
  const [membershipVersion, setMembershipVersion] = useState(0);

  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    listRecipients()
      .then(({ recipients: loaded }) => setRecipients(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load recipients."));
    listGroups()
      .then(({ groups: loaded }) => setGroups(loaded))
      .catch((err) => setGroupsLoadError(err instanceof ApiError ? err.message : "Failed to load groups."));
  }, [loadVersion]);

  const groupSync = useMemo<GroupSync>(
    () => ({
      membershipVersion,
      groupCreated: (group) =>
        setGroups((prev) => (prev && !prev.some((g) => g.id === group.id) ? [...prev, group] : prev)),
      membershipChanged: () => setMembershipVersion((v) => v + 1),
      reload: () => {
        setLoadVersion((v) => v + 1);
        setMembershipVersion((v) => v + 1);
      },
    }),
    [membershipVersion],
  );

  return (
    <GroupSyncContext.Provider value={groupSync}>
      <div className="flex flex-col gap-8">
        <PageHeader title="Recipients" description="Manage recipients and the groups newsletters send to." />

        <RecipientsSection
          recipients={recipients}
          loadError={loadError}
          onRecipientsChange={(updater) => setRecipients((prev) => updater(prev ?? []))}
        />
        <GroupsSection
          allRecipients={recipients ?? []}
          groups={groups}
          loadError={groupsLoadError}
          setGroups={setGroups}
        />
      </div>
    </GroupSyncContext.Provider>
  );
}
