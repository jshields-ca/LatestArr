import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Loader2, Plus, UserCheck, UserX } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmDeleteButton, ListRow } from "@/components/list-row";
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
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  createUser,
  deleteUser,
  getAuthProviders,
  listUsers,
  updateUser,
  type ManagedUser,
} from "@/lib/api";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

const MIN_PASSWORD_LENGTH = 12;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function lastSignIn(user: ManagedUser): string {
  if (!user.lastLoginAt) return "Never signed in";
  return `Last signed in ${new Date(user.lastLoginAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`;
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function RoleField({ id, value, onChange }: { id: string; value: Role; onChange: (role: Role) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Role</Label>
      <Select id={id} value={value} onChange={(e) => isRole(e.target.value) && onChange(e.target.value)}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[value]}</p>
    </div>
  );
}

function AddUserDialog({ ssoEnabled, onAdded }: { ssoEnabled: boolean; onAdded: (user: ManagedUser) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The least access unless the admin chooses more, like the server.
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!password && !ssoEnabled) {
      setError("Set a temporary password so they can sign in.");
      return;
    }
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setError(`The temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      const { user } = await createUser({ email, displayName: name, password: password || undefined, role });
      onAdded(user);
      toast({ variant: "success", title: "User added", description: user.email });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't add this user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>Choose what they can do. You can change it later.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <RoleField id="user-role" value={role} onChange={setRole} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-password">Temporary password{ssoEnabled ? " (optional)" : ""}</Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="user-password-hint"
            />
            <p id="user-password-hint" className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters. Share it with them yourself; they&apos;ll choose their own when
              they first sign in.
              {ssoEnabled ? " Leave it blank if they'll sign in with SSO using this email." : ""}
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim() || !email.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Add user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onSaved }: { user: ManagedUser; onSaved: (user: ManagedUser) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`The temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await updateUser(user.id, { password });
      onSaved(updated);
      toast({ variant: "success", title: "Password reset", description: user.email });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't reset the password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setPassword("");
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Reset password for ${user.displayName}`}>
          <KeyRound />
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset {user.displayName}&apos;s password</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out, and asked to choose their own password after signing in with this one.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reset-${user.id}`}>Temporary password</Label>
            <Input
              id={`reset-${user.id}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !password}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(({ users: loaded }) => setUsers(loaded))
      .catch((err) => setLoadError(errorMessage(err, "Couldn't load users.")));
    getAuthProviders()
      .then((providers) => setSsoEnabled(providers.oidc))
      .catch(() => setSsoEnabled(false));
  }, []);

  function replace(updated: ManagedUser) {
    setUsers((prev) => (prev ?? []).map((u) => (u.id === updated.id ? updated : u)));
  }

  async function setRole(user: ManagedUser, role: Role) {
    setBusy(user.id);
    try {
      const { user: updated } = await updateUser(user.id, { role });
      replace(updated);
      toast({ variant: "success", title: "Role changed", description: `${updated.displayName}: ${ROLE_LABELS[role]}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't change the role", description: errorMessage(err, "") || undefined });
    } finally {
      setBusy(null);
    }
  }

  async function setActive(user: ManagedUser, isActive: boolean) {
    setBusy(user.id);
    try {
      const { user: updated } = await updateUser(user.id, { isActive });
      replace(updated);
      toast({ variant: "success", title: isActive ? "User reactivated" : "User deactivated", description: user.email });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't change this user", description: errorMessage(err, "") || undefined });
    } finally {
      setBusy(null);
    }
  }

  function remove(user: ManagedUser) {
    return deleteUser(user.id)
      .then(() => {
        setUsers((prev) => (prev ?? []).filter((u) => u.id !== user.id));
        toast({ variant: "success", title: "User deleted", description: user.email });
      })
      .catch((err) => {
        toast({ variant: "destructive", title: "Couldn't delete this user", description: errorMessage(err, "") || undefined });
        throw err;
      });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Everyone who can sign in to LatestArr, and what they can do."
        actions={users ? <AddUserDialog ssoEnabled={ssoEnabled} onAdded={(u) => setUsers((prev) => [...(prev ?? []), u])} /> : null}
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {users === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading users...
        </div>
      ) : null}

      {users ? (
        <div className="flex flex-col gap-3">
          {users.map((user) => {
            const isMe = user.id === me?.id;
            return (
              <ListRow
                key={user.id}
                primary={
                  <>
                    <p className="truncate font-medium">{user.displayName}</p>
                    {isMe ? <Badge variant="neutral">You</Badge> : null}
                    {/* Your own role is fixed here; another admin changes it. */}
                    {isMe && isRole(user.role) ? <Badge variant="accent">{ROLE_LABELS[user.role]}</Badge> : null}
                    {!user.isActive ? <Badge variant="destructive">Deactivated</Badge> : null}
                    {user.mustChangePassword ? <Badge variant="neutral">Temporary password</Badge> : null}
                    {user.ssoLinked ? <Badge variant="neutral">SSO</Badge> : null}
                  </>
                }
                secondary={
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email} · {lastSignIn(user)}
                  </p>
                }
                actions={
                  isMe ? null : (
                    <>
                      <Select
                        className="h-8 w-28"
                        aria-label={`Role for ${user.displayName}`}
                        value={user.role}
                        disabled={busy === user.id}
                        onChange={(e) => isRole(e.target.value) && void setRole(user, e.target.value)}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                      <ResetPasswordDialog user={user} onSaved={replace} />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === user.id}
                        onClick={() => void setActive(user, !user.isActive)}
                        aria-label={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.displayName}`}
                      >
                        {busy === user.id ? <Loader2 className="animate-spin" /> : user.isActive ? <UserX /> : <UserCheck />}
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      <ConfirmDeleteButton label={`Delete ${user.displayName}`} onConfirm={() => remove(user)} />
                    </>
                  )
                }
              />
            );
          })}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Change your own name or password from the pencil button at the top of the page. Viewers see newsletters,
        designs, and send history. Editors also manage newsletters, designs, and recipients, and can send. Admins can
        do everything, including sources, SMTP, notifications, users, and logs.
      </p>
    </div>
  );
}
