import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  ApiError,
  addGroupMember,
  createGroup,
  createRecipient,
  deleteGroup,
  deleteRecipient,
  getGroupMembers,
  listGroups,
  listRecipients,
  removeGroupMember,
  updateRecipient,
  type Recipient,
  type RecipientGroup,
} from "@/lib/api";

function ConfirmDelete({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon" aria-label={label} onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Delete?</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={deleting}
        onClick={() => {
          setDeleting(true);
          void onConfirm();
        }}
      >
        {deleting ? <Loader2 className="animate-spin" /> : null}
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
        Cancel
      </Button>
    </div>
  );
}

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setEmail(recipient.email);
      setDisplayName(recipient.displayName ?? "");
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { recipient: updated } = await updateRecipient(recipient.id, {
        email,
        displayName: displayName || undefined,
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openWithCurrentValues}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${recipient.email}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit recipient</DialogTitle>
          <DialogDescription>Update this recipient's email or display name.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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

function RecipientRow({
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
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{recipient.displayName || recipient.email}</p>
          {recipient.displayName ? (
            <p className="truncate text-sm text-muted-foreground">{recipient.email}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id={`recipient-active-${recipient.id}`}
              checked={recipient.isActive}
              onCheckedChange={(checked) => void handleToggle(checked)}
              disabled={toggling}
              aria-label={recipient.isActive ? "Active" : "Inactive"}
            />
            <Label htmlFor={`recipient-active-${recipient.id}`} className="text-sm text-muted-foreground">
              {recipient.isActive ? "Active" : "Inactive"}
            </Label>
          </div>
          <EditRecipientDialog recipient={recipient} onSaved={onChanged} />
          <ConfirmDelete
            label={`Delete ${recipient.email}`}
            onConfirm={() => deleteRecipient(recipient.id).then(() => onDeleted(recipient.id))}
          />
        </div>
      </CardContent>
    </Card>
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
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Recipients</h2>
        {recipients ? <AddRecipientDialog onCreated={(r) => onRecipientsChange((prev) => [...prev, r])} /> : null}
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
          {recipients.map((recipient) => (
            <RecipientRow
              key={recipient.id}
              recipient={recipient}
              onChanged={(updated) =>
                onRecipientsChange((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
              }
              onDeleted={(id) => onRecipientsChange((prev) => prev.filter((r) => r.id !== id))}
            />
          ))}
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

function GroupMembers({ groupId, allRecipients }: { groupId: string; allRecipients: Recipient[] }) {
  const [members, setMembers] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    getGroupMembers(groupId)
      .then(({ members: loaded }) => setMembers(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load members."));
  }, [groupId]);

  const availableToAdd = allRecipients.filter(
    (r) => !members?.some((m) => m.id === r.id),
  );

  async function handleAdd() {
    if (!selectedId) return;
    setAdding(true);
    try {
      await addGroupMember(groupId, selectedId);
      const added = allRecipients.find((r) => r.id === selectedId);
      if (added) setMembers((prev) => [...(prev ?? []), added]);
      setSelectedId("");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add member.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(recipientId: string) {
    setRemovingId(recipientId);
    try {
      await removeGroupMember(groupId, recipientId);
      setMembers((prev) => (prev ?? []).filter((m) => m.id !== recipientId));
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
            aria-label="Add a recipient to this group"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Select a recipient...</option>
            {availableToAdd.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName || r.email}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" onClick={() => void handleAdd()} disabled={!selectedId || adding}>
            {adding ? <Loader2 className="animate-spin" /> : null}
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  group,
  allRecipients,
  onDeleted,
}: {
  group: RecipientGroup;
  allRecipients: Recipient[];
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{group.name}</span>
              {group.description ? (
                <span className="block truncate text-sm text-muted-foreground">{group.description}</span>
              ) : null}
            </span>
          </button>
          <ConfirmDelete
            label={`Delete ${group.name}`}
            onConfirm={() => deleteGroup(group.id).then(() => onDeleted(group.id))}
          />
        </div>

        {expanded ? (
          <div className="border-t border-border pt-3">
            <GroupMembers groupId={group.id} allRecipients={allRecipients} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GroupsSection({ allRecipients }: { allRecipients: Recipient[] }) {
  const [groups, setGroups] = useState<RecipientGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listGroups()
      .then(({ groups: loaded }) => setGroups(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load groups."));
  }, []);

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

  useEffect(() => {
    listRecipients()
      .then(({ recipients: loaded }) => setRecipients(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load recipients."));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recipients</h1>
        <p className="text-sm text-muted-foreground">Manage recipients and the groups newsletters send to.</p>
      </div>

      <RecipientsSection
        recipients={recipients}
        loadError={loadError}
        onRecipientsChange={(updater) => setRecipients((prev) => updater(prev ?? []))}
      />
      <GroupsSection allRecipients={recipients ?? []} />
    </div>
  );
}
